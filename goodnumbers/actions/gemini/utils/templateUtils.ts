'use server';

import { promises as fs } from 'fs';
import path from 'path';

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

export { loadTemplate };