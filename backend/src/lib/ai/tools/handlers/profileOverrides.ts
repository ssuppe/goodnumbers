import { DateTime } from 'luxon';
import {
  ToolExecutionContext,
  getCachedNightscoutTreatments,
} from '../dispatcher.js';

export async function handleProfileOverrides(
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<Record<string, unknown>> {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 14);
  const zone = context.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  const from = now.minus({ days }).startOf('day');

  // 1. Fetch Profile
  let activeProfileName = 'Default / Unknown';
  let activeBasalSummary = 'Basal schedule not found';

  try {
    const profiles = await context.nsClient.fetchProfile();
    if (profiles && profiles.length > 0) {
      const p = profiles[0];
      const defaultName = p.defaultProfile || Object.keys(p.store || {})[0];
      if (defaultName && p.store && p.store[defaultName]) {
        activeProfileName = defaultName;
        const profileData = p.store[defaultName];
        if (profileData.basal && profileData.basal.length > 0) {
          const basalVals = profileData.basal.map((b) => b.value);
          const minB = Math.min(...basalVals);
          const maxB = Math.max(...basalVals);
          activeBasalSummary =
            minB === maxB
              ? `${minB} u/hr flat`
              : `range ${minB} - ${maxB} u/hr across day`;
        }
      }
    }
  } catch (err) {
    console.warn('[Tool: profileOverrides] Failed to fetch profile:', err);
  }

  // 2. Fetch Treatments for Overrides and Switches
  const recentSwitches: Array<{
    timestamp: string;
    event: string;
    details: string;
  }> = [];

  try {
    const treatments = await getCachedNightscoutTreatments(
      context,
      from.toJSDate(),
      now.toJSDate(),
    );

    const targetEvents = ['profile switch', 'temp target', 'override'];

    for (const t of treatments) {
      const evType = (t.eventType || '').toLowerCase();
      const isTarget = targetEvents.some((tgt) => evType.includes(tgt));

      if (isTarget) {
        const timeStr =
          t.created_at || (t.date ? new Date(t.date).toISOString() : '');
        const details =
          t.notes ||
          (t.duration ? `Duration: ${t.duration} mins` : t.eventType);

        recentSwitches.push({
          timestamp: timeStr,
          event: t.eventType,
          details,
        });
      }
    }
  } catch (err) {
    console.warn('[Tool: profileOverrides] Failed to fetch treatments:', err);
  }

  return {
    activeProfileName,
    activeBasalSummary,
    recentSwitches,
  };
}
