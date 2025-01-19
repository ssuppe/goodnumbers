'use server';

// app/actions/assessment.ts
import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { promises as fs } from 'fs';
import path from 'path';
import { AssessmentData } from '~/types/nightscout';
import { interpolate } from '~/utils/utils';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const loadTemplate = async (filename: string): Promise<string> => {
  const templatePath = path.join(process.cwd(), 'src', 'gemini', '_prompts', filename);
  return await fs.readFile(templatePath, 'utf-8');
};

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
        debugger;
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
