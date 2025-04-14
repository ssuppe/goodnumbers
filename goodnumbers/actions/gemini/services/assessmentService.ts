'use server';

import { GenerationConfig } from '@google/generative-ai';
import { AssessmentData } from '@/types/nightscout';
import { interpolate } from '@/utils/utils';
import { canReadLocal, canWriteLocal } from '@/utils/env';
import { readLocalFile, writeLocalFile } from '@/utils/fileCache';
import { loadTemplate } from '../utils/templateUtils';
import { genAI, getGeminiModel } from '../clients';

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

      const model = getGeminiModel('gemini-1.5-pro', generationConfig);

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