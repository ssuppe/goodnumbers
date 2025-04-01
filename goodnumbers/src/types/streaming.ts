// // types/streaming.ts

// import { AssessmentData } from '~/types/nightscout.js';

// // Define all possible steps in the process
// export enum ProcessStep {
//   Setup = 'setup',
//   Profiles = 'profiles',
//   Analysis = 'analysis',
//   Assessment1 = 'assessment1',
//   Assessment2 = 'assessment2',
//   Podcast = 'podcast',
// }

// // Define all possible message types our stream can send
// export interface ProgressMessage {
//   type: 'progress';
//   step: ProcessStep;
//   progress: number;
//   message: string;
// }

// export interface ResultMessage {
//   type: 'result';
//   data: AssessmentData;
// }

// export interface ErrorMessage {
//   type: 'error';
//   error: string;
//   step?: ProcessStep; // Optional: track which step failed
// }

// // Union type of all possible messages
// export type StreamMessage = ProgressMessage | ResultMessage | ErrorMessage;

// // Helper to type-check message creation
// export const createProgressMessage = (step: ProcessStep, progress: number, message: string): ProgressMessage => ({
//   type: 'progress',
//   step,
//   progress,
//   message,
// });

// export const createResultMessage = (data: AssessmentData): ResultMessage => ({
//   type: 'result',
//   data,
// });

// export const createErrorMessage = (error: string, step?: ProcessStep): ErrorMessage => ({
//   type: 'error',
//   error,
//   step,
// });
