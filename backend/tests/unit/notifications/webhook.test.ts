import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendCoachNotificationWebhook } from '../../../src/lib/notifications/webhook.js';

describe('Discord Coach Notification Webhook', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should send formatted Discord webhook with message content and rich embed', async () => {
    process.env.COACH_WEBHOOK_URL =
      'https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz';
    process.env.APP_BASE_URL = 'https://app.goodnumbers.health';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    });
    globalThis.fetch = fetchMock;

    const result = await sendCoachNotificationWebhook({
      journalId: 'journal-xyz',
      primaryClusterTitle: 'Post-Lunch Highs',
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.username).toBe('GoodNumbers Quick Coach');
    expect(body.content).toContain('⚡ Your GoodNumbers Quick Coach is ready!');
    expect(body.content).toContain('Post-Lunch Highs');
    expect(body.content).toContain(
      'https://app.goodnumbers.health/coach/journal-xyz',
    );
    expect(body.embeds).toBeDefined();
    expect(Array.isArray(body.embeds)).toBe(true);
    expect(body.embeds[0].title).toBe('⚡ GoodNumbers Quick Coach');
    expect(body.embeds[0].url).toBe(
      'https://app.goodnumbers.health/coach/journal-xyz',
    );
    expect(body.embeds[0].description).toContain('Post-Lunch Highs');
    expect(body.embeds[0].color).toBe(14251867); // Mesa terracotta #D9775B
  });

  it('should gracefully skip sending without error if COACH_WEBHOOK_URL is not configured', async () => {
    delete process.env.COACH_WEBHOOK_URL;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const result = await sendCoachNotificationWebhook({
      journalId: 'journal-xyz',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('COACH_WEBHOOK_URL not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should handle webhook network errors gracefully and not throw', async () => {
    process.env.COACH_WEBHOOK_URL = 'https://discord.com/api/webhooks/fail';
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await sendCoachNotificationWebhook({
      journalId: 'journal-xyz',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('Network offline');
  });

  it('should handle non-2xx response from Discord and return error result', async () => {
    process.env.COACH_WEBHOOK_URL =
      'https://discord.com/api/webhooks/bad-request';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await sendCoachNotificationWebhook({
      journalId: 'journal-xyz',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('HTTP error 400');
  });
});
