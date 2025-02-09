// app/actions/nightscoutCache.ts
'use server';

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const NIGHTSCOUT_CACHE_DIR = path.join(process.cwd(), 'data', 'nightscout');

interface LocalFileOptions {
  filename: string;
}

export async function readLocalFile<T>(options: LocalFileOptions): Promise<T> {
  try {
    const filePath = path.join(NIGHTSCOUT_CACHE_DIR, options.filename);
    const fileData = await readFile(filePath, 'utf-8');
    return JSON.parse(fileData) as T;
  } catch (error: any) {
    throw new Error(`Failed to read local cache file ${options.filename}: ${error.message}`);
  }
}

export async function writeLocalFile<T>(data: T, options: LocalFileOptions): Promise<void> {
  try {
    await mkdir(NIGHTSCOUT_CACHE_DIR, { recursive: true });
    const filePath = path.join(NIGHTSCOUT_CACHE_DIR, options.filename);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    console.error(`Failed to write local cache file ${options.filename}: ${error.message}`);
  }
}
