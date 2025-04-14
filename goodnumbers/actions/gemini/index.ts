'use server';

// Export service functions
export {
  getAssessment,
  generatePodcastText,
  generatePodcastDescription,
  generatePodcastAudio,
  checkPodcastStatus,
  type Description
} from './services';

// Export utilities
export { loadTemplate } from './utils/templateUtils';

// Export client functionality
export { 
  getGeminiModel, 
  asyncGenerateJson, 
  genAI,
  createTtsClient,
  getJobStatus,
  createStorageClient, 
  getBucket, 
  generateAudioPath,
  DEFAULT_BUCKET_NAME,
  DEFAULT_AUDIO_PATH
} from './clients';

// Export RSS functionality
export { updateRssFeed, type UpdateRssFeedParams } from './rss';