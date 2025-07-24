'use server';

import { GenerationConfig, SchemaType, ResponseSchema } from '@google/generative-ai';
import { AssessmentData, PodcastGenerateResult } from '@/types/nightscout';
import { interpolate } from '@/utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { updateRssFeed } from '../rss';
import { canReadLocal, canWriteLocal } from '@/utils/env';
import { readLocalFile, writeLocalFile } from '@/utils/fileCache';
import { SSMLValidationResult, validateAndFixSsml } from '@/utils/ssml-server';
import { asyncGenerateJson, getGeminiModel } from '../clients/geminiClient';
import { createTtsClient, getJobStatus } from '../clients/ttsClient';
import { Description } from '@/components/nightscout.types';
import { generateAudioPath } from '../clients/storageClient';
import { DEFAULT_BUCKET_NAME } from '../clients/geminiClient.types.d';

// Helper function for logging with timestamps
function logWithTimestamp(level: 'log' | 'warn' | 'error', message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  if (level === 'log') {
    console.log(logMessage, ...args);
  } else if (level === 'warn') {
    console.warn(logMessage, ...args);
  } else if (level === 'error') {
    console.error(logMessage, ...args);
  }
}

/**
 * Generates podcast SSML dialog using Gemini AI, templates, and SSML validation/fixing.
 * Includes a retry mechanism for initial SSML generation and an enhancement step.
 * @param data Input AssessmentData containing notes and assessments.
 * @returns Updated AssessmentData with the final, validated SSML dialog.
 */
export async function generatePodcastText(data: AssessmentData): Promise<AssessmentData> {
  logWithTimestamp('log', 'Attempting to generate podcast SSML dialog...');

  const MAX_TRIES = 3;
  let validatedEnhancedSsml: string | null = null; // Holds the final, validated SSML after enhancement
  let attempt = 0;
  let successfulGeneration = false;

  // --- Attempt 1: Read from Local Cache ---
  if (canReadLocal()) {
    try {
      const cachedSsml = await readLocalFile<string>({ filename: 'gemini/pass4_final_enhanced.txt', plainText: true }); // Cache the enhanced version
      if (cachedSsml) {
        logWithTimestamp('log', 'SSML dialog read from local cache (pass4_final_enhanced.txt). Re-validating...');
        // Re-validate cached SSML to ensure it's still good
        const validationResult = validateAndFixSsml(cachedSsml);
        if (validationResult.error === null && validationResult.correctedSsml) {
          validatedEnhancedSsml = validationResult.correctedSsml;
          successfulGeneration = true;
          logWithTimestamp('log', 'Cached SSML is valid.');
          // Optionally log warnings from re-validation
          if (validationResult.warnings.length > 0) {
            logWithTimestamp('warn', 'Warnings during re-validation of cached SSML:', validationResult.warnings);
          }
        } else {
          logWithTimestamp(
            'warn',
            'Cached SSML is invalid or could not be fixed. Proceeding with generation.',
            validationResult.error,
          );
          // Optionally log warnings: logWithTimestamp('warn','Warnings:', validationResult.warnings);
        }
      }
    } catch (cacheError) {
      logWithTimestamp('warn', 'Local cache read failed for pass4_final_enhanced.txt, proceeding with generation.');
      // Ignore cache read error
    }
  }

  // --- Attempt 2: Generation Loop (if not found in cache or cache was invalid) ---
  if (!successfulGeneration) {
    try {
      // --- Initial Generation Setup ---
      const initialGenConfig: GenerationConfig = {
        temperature: 1.2,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 128000, // Adjust as needed, consider SSML size limits
        responseMimeType: 'text/plain',
      };
      const initialModel = getGeminiModel('gemini-2.5-pro', initialGenConfig);

      const template3 = await loadTemplate('pass3.txt');
      const initialPrompt = interpolate(template3, {
        notes: data.notes ?? '',
        assessment1: data.assessment1 ?? '',
        assessment2: data.assessment2 ?? '',
      });

      // --- Enhancement Setup ---
      const enhancedGenConfig: GenerationConfig = {
        temperature: 1.5, // Higher temperature for more creative enhancement
        topP: 0.95,
        maxOutputTokens: 128000, // Ensure enough tokens for potentially longer enhanced SSML
        responseMimeType: 'text/plain', // Assuming enhancement also returns plain text SSML
      };
      const enhancementModel = getGeminiModel('gemini-2.5-flash', enhancedGenConfig);

      const template4 = await loadTemplate('pass4.txt');

      // --- Retry Loop ---
      while (!successfulGeneration && attempt < MAX_TRIES) {
        attempt++;
        logWithTimestamp('log', `--- Generating SSML - Attempt ${attempt} / ${MAX_TRIES} ---`);

        let initialSsml: string | null = null;
        let correctedInitialSsml: string | null = null;
        let initialValidationResult: SSMLValidationResult | null = null;

        // 1. Generate Initial SSML
        try {
          logWithTimestamp('log', `Generating initial SSML draft (Attempt ${attempt})...`);
          const response = await initialModel.generateContent(initialPrompt);
          initialSsml = response.response.text();
          // Basic cleanup (optional, but can help before validation)
          initialSsml = initialSsml!.replaceAll('<laughs>', '').replaceAll('```', ''); // Example cleanup
        } catch (genError) {
          logWithTimestamp('error', `Error during initial SSML generation (Attempt ${attempt}):`, genError);
          // Decide if this error should count as a failed attempt or be retried immediately
          continue; // Skip to the next attempt
        }

        if (!initialSsml) {
          logWithTimestamp('warn', `Initial SSML generation returned empty content (Attempt ${attempt}).`);
          continue; // Skip to the next attempt
        }

        // 2. Validate and Fix Initial SSML
        logWithTimestamp('log', `Validating initial SSML (Attempt ${attempt})...`);
        initialValidationResult = validateAndFixSsml(initialSsml);

        if (initialValidationResult.warnings.length > 0) {
          logWithTimestamp(
            'warn',
            `Warnings during initial SSML validation (Attempt ${attempt}):`,
            initialValidationResult.warnings,
          );
        }

        if (initialValidationResult.error !== null) {
          // Initial SSML is invalid and could NOT be fixed
          logWithTimestamp(
            'error',
            `Attempt ${attempt}: Invalid initial SSML that couldn't be fixed. Error: ${initialValidationResult.error}`,
          );
          if (canWriteLocal()) {
            try {
              // Write the *original* invalid SSML for debugging
              await writeLocalFile(initialSsml, {
                filename: `gemini/pass3_invalid_attempt_${attempt}.txt`,
                plainText: true,
              });
            } catch (writeError) {
              logWithTimestamp('error', 'Failed to write invalid SSML log:', writeError);
            }
          }
          // Loop will continue to the next attempt if MAX_TRIES not reached
        } else {
          // Initial SSML is valid (or was successfully fixed)
          logWithTimestamp('log', `Attempt ${attempt}: Initial SSML is valid or was fixed.`);
          correctedInitialSsml = initialValidationResult.correctedSsml!;

          if (!correctedInitialSsml) {
            logWithTimestamp(
              'error',
              `Attempt ${attempt}: Initial SSML validation succeeded but corrected SSML is unexpectedly empty.`,
            );
            continue; // Treat as failure for this attempt
          }

          // 3. Enhance Validated Initial SSML
          logWithTimestamp('log', `Enhancing SSML (Attempt ${attempt})...`);
          let enhancedSsml: string | null = null;
          try {
            const enhancedPrompt = interpolate(template4, {
              ssml_dialog: correctedInitialSsml, // Use the validated/fixed initial SSML
            });
            const enhancedResponse = await enhancementModel.generateContent(enhancedPrompt);
            enhancedSsml = enhancedResponse.response.text();
            // Basic cleanup for enhanced SSML (remove potential markdown/fences)
            enhancedSsml = enhancedSsml!
              .replace(/^```(xml|ssml)?\s*/i, '')
              .replace(/\s*```$/, '')
              .trim();
            enhancedSsml = enhancedSsml?.replace(/\\n/g, '\n'); // Fix escaped newlines if necessary
          } catch (enhanceError) {
            logWithTimestamp('error', `Error during SSML enhancement (Attempt ${attempt}):`, enhanceError);
            // Decide if enhancement failure should stop the process or just skip enhancement for this try
            // For now, let's treat enhancement failure as a reason to retry the whole process
            continue; // Skip to the next attempt
          }

          if (!enhancedSsml) {
            logWithTimestamp('warn', `SSML enhancement returned empty content (Attempt ${attempt}).`);
            continue; // Skip to the next attempt
          }

          // 4. Validate and Fix Enhanced SSML
          logWithTimestamp('log', `Validating enhanced SSML (Attempt ${attempt})...`);
          const enhancedValidationResult = validateAndFixSsml(enhancedSsml);

          if (enhancedValidationResult.warnings.length > 0) {
            logWithTimestamp(
              'warn',
              `Warnings during enhanced SSML validation (Attempt ${attempt}):`,
              enhancedValidationResult.warnings,
            );
          }

          if (enhancedValidationResult.error === null && enhancedValidationResult.correctedSsml) {
            // SUCCESS! Enhanced SSML is valid (or was fixed)
            logWithTimestamp('log', `--- Attempt ${attempt}: Successfully generated and validated enhanced SSML! ---`);
            validatedEnhancedSsml = enhancedValidationResult.correctedSsml;
            successfulGeneration = true; // Set flag to exit the loop

            // Write the final, validated, *enhanced* SSML to cache if enabled
            if (canWriteLocal()) {
              try {
                await writeLocalFile(validatedEnhancedSsml, {
                  filename: 'gemini/pass4_final_enhanced.txt',
                  plainText: true,
                });
                logWithTimestamp('log', 'Final enhanced SSML written to local cache.');
              } catch (writeError) {
                logWithTimestamp('error', 'Failed to write final enhanced SSML to cache:', writeError);
              }
            }
            // Break the loop explicitly (though successfulGeneration flag would also do it)
            break;
          } else {
            // Enhanced SSML failed validation and couldn't be fixed
            logWithTimestamp(
              'error',
              `Attempt ${attempt}: Enhanced SSML failed validation or fixing. Error: ${enhancedValidationResult.error}`,
            );
            if (canWriteLocal()) {
              try {
                // Write the *failed* enhanced SSML for debugging
                await writeLocalFile(enhancedSsml, {
                  filename: `gemini/pass4_invalid_enhanced_attempt_${attempt}.txt`,
                  plainText: true,
                });
              } catch (writeError) {
                logWithTimestamp('error', 'Failed to write invalid enhanced SSML log:', writeError);
              }
            }
            // Let the loop continue to retry the *entire* process (initial generation + enhancement)
          }
        }
      } // End of while loop
    } catch (error) {
      // Catch errors from setup (e.g., loading templates)
      console.error('Error during SSML generation setup or loop:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to generate podcast text: ${error.message}`);
      }
      throw new Error('Unknown error occurred during podcast text generation process.');
    }
  } // End of generation block (!successfulGeneration)

  // --- Final Check and Return ---
  if (!successfulGeneration || !validatedEnhancedSsml) {
    // Only throw if we exhausted retries *and* didn't succeed via cache or generation
    logWithTimestamp('error', `Failed to generate valid SSML after ${attempt} attempts.`);
    throw new Error(`Failed to generate valid and enhanced SSML after ${MAX_TRIES} attempts.`);
  }

  logWithTimestamp('log', 'Podcast SSML generation completed successfully.');
  return {
    ...data, // Preserve all original data
    valid: true, // Mark as valid because we have successful SSML
    ssml_dialog: validatedEnhancedSsml, // Assign the final, validated SSML
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generates a podcast title and description using Gemini AI.
 * @param data Input AssessmentData containing the SSML dialog.
 * @returns Updated AssessmentData with title and description.
 */
export async function generatePodcastDescription(data: AssessmentData): Promise<AssessmentData> {
  logWithTimestamp('log', 'Generating podcast title and description');

  try {
    // Load and interpolate template
    const desc_template = await loadTemplate('description.txt');
    const prompt = interpolate(desc_template, {
      ssml_dialog: data.ssml_dialog ?? '',
    });

    const description_schema: ResponseSchema = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, nullable: false },
          description: { type: SchemaType.STRING },
        },
        required: ['title', 'description'],
      },
    };

    // Initial generation configuration
    const generationConfig: GenerationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 10000,
      responseMimeType: 'application/json',
      responseSchema: description_schema,
    };

    let model = getGeminiModel('gemini-2.5-flash', generationConfig);

    var response: Description = await asyncGenerateJson<Description>(prompt, model);
    response = response;

    // Preserve ALL properties of the original data object
    return {
      ...data,
      valid: true,
      title: response.title,
      description: response.description,
      timestamp: new Date().toISOString(),
      // Explicitly preserve these important fields
      ssml_dialog: data.ssml_dialog,
      report_items: data.report_items,
      notes: data.notes,
      assessment1: data.assessment1,
      assessment2: data.assessment2,
      preferred_units: data.preferred_units,
    };
  } catch (error) {
    if (error instanceof Error) {
      logWithTimestamp('error', 'Error:', error.message);
      throw new Error(`Failed to generate podcast text: ${error.message}`);
    }
    throw new Error('Unknown error occurred during podcast text generation');
  }
}

/**
 * Initiates long audio synthesis using Google Text-to-Speech API.
 * @param podcast AssessmentData containing SSML, title, description, and ID.
 * @returns PodcastGenerateResult indicating the start of the process.
 */
export async function generatePodcastAudio(podcast: AssessmentData): Promise<PodcastGenerateResult> {
  if (!podcast?.ssml_dialog) {
    throw new Error(`Invalid dialog: ${podcast.ssml_dialog}`);
  }

  logWithTimestamp('log', `GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    logWithTimestamp('error', 'GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  }

  try {
    const { title, description, ssml_dialog, id } = podcast;

    // Generate unique paths using our storage client utility
    const pathInfo = generateAudioPath(id!);

    const client = createTtsClient();

    // Start synthesis
    const [operation] = await client.synthesizeLongAudio({
      parent: 'projects/goodnumbers-446416/locations/global',
      input: { ssml: ssml_dialog },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        speakingRate: 0.95,
        pitch: 0.0,
      },
      outputGcsUri: pathInfo.outputGcsUri,
      voice: {
        languageCode: 'en-GB',
        name: 'en-GB-Wavenet-B',
      },
    });

    return {
      status: 'processing',
      operation_id: operation.name,
      gcs_path: pathInfo.gcsPath,
      bucket_name: pathInfo.bucketName,
      url: pathInfo.publicUrl,
      message: 'Audio generation started successfully',
      title,
      description,
    };
  } catch (error) {
    logWithTimestamp('error', 'Error in generatePodcastAudio:', error);
    throw error;
  }
}

/**
 * Checks the status of the podcast audio generation job and updates the RSS feed upon completion.
 * @param podcast_result The current status of the podcast generation job.
 * @returns Updated PodcastGenerateResult with the latest status.
 */
export async function checkPodcastStatus(podcast_result: PodcastGenerateResult): Promise<PodcastGenerateResult> {
  if (!podcast_result.operation_id) {
    podcast_result.status = 'error';
    podcast_result.error = `Invalid operation id: ${podcast_result.operation_id}`;
    return podcast_result;
  }

  const status = await getJobStatus(podcast_result.operation_id);

  if (status.done && !status.error) {
    podcast_result.status = 'done';

    /* Assuming this gets called and happens at least 1x.
       This is not totall foolproof but fine for POC
       This is the time to create/update the RSS feed
    */
    const basePath = podcast_result.gcs_path?.split('/').slice(0, -1).join('/');
    const rssPath = `${basePath}/feed.xml`;
    const pubDate = new Date(); // UTC by default

    updateRssFeed({
      bucketName: DEFAULT_BUCKET_NAME,
      rssPath: rssPath,
      link: podcast_result.url,
      title: podcast_result.title ?? 'Goodnumbers',
      description: podcast_result.description ?? 'Latest podcast',
      pubDate: pubDate,
      guid: uuidv4(),
    });

    return podcast_result;
  } else if (status.error) {
    podcast_result.status = 'error';
    podcast_result.error = status.error.toString();
    return podcast_result;
  } else {
    podcast_result.status = 'processing';
    return podcast_result;
  }
}

// Helper functions
async function loadTemplate(filename: string): Promise<string> {
  const templateUtil = await import('../utils/templateUtils');
  return templateUtil.loadTemplate(filename);
}
