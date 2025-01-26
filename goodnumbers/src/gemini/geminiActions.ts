'use server';

// app/actions/assessment.ts
import { GoogleGenerativeAI, GenerationConfig, GenerativeModel, SchemaType } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';
import { AssessmentData } from '~/types/nightscout';
import { checkGoogleTtsSSMLFormat } from '~/utils/ssml-server';
import { interpolate } from '~/utils/utils';

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

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebug = process.env.DEBUG === 'false';
const isWriteLocal = process.env.WRITE_LOCAL === 'false';

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

      // Check SSML validity
      console.log(checkGoogleTtsSSMLFormat);
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

  console.log('done');
  return JSON.parse(cleanJson);
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

    const response = await asyncGenerateJson<Description>(prompt, model);

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
