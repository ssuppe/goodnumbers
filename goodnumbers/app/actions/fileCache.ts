// app/actions/nightscoutCache.ts
'use server';

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data');

interface LocalFileOptions {
  filename: string;
  plainText?: boolean; // Optional flag to return raw text
}

export async function readLocalFile<T>(options: LocalFileOptions): Promise<T | null> {
  try {
    const filePath = path.join(CACHE_DIR, options.filename);
    const fileData = await readFile(filePath, 'utf-8');
    return options.plainText ? (fileData as T) : (JSON.parse(fileData) as T);
  } catch (error: any) {
    return null;
  }
}

export async function writeLocalFile<T>(data: T, options: LocalFileOptions): Promise<void> {
  try {
    // Get the full directory path including any subdirectories
    const fullPath = path.join(CACHE_DIR, options.filename);
    const dirPath = path.dirname(fullPath);

    // Create all necessary directories
    await mkdir(dirPath, { recursive: true });

    // Write the file
    const content = options.plainText ? String(data) : JSON.stringify(data, null, 2);
    await writeFile(fullPath, content, 'utf-8');
  } catch (error: any) {
    console.error(`Failed to write local cache file ${options.filename}: ${error.message}`);
    throw error;
  }
}
