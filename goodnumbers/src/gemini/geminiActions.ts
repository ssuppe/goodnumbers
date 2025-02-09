'use server';

// app/actions/assessment.ts
import { GoogleGenerativeAI, GenerationConfig, GenerativeModel, SchemaType } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';
import { AssessmentData, PodcastGenerateResult, JobCheckResponse } from '~/types/nightscout';
import { checkGoogleTtsSSMLFormat } from '~/utils/ssml-server';
import { interpolate } from '~/utils/utils';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '@google-cloud/storage';
import { updateRssFeed } from './rss';

const { TextToSpeechLongAudioSynthesizeClient } = require('@google-cloud/text-to-speech').v1beta1;
const isDevelopment = process.env.ENV === 'development';
const isDebug = process.env.DEBUG === 'false';
const isWriteLocal = process.env.WRITE_LOCAL === 'false';

const BUCKET_NAME = 'goodnumbersmain'; // Replace with your bucket name
const GCS_PATH = 'audio-files'; // Folder in bucket to store audio files
const POLLING_INTERVAL = 10; // seconds

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const loadTemplate = async (filename: string): Promise<string> => {
  const templatePath = path.join(process.cwd(), 'src', 'gemini', '_prompts', filename);
  return await fs.readFile(templatePath, 'utf-8');
};

export interface Description {
  title: string;
  description: string;
}

export async function getAssessment(data: AssessmentData): Promise<AssessmentData> {
  try {
    if (!data.notes) {
      throw new Error('Notes are required');
    }

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

    const templateNum = data.template_num ?? 1;
    let responseText = '';

    // Load appropriate template and generate response
    switch (templateNum) {
      case 1: {
        const template1 = await loadTemplate('pass1.txt');
        const prompt = interpolate(template1, { notes: data.notes });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        break;
      }
      case 2: {
        // debugger;
        if (!data.assessment1) {
          throw new Error('Assessment1 required for template 2');
        }
        const template2 = await loadTemplate('pass2.txt');
        const prompt = interpolate(template2, {
          notes: data.notes,
          assessment1: data.assessment1,
        });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        break;
      }
      default:
        throw new Error(`Invalid template number: ${templateNum}`);
    }

    return {
      ...data,
      valid: true,
      assessment1: templateNum === 1 ? responseText : data.assessment1,
      assessment2: templateNum === 2 ? responseText : data.assessment2,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Assessment generation failed: ${error.message}`);
    }
    throw new Error('Unknown error occurred during assessment generation');
  }
}

export async function generatePodcastText(data: AssessmentData): Promise<AssessmentData> {
  console.log('Generating podcast');

  try {
    // Initial generation configuration
    const generationConfig: GenerationConfig = {
      temperature: 1.2,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 128000,
      responseMimeType: 'text/plain',
    };

    let model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig,
    });

    // Load and interpolate template
    const template3 = await loadTemplate('pass3.txt');
    const prompt = interpolate(template3, {
      notes: data.notes ?? '',
      assessment1: data.assessment1 ?? '',
      assessment2: data.assessment2 ?? '',
    });

    let isValidSsml = false;
    let noSsmlTries = 0;

    while (!isValidSsml && noSsmlTries < 3) {
      console.log(`Generating SSML ${noSsmlTries} / 3`);
      let podcastSsml: string;

      // Debug mode handling
      if (isDevelopment && isDebug) {
        try {
          const debugContent = await fs.readFile(path.join(process.cwd(), '_tmp', 'pass3_output.txt'), 'utf-8');
          podcastSsml = JSON.parse(debugContent);
        } catch {
          const response = await model.generateContent(prompt);
          podcastSsml = response.response.text();
        }
      } else {
        const response = await model.generateContent(prompt);
        podcastSsml = response.response.text();
      }

      // Basic fixes that AI sometimes makes to SSML
      podcastSsml = podcastSsml.replaceAll('<laughs>', '');

      // Check SSML validity
      const ssmlCheck = await checkGoogleTtsSSMLFormat(podcastSsml);
      isValidSsml = ssmlCheck.isCorrect;

      console.log(`Is valid SSML? ${ssmlCheck.isCorrect}`);

      if (!isValidSsml) {
        console.log(`${noSsmlTries}/3: Invalid SSML that couldn't be fixed: ${podcastSsml}`);
        if (isDevelopment && isWriteLocal) {
          await fs.writeFile(path.join(process.cwd(), '_tmp', 'pass3_output.txt'), JSON.stringify(podcastSsml));
        }
        noSsmlTries++;
      } else {
        // Got valid SSML, enhance it with more human intonation
        const enhancedGenerationConfig: GenerationConfig = {
          temperature: 1.5,
          topP: 0.95,
          maxOutputTokens: 8192,
        };

        model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-exp',
          generationConfig: enhancedGenerationConfig,
        });

        // Load and interpolate template for enhancement
        const template4 = await loadTemplate('pass4.txt');
        const enhancedPrompt = interpolate(template4, {
          ssml_dialog: ssmlCheck.processedSsml,
        });

        const enhancedResponse = await model.generateContent(enhancedPrompt);
        const finalSsml = enhancedResponse.response
          .text()
          .replace('```xml', '')
          .replace('```', '')
          .replace(/\\n/g, '\n');

        if (isDevelopment && isWriteLocal) {
          await fs.writeFile(path.join(process.cwd(), '_tmp', 'pass3_output.txt'), finalSsml);
        }

        return {
          ...data,
          valid: true,
          ssml_dialog: finalSsml,
          timestamp: new Date().toISOString(),
        };
      }
    }

    throw new Error('Failed to generate valid SSML after 3 attempts');
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      throw new Error(`Failed to generate podcast text: ${error.message}`);
    }
    throw new Error('Unknown error occurred during podcast text generation');
  }
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

export async function generatePodcastDescription(data: AssessmentData): Promise<AssessmentData> {
  console.log('Generating podcast title and description');

  try {
    // Load and interpolate template
    const desc_template = await loadTemplate('description.txt');
    const prompt = interpolate(desc_template, {
      ssml_dialog: data.ssml_dialog ?? '',
    });

    const description_schema = {
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
    return {
      ...data,
      valid: true,
      title: response.title,
      description: response.description,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      throw new Error(`Failed to generate podcast text: ${error.message}`);
    }
    throw new Error('Unknown error occurred during podcast text generation');
  }
}

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
      voice: {
        languageCode: 'en-GB',
        name: 'en-GB-Wavenet-B',
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        speakingRate: 0.9,
        pitch: 0.0,
      },
      outputGcsUri,
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

//
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
