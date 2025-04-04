interface BasalEntry {
  minutes: number;
  rate: number;
  untuned?: number;
}

interface ISFProfile {
  sensitivities: Array<{
    sensitivity: number;
    // Add other ISF properties if needed
  }>;
}

interface ATProfileSettings {
  min_5m_carbimpact: number;
  dia: number;
  basalprofile: BasalEntry[];
  isfProfile: ISFProfile;
  carb_ratio: number;
  autosens_max: number;
  autosens_min: number;
}

function generateProfileComparison(pumpProfile: ATProfileSettings, autotuneProfile: ATProfileSettings): string {
  const paramWidth = 15;
  const dataWidth = 12;

  let output = '';

  // Header
  output += `${padEnd('Parameter', paramWidth)}| ${padEnd('Pump', dataWidth)}| ${padEnd('Autotune', dataWidth)}| ${padEnd('Days Missing', dataWidth)}\n`;
  output += '-'.repeat(paramWidth + dataWidth * 3 + 3) + '\n';

  // Parameters
  output += `${padEnd('ISF [mg/dL/U]', paramWidth)}| ${padEnd(pumpProfile.isfProfile.sensitivities[0].sensitivity.toFixed(3), dataWidth)}| ${padEnd(autotuneProfile.isfProfile.sensitivities[0].sensitivity.toFixed(3), dataWidth)}|\n`;
  output += `${padEnd('Carb Ratio[g/U]', paramWidth)}| ${padEnd(pumpProfile.carb_ratio.toFixed(3), dataWidth)}| ${padEnd(autotuneProfile.carb_ratio.toFixed(3), dataWidth)}|\n`;

  // Basals
  output += `${padEnd('Basals [U/hr]', paramWidth)}| ${padEnd('-', dataWidth)}| ${padEnd('', dataWidth)}| ${padEnd('', dataWidth)}\n`;

  // Generate time slots (00:00 to 23:30 in 30-minute increments)
  const timeSlots = generateTimeSlots();

  timeSlots.forEach(({ time, minutes }) => {
    const currentBasal = findBasalRate(pumpProfile.basalprofile, minutes);
    const newBasal = findBasalRate(autotuneProfile.basalprofile, minutes);
    const untuned = findUntunedCount(autotuneProfile.basalprofile, minutes);

    output += `  ${padEnd(time, paramWidth - 2)}| ${padEnd(currentBasal?.toFixed(3) ?? '', dataWidth)}| ${padEnd(newBasal?.toFixed(3) ?? '', dataWidth)}| ${padEnd(untuned?.toString() ?? '', dataWidth)}\n`;
  });

  return output;
}

function generateTimeSlots() {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const minutes = hour * 60 + minute;
      slots.push({ time, minutes });
    }
  }
  return slots;
}

function findBasalRate(basalProfile: BasalEntry[], targetMinutes: number): number | undefined {
  const entry = basalProfile.find((entry) => entry.minutes === targetMinutes);
  return entry?.rate;
}

function findUntunedCount(basalProfile: BasalEntry[], targetMinutes: number): number | undefined {
  const entry = basalProfile.find((entry) => entry.minutes === targetMinutes);
  return entry?.untuned;
}

function padEnd(str: string | number, length: number): string {
  return String(str).padEnd(length);
}

// Usage example:
export function compareProfiles(pumpProfile: ATProfileSettings, autotuneProfile: ATProfileSettings) {
  const report = generateProfileComparison(pumpProfile, autotuneProfile);
  console.log(report);
  return report;
}
