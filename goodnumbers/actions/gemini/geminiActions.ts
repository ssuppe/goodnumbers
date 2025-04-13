'use server';

// app/actions/assessment.ts
import {
  GoogleGenerativeAI,
  GenerationConfig,
  GenerativeModel,
  SchemaType,
  ResponseSchema,
} from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';
import { AssessmentData, PodcastGenerateResult, JobCheckResponse } from '@/types/nightscout';
import { interpolate } from '@/utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '@google-cloud/storage';
import { updateRssFeed } from './rss';
import { canReadLocal, canWriteLocal } from '@/utils/env';
import { readLocalFile, writeLocalFile } from '@/utils/fileCache';
import { SSMLValidationResult, validateAndFixSsml } from '@/utils/ssml-server'; // Assuming this path is correct

const { TextToSpeechLongAudioSynthesizeClient } = require('@google-cloud/text-to-speech').v1beta1;

const BUCKET_NAME = 'goodnumbersmain'; // Replace with your bucket name
const GCS_PATH = 'audio-files'; // Folder in bucket to store audio files

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Loads a text template file from the specified path.
 * @param filename The name of the template file within the prompts directory.
 * @returns The content of the template file as a string.
 */
const loadTemplate = async (filename: string): Promise<string> => {
  const templatePath = path.join(process.cwd(), 'actions', 'gemini', '_prompts', filename);
  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error(`Error loading template ${filename}:`, error);
    throw new Error(`Failed to load template: ${filename}`);
  }
};

// Interface for Description (used in generatePodcastDescription)
export interface Description {
  title: string;
  description: string;
}

/**
 * Generates assessment text based on notes and previous assessments.
 * Uses Gemini AI and templates. Supports local caching.
 * @param data Input AssessmentData containing notes and potentially previous assessments.
 * @returns Updated AssessmentData with the new assessment text.
 */
export async function getAssessment(data: AssessmentData): Promise<AssessmentData> {
  console.log(`Generating assessment using template ${data.template_num ?? 1}`);
  try {
    if (!data.notes) {
      throw new Error('Notes are required for assessment generation.');
    }

    const templateNum = data.template_num ?? 1;
    let responseText: string | null = null; // Initialize responseText

    // Attempt to read from local cache first if enabled
    if (canReadLocal()) {
      try {
        responseText = await readLocalFile({ filename: `gemini/pass${templateNum}.txt`, plainText: true });
        if (responseText) {
          console.log(`Assessment template ${templateNum} read from local cache.`);
        }
      } catch (cacheError) {
        console.warn(`Local cache read failed for pass${templateNum}.txt, proceeding with generation.`);
        // Ignore cache read error and proceed to generate
      }
    }

    // Generate content if not found in cache
    if (responseText === null || responseText === '') {
      console.log(`Generating assessment content for template ${templateNum}...`);
      // Configure Gemini model
      const generationConfig: GenerationConfig = {
        temperature: 1.0,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 32000,
        responseMimeType: 'text/plain',
      };

      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig,
      });

      let prompt: string;
      switch (templateNum) {
        case 1: {
          const template1 = await loadTemplate('pass1.txt');
          prompt = interpolate(template1, { notes: data.notes });
          break;
        }
        case 2: {
          if (!data.assessment1) {
            throw new Error('Assessment 1 is required for template 2.');
          }
          const template2 = await loadTemplate('pass2.txt');
          prompt = interpolate(template2, {
            notes: data.notes,
            assessment1: data.assessment1,
          });
          break;
        }
        default:
          throw new Error(`Invalid template number: ${templateNum}`);
      }

      const result = await model.generateContent(prompt);
      responseText = result.response.text();
      console.log(`Assessment content generated for template ${templateNum}.`);

      // Write to local cache if enabled
      if (canWriteLocal() && responseText) {
        try {
          await writeLocalFile(responseText, {
            filename: `gemini/pass${templateNum}.txt`,
            plainText: true,
          });
          console.log(`Assessment template ${templateNum} written to local cache.`);
        } catch (cacheWriteError) {
          console.error(`Failed to write assessment template ${templateNum} to local cache:`, cacheWriteError);
          // Continue execution even if cache write fails
        }
      }
    }

    // Ensure responseText is not null before returning
    if (responseText === null) {
      throw new Error('Failed to obtain assessment text.');
    }

    // Return updated data, preserving existing fields
    return {
      ...data,
      valid: true, // Mark as valid since we successfully got text
      assessment1: templateNum === 1 ? responseText : data.assessment1,
      assessment2: templateNum === 2 ? responseText : data.assessment2,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error during assessment generation:', error);
    // Re-throw a more specific error
    if (error instanceof Error) {
      throw new Error(`Assessment generation failed: ${error.message}`);
    }
    throw new Error('Unknown error occurred during assessment generation');
  }
}

/**
 * Generates podcast SSML dialog using Gemini AI, templates, and SSML validation/fixing.
 * Includes a retry mechanism for initial SSML generation and an enhancement step.
 * @param data Input AssessmentData containing notes and assessments.
 * @returns Updated AssessmentData with the final, validated SSML dialog.
 */
export async function generatePodcastText(data: AssessmentData): Promise<AssessmentData> {
  console.log('Attempting to generate podcast SSML dialog...');

  const MAX_TRIES = 3;
  let validatedEnhancedSsml: string | null = null; // Holds the final, validated SSML after enhancement
  let attempt = 0;
  let successfulGeneration = false;

  // --- Attempt 1: Read from Local Cache ---
  if (canReadLocal()) {
    try {
      const cachedSsml = await readLocalFile<string>({ filename: 'gemini/pass4_final_enhanced.txt', plainText: true }); // Cache the enhanced version
      if (cachedSsml) {
        console.log('SSML dialog read from local cache (pass4_final_enhanced.txt). Re-validating...');
        // Re-validate cached SSML to ensure it's still good
        const validationResult = validateAndFixSsml(cachedSsml);
        if (validationResult.error === null && validationResult.correctedSsml) {
          validatedEnhancedSsml = validationResult.correctedSsml;
          successfulGeneration = true;
          console.log('Cached SSML is valid.');
          // Optionally log warnings from re-validation
          if (validationResult.warnings.length > 0) {
            console.warn('Warnings during re-validation of cached SSML:', validationResult.warnings);
          }
        } else {
          console.warn(
            'Cached SSML is invalid or could not be fixed. Proceeding with generation.',
            validationResult.error,
          );
          // Optionally log warnings: console.warn('Warnings:', validationResult.warnings);
        }
      }
    } catch (cacheError) {
      console.warn('Local cache read failed for pass4_final_enhanced.txt, proceeding with generation.');
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
      const initialModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro', // Or your preferred model for initial draft
        generationConfig: initialGenConfig,
      });
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
      const enhancementModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash', // Using Flash for potentially faster enhancement
        generationConfig: enhancedGenConfig,
      });
      const template4 = await loadTemplate('pass4.txt');

      // --- Retry Loop ---
      while (!successfulGeneration && attempt < MAX_TRIES) {
        attempt++;
        console.log(`--- Generating SSML - Attempt ${attempt} / ${MAX_TRIES} ---`);

        let initialSsml: string | null = null;
        let correctedInitialSsml: string | null = null;
        let initialValidationResult: SSMLValidationResult | null = null;

        // 1. Generate Initial SSML
        try {
          console.log(`Generating initial SSML draft (Attempt ${attempt})...`);
          const response = await initialModel.generateContent(initialPrompt);
          initialSsml = response.response.text();
          // Basic cleanup (optional, but can help before validation)
          initialSsml = initialSsml?.replaceAll('<laughs>', '').replaceAll('```', ''); // Example cleanup
        } catch (genError) {
          console.error(`Error during initial SSML generation (Attempt ${attempt}):`, genError);
          // Decide if this error should count as a failed attempt or be retried immediately
          continue; // Skip to the next attempt
        }

        if (!initialSsml) {
          console.warn(`Initial SSML generation returned empty content (Attempt ${attempt}).`);
          continue; // Skip to the next attempt
        }

        // 2. Validate and Fix Initial SSML
        console.log(`Validating initial SSML (Attempt ${attempt})...`);
        initialValidationResult = validateAndFixSsml(initialSsml);

        if (initialValidationResult.warnings.length > 0) {
          console.warn(
            `Warnings during initial SSML validation (Attempt ${attempt}):`,
            initialValidationResult.warnings,
          );
        }

        if (initialValidationResult.error !== null) {
          // Initial SSML is invalid and could NOT be fixed
          console.error(
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
              console.error('Failed to write invalid SSML log:', writeError);
            }
          }
          // Loop will continue to the next attempt if MAX_TRIES not reached
        } else {
          // Initial SSML is valid (or was successfully fixed)
          console.log(`Attempt ${attempt}: Initial SSML is valid or was fixed.`);
          correctedInitialSsml = initialValidationResult.correctedSsml!;

          if (!correctedInitialSsml) {
            console.error(
              `Attempt ${attempt}: Initial SSML validation succeeded but corrected SSML is unexpectedly empty.`,
            );
            continue; // Treat as failure for this attempt
          }

          // 3. Enhance Validated Initial SSML
          console.log(`Enhancing SSML (Attempt ${attempt})...`);
          let enhancedSsml: string | null = null;
          try {
            const enhancedPrompt = interpolate(template4, {
              ssml_dialog: correctedInitialSsml, // Use the validated/fixed initial SSML
            });
            const enhancedResponse = await enhancementModel.generateContent(enhancedPrompt);
            enhancedSsml = enhancedResponse.response.text();
            // Basic cleanup for enhanced SSML (remove potential markdown/fences)
            enhancedSsml = enhancedSsml
              ?.replace(/^```(xml|ssml)?\s*/i, '')
              .replace(/\s*```$/, '')
              .trim();
            enhancedSsml = enhancedSsml?.replace(/\\n/g, '\n'); // Fix escaped newlines if necessary
          } catch (enhanceError) {
            console.error(`Error during SSML enhancement (Attempt ${attempt}):`, enhanceError);
            // Decide if enhancement failure should stop the process or just skip enhancement for this try
            // For now, let's treat enhancement failure as a reason to retry the whole process
            continue; // Skip to the next attempt
          }

          if (!enhancedSsml) {
            console.warn(`SSML enhancement returned empty content (Attempt ${attempt}).`);
            continue; // Skip to the next attempt
          }

          // 4. Validate and Fix Enhanced SSML
          console.log(`Validating enhanced SSML (Attempt ${attempt})...`);
          const enhancedValidationResult = validateAndFixSsml(enhancedSsml);

          if (enhancedValidationResult.warnings.length > 0) {
            console.warn(
              `Warnings during enhanced SSML validation (Attempt ${attempt}):`,
              enhancedValidationResult.warnings,
            );
          }

          if (enhancedValidationResult.error === null && enhancedValidationResult.correctedSsml) {
            // SUCCESS! Enhanced SSML is valid (or was fixed)
            console.log(`--- Attempt ${attempt}: Successfully generated and validated enhanced SSML! ---`);
            validatedEnhancedSsml = enhancedValidationResult.correctedSsml;
            successfulGeneration = true; // Set flag to exit the loop

            // Write the final, validated, *enhanced* SSML to cache if enabled
            if (canWriteLocal()) {
              try {
                await writeLocalFile(validatedEnhancedSsml, {
                  filename: 'gemini/pass4_final_enhanced.txt',
                  plainText: true,
                });
                console.log('Final enhanced SSML written to local cache.');
              } catch (writeError) {
                console.error('Failed to write final enhanced SSML to cache:', writeError);
              }
            }
            // Break the loop explicitly (though successfulGeneration flag would also do it)
            break;
          } else {
            // Enhanced SSML failed validation and couldn't be fixed
            console.error(
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
                console.error('Failed to write invalid enhanced SSML log:', writeError);
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
    console.error(`Failed to generate valid SSML after ${attempt} attempts.`);
    throw new Error(`Failed to generate valid and enhanced SSML after ${MAX_TRIES} attempts.`);
  }

  console.log('Podcast SSML generation completed successfully.');
  return {
    ...data, // Preserve all original data
    valid: true, // Mark as valid because we have successful SSML
    ssml_dialog: validatedEnhancedSsml, // Assign the final, validated SSML
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generates JSON content using the provided model and schema
 */
async function asyncGenerateJson<T>(prompt: string, model: GenerativeModel): Promise<T> {
  console.log('generating JSON');

  const response = await model.generateContent(prompt);

  // Clean up JSON response
  const cleanJson = response.response.text().replace('```json\n', '').replace('\n```', '');
  var result = JSON.parse(cleanJson);
  console.log('done');
  return result[0];
}

/**
 * Generates a podcast title and description using Gemini AI.
 * @param data Input AssessmentData containing the SSML dialog.
 * @returns Updated AssessmentData with title and description.
 */
export async function generatePodcastDescription(data: AssessmentData): Promise<AssessmentData> {
  console.log('Generating podcast title and description');

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

    let model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: generationConfig,
    });

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
      console.error('Error:', error.message);
      throw new Error(`Failed to generate podcast text: ${error.message}`);
    }
    throw new Error('Unknown error occurred during podcast text generation');
  }
}

// --- Placeholder/Example Implementations for Audio Generation/Status Check ---
// Replace these with your actual implementations if they differ significantly

/**
 * Initiates long audio synthesis using Google Text-to-Speech API.
 * @param podcast AssessmentData containing SSML, title, description, and ID.
 * @returns PodcastGenerateResult indicating the start of the process.
 */
export async function generatePodcastAudio(podcast: AssessmentData): Promise<PodcastGenerateResult> {
  if (!podcast?.ssml_dialog) {
    throw new Error(`Invalid dialog: ${podcast.ssml_dialog}`);
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  }

  try {
    const { title, description, ssml_dialog, id } = podcast;

    // Initialize Storage
    const storage = new Storage({
      projectId: 'goodnumbers-446416',
      keyFilename: credentialsPath,
    });
    const bucket = storage.bucket(BUCKET_NAME);

    // Generate unique path
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
    const fileName = `podcast_${timestamp}.wav`;
    const gcsPath = `${GCS_PATH}/${id}/${fileName}`;
    const outputGcsUri = `gs://${BUCKET_NAME}/${gcsPath}`;

    const client = new TextToSpeechLongAudioSynthesizeClient({
      apiEndpoint: 'texttospeech.googleapis.com',
      credentials: JSON.parse(require('fs').readFileSync(credentialsPath, 'utf-8')),
    });

    // Start synthesis
    const [operation] = await client.synthesizeLongAudio({
      parent: 'projects/goodnumbers-446416/locations/global',
      input: { ssml: ssml_dialog },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        speakingRate: 0.95,
        pitch: 0.0,
      },
      outputGcsUri: outputGcsUri,
      voice: {
        languageCode: 'en-GB',
        name: 'en-GB-Wavenet-B',
      },
    });

    return {
      status: 'processing',
      operation_id: operation.name,
      gcs_path: gcsPath,
      bucket_name: BUCKET_NAME,
      url: `https://storage.googleapis.com/goodnumbersmain/${gcsPath}`,
      message: 'Audio generation started successfully',
      title,
      description,
    };
  } catch (error) {
    console.error('Error in generatePodcastAudio:', error);
    throw error;
  }
}

/**
 * Checks the status of a long-running Text-to-Speech operation.
 * @param operationId The unique name/ID of the operation.
 * @returns JobCheckResponse detailing the operation's status.
 */
async function getJobStatus(operationId: string): Promise<JobCheckResponse> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  }

  const client = new TextToSpeechLongAudioSynthesizeClient({
    apiEndpoint: 'texttospeech.googleapis.com',
    credentials: JSON.parse(require('fs').readFileSync(credentialsPath, 'utf-8')),
  });

  var status: JobCheckResponse = {
    name: operationId,
    done: false,
    status: 'unknown',
    error: null,
    result: null,
  };

  try {
    // Create a proper GetOperationRequest object

    const operationCall = await client.checkSynthesizeLongAudioProgress(operationId);
    const operation = await operationCall.promise();
    const operationProgress: number = operation[1]['progressPercentage'];
    const operationInfo = operation[2];
    console.debug('\nDebug Information:');
    console.debug(operation);

    // Initialize done to true, then update if needed
    status.name = operationInfo.name;
    status.done = operationInfo.done;

    if (operationInfo.done) {
      if (operationInfo.response) {
        console.log('success');
        status.status = 'done';
        status.error = null;
      } else if (operationInfo.error) {
        // Directly check for operation.error
        console.log('error');
        status.status = 'error';
        status.error = operationInfo.error.message;
      } else {
        console.log('else'); // This case shouldn't typically happen with the updated logic
        status.status = 'unknown';
        status.result = operationInfo.result; // Use operation.result directly
      }
    } else {
      status.status = 'processing';
    }

    console.log(`Returning: ${JSON.stringify(status)}`);
    return status;

    // if (operation.done) {
    //   if (operation.error) {
    //     console.error('Long-running operation failed:', operation.error.message);
    //   } else if (operation.response) {
    //     const results = operation.response.results as unknown as { alternatives: { transcript: string }[] }[]; // Type casting may be needed because sometimes types in the library aren't perfect

    //     // Process the results
    //     results.forEach((result) => {
    //       const transcript = result.alternatives[0].transcript;
    //       console.log(`Transcript: ${transcript}`);
    //     });
    //   }
    // } else {
    //   console.log('Operation still in progress...');
    //   // You can check again later (e.g., using setInterval)
    // }
  } catch (error) {
    console.error('Error checking operation status:', error);
    // Handle the error appropriately
  }

  return status;
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
      bucketName: BUCKET_NAME,
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
