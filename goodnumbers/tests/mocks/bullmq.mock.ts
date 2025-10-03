import { jest } from '@jest/globals';

/**
 * A shared singleton object (registry) to hold the mock instance.
 * Both the mock constructor and the test file will import this,
 * guaranteeing they are accessing the exact same object reference.
 */
interface MockQueueInstance {
  name: string;
  add: jest.Mock;
  obliterate: jest.Mock;
  close: jest.Mock;
  getJobs: jest.Mock;
}

export const bullmqMockRegistry = {
  instance: null as MockQueueInstance | null, // We will store the mock instance here
};

// This is the mock implementation of the BullMQ 'Queue' class.
export const MockQueue = jest.fn().mockImplementation(function(this: MockQueueInstance, queueName: string) {
  // The properties and methods of our mock instance
  this.name = queueName;
  this.add = jest.fn().mockResolvedValue({ id: 'mock-job-id' });
  this.obliterate = jest.fn().mockResolvedValue(undefined);
  this.close = jest.fn().mockResolvedValue(undefined);
  this.getJobs = jest.fn().mockResolvedValue([]);

  // CRITICAL: We register the newly created instance (`this`) in our shared registry.
  bullmqMockRegistry.instance = this;
});