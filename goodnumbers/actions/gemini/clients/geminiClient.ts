'use server';

import {
  GoogleGenerativeAI,
  GenerationConfig,
  GenerativeModel,
  SchemaType,
  ResponseSchema,
} from '@google/generative-ai';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
 * Gets a configured Gemini model with the provided configuration
 */
function getGeminiModel(modelName: string, config: GenerationConfig): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: config,
  });
}

export { getGeminiModel, asyncGenerateJson, genAI };