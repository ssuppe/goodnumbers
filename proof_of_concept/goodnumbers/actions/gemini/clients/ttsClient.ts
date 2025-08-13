'use server';

import { JobCheckResponse } from '@/types/nightscout';

const { TextToSpeechLongAudioSynthesizeClient } = require('@google-cloud/text-to-speech').v1beta1;

/**
 * Creates a Text-to-Speech client using the provided credentials.
 * @returns An initialized Text-to-Speech client.
 */
function createTtsClient() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set.');
  }

  return new TextToSpeechLongAudioSynthesizeClient({
    apiEndpoint: 'texttospeech.googleapis.com',
    credentials: JSON.parse(require('fs').readFileSync(credentialsPath, 'utf-8')),
  });
}

/**
 * Checks the status of a long-running Text-to-Speech operation.
 * @param operationId The unique name/ID of the operation.
 * @returns JobCheckResponse detailing the operation's status.
 */
async function getJobStatus(operationId: string): Promise<JobCheckResponse> {
  const client = createTtsClient();

  var status: JobCheckResponse = {
    name: operationId,
    done: false,
    status: 'unknown',
    error: null,
    result: null,
  };

  try {
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
  } catch (error) {
    console.error('Error checking operation status:', error);
  }

  return status;
}

export { createTtsClient, getJobStatus };