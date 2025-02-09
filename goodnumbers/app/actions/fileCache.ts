// app/actions/nightscoutCache.ts
'use server';

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'data');

interface LocalFileOptions {
  filename: string;
  plainText?: boolean; // Optional flag to return raw text
}

export async function readLocalFile<T>(options: LocalFileOptions): Promise<T> {
  try {
    const filePath = path.join(CACHE_DIR, options.filename);
    const fileData = await readFile(filePath, 'utf-8');
    return options.plainText ? (fileData as T) : (JSON.parse(fileData) as T);
  } catch (error: any) {
    throw new Error(`Failed to read local cache file ${options.filename}: ${error.message}`);
  }
}
export async function writeLocalFile<T>(data: T, options: LocalFileOptions): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, options.filename);
    const content = options.plainText ? String(data) : JSON.stringify(data, null, 2);
    await writeFile(filePath, content, 'utf-8');
  } catch (error: any) {
    console.error(`Failed to write local cache file ${options.filename}: ${error.message}`);
  }
}
