export interface CoachWebhookPayload {
  journalId: string;
  primaryClusterTitle?: string;
}

export interface CoachWebhookResult {
  sent: boolean;
  reason?: string;
  error?: string;
}

/**
 * Sends a notification to the configured Discord channel with the Quick Coach magic link.
 */
export async function sendCoachNotificationWebhook(
  payload: CoachWebhookPayload,
): Promise<CoachWebhookResult> {
  const webhookUrl = process.env.COACH_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      '[CoachWebhook] COACH_WEBHOOK_URL not configured. Skipping notification.',
    );
    return { sent: false, reason: 'COACH_WEBHOOK_URL not configured' };
  }

  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000';
  const coachUrl = `${baseUrl.replace(/\/$/, '')}/coach/${payload.journalId}`;

  const message = payload.primaryClusterTitle
    ? `⚡ Your GoodNumbers Quick Coach is ready! Focusing on **${payload.primaryClusterTitle}**.\nReview the data story and set next week's micro-habit: ${coachUrl}`
    : `⚡ Your GoodNumbers Quick Coach is ready for this week!\nReview the data story and set next week's micro-habit: ${coachUrl}`;

  const bodyData = {
    username: 'GoodNumbers Quick Coach',
    content: message,
    embeds: [
      {
        title: '⚡ GoodNumbers Quick Coach',
        url: coachUrl,
        description: payload.primaryClusterTitle
          ? `Your weekly glycemic review is ready, focusing on **${payload.primaryClusterTitle}**.\n\nTake 2 minutes to review your animated data story and lock in next week's habit.`
          : "Your weekly glycemic review is ready. Take 2 minutes to review your animated data story and lock in next week's habit.",
        color: 14251867, // Mesa terracotta #D9775B
        fields: [
          {
            name: 'Quick Coach Session',
            value: `[Launch Coaching Session](${coachUrl})`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      console.warn(
        `[CoachWebhook] Discord webhook responded with status ${response.status}`,
      );
      return {
        sent: false,
        error: `HTTP error ${response.status}`,
      };
    }

    console.log(
      `[CoachWebhook] Successfully notified Discord for journal ${payload.journalId}`,
    );
    return { sent: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[CoachWebhook] Failed to send Discord webhook:`,
      errorMessage,
    );
    return {
      sent: false,
      error: errorMessage,
    };
  }
}
