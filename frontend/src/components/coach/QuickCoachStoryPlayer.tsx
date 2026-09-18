import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import ReactECharts from "echarts-for-react";
import {
  type GlycemicEventCluster,
  type GlycemicCluster,
  type GlycemicEvent,
  type GlucoseReading,
  type QuickCoachStory,
} from "@goodnumbers/types";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  getClinicalThresholds,
  convertGlucose,
  type GlucoseUnit,
  type Treatment,
} from "../../lib/agpUtils";
import { CHART_THEME } from "../../lib/chartTheme";
import {
  getBoundaryHour,
  normalizeTime,
  formatAxisLabel,
  getLocalWallClockDate,
  calculateCommonDomain,
} from "../journal/charts/chartUtils";

interface QuickCoachStoryPlayerProps {
  cluster: GlycemicEventCluster;
  treatments?: Treatment[];
  units?: GlucoseUnit;
  onStoryEnd?: () => void;
}

const eventColors = [
  "#1976d2", // Blue
  "#e76f51", // Burnt Sienna / Coral
  "#2a9d8f", // Teal
  "#6d597a", // Purple
  "#bc6c25", // Ochre
  "#457b9d", // Steel Blue
  "#264653", // Dark Teal
  "#5d4037", // Brown
];

const TREATMENT_BUFFER_MINUTES = 180;
const STEP_AUTO_ADVANCE_MS = 3500;

interface DayData {
  dayName: string;
  dateStr: string;
  color: string;
  glucoseData: [number, number][];
  carbsData: { value: [number, number]; originalValue: number }[];
  insulinData: { value: [number, number]; originalValue: number }[];
  startTimeStr: string;
  endTimeStr: string;
  peakGlucose: number;
}

interface StoryStep {
  index: number;
  label: string;
  shortName: string;
  narration: string;
  isMeanOnly: boolean;
  dayIndices: number[];
}

export default function QuickCoachStoryPlayer({
  cluster,
  treatments = [],
  units = "MMOL",
  onStoryEnd,
}: QuickCoachStoryPlayerProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const autoPlayTimerRef = useRef<number | null>(null);

  const isMmol = units === "MMOL";
  const normalizedUnits = (isMmol ? "MMOL" : "MGDL") as GlucoseUnit;
  const thresholds = getClinicalThresholds(normalizedUnits);
  const isHyper = cluster.eventType === "hyper";

  // 1. Process Cluster Events and Treatments into Organized Days
  const { days, meanTrendline, commonDomain } = useMemo(() => {
    // clusterDataJson is Prisma Json but is shaped as GlycemicCluster
    const clusterObj = cluster.clusterDataJson as unknown as GlycemicCluster;
    const rawEvents: GlycemicEvent[] = clusterObj?.events ?? [];

    const validEvents = rawEvents
      .filter((e) => e.readings && e.readings.length >= 2)
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    // Collect treatment timestamps to calculate boundary hour
    const relevantTreatmentTimestamps: string[] = [];
    if (treatments.length > 0 && validEvents.length > 0) {
      validEvents.forEach((ev) => {
        const start = new Date(ev.startTime).getTime();
        const end = new Date(ev.endTime).getTime();
        treatments.forEach((t) => {
          const tTime = new Date(t.date).getTime();
          if (
            ((t.carbs && t.carbs > 0) || (t.insulin && t.insulin > 0)) &&
            tTime >= start - TREATMENT_BUFFER_MINUTES * 60000 &&
            tTime <= end + TREATMENT_BUFFER_MINUTES * 60000
          ) {
            relevantTreatmentTimestamps.push(
              typeof t.date === "number"
                ? new Date(t.date).toISOString()
                : t.date,
            );
          }
        });
      });
    }

    const bHour = getBoundaryHour(clusterObj, relevantTreatmentTimestamps);

    // Group Events by Day
    const dayMap = new Map<string, DayData>();
    let dayCounter = 0;

    validEvents.forEach((event: GlycemicEvent) => {
      const wallDate = getLocalWallClockDate(event.startTime);
      const dayName = format(wallDate, "EEEE");
      const dateStr = format(wallDate, "EEE, MMM d");
      const key = format(wallDate, "yyyy-MM-dd");

      if (!dayMap.has(key)) {
        const color = eventColors[dayCounter % eventColors.length];
        dayCounter++;

        const startLocal = getLocalWallClockDate(event.startTime);
        const endLocal = getLocalWallClockDate(event.endTime);

        dayMap.set(key, {
          dayName,
          dateStr,
          color,
          glucoseData: [],
          carbsData: [],
          insulinData: [],
          startTimeStr: format(startLocal, "h:mm a"),
          endTimeStr: format(endLocal, "h:mm a"),
          peakGlucose: 0,
        });
      }

      const dayRecord = dayMap.get(key)!;
      const normalizedStartTime = normalizeTime(event.startTime, bHour);
      const eventStartMs = new Date(event.startTime).getTime();
      const eventEndMs = new Date(event.endTime).getTime();

      // Readings
      event.readings?.forEach((r: GlucoseReading) => {
        const rTime = new Date(r.timestamp).getTime();
        const offset = rTime - eventStartMs;
        const normTime = normalizedStartTime + offset;
        const val = convertGlucose(r.value, normalizedUnits);
        if (!isNaN(normTime) && !isNaN(val)) {
          dayRecord.glucoseData.push([normTime, val]);
          if (val > dayRecord.peakGlucose) {
            dayRecord.peakGlucose = val;
          }
        }
      });

      // Treatments around this event
      const searchStart = eventStartMs - TREATMENT_BUFFER_MINUTES * 60000;
      const searchEnd = eventEndMs + TREATMENT_BUFFER_MINUTES * 60000;

      treatments.forEach((t) => {
        const tTime = new Date(t.date).getTime();
        if (tTime >= searchStart && tTime <= searchEnd) {
          const offset = tTime - eventStartMs;
          const normTime = normalizedStartTime + offset;

          if (t.carbs && t.carbs > 0) {
            // Avoid duplicate carb markers
            if (!dayRecord.carbsData.some((c) => c.value[0] === normTime)) {
              dayRecord.carbsData.push({
                value: [normTime, t.carbs],
                originalValue: t.carbs,
              });
            }
          }
          if (t.insulin && t.insulin > 0) {
            if (
              !dayRecord.insulinData.some((ins) => ins.value[0] === normTime)
            ) {
              dayRecord.insulinData.push({
                value: [normTime, t.insulin],
                originalValue: t.insulin,
              });
            }
          }
        }
      });
    });

    const daysList = Array.from(dayMap.values());
    daysList.forEach((d) => {
      d.glucoseData.sort((a, b) => a[0] - b[0]);
      d.carbsData.sort((a, b) => a.value[0] - b.value[0]);
      d.insulinData.sort((a, b) => a.value[0] - b.value[0]);
    });

    // Calculate Common Domain for sync
    const allSeriesDataForDomain: { data: { value: (number | string)[] }[] }[] =
      [];
    daysList.forEach((d) => {
      allSeriesDataForDomain.push({
        data: d.glucoseData.map(([time, val]) => ({ value: [time, val] })),
      });
      allSeriesDataForDomain.push({
        data: d.carbsData.map((c) => ({ value: c.value })),
      });
      allSeriesDataForDomain.push({
        data: d.insulinData.map((i) => ({ value: i.value })),
      });
    });

    const cDomain = calculateCommonDomain(allSeriesDataForDomain, 30) || {
      min: normalizeTime("2026-06-18T18:00:00Z", bHour),
      max: normalizeTime("2026-06-18T23:30:00Z", bHour),
    };

    // Calculate Mean Trendline
    const meanPoints: [number, number][] = [];
    if (daysList.length > 0 && cDomain) {
      const stepMs = 15 * 60 * 1000; // 15-minute intervals
      for (let t = cDomain.min; t <= cDomain.max; t += stepMs) {
        const valuesAtTime: number[] = [];
        daysList.forEach((d) => {
          // Find closest reading within 25 minutes
          let closestVal: number | null = null;
          let minDiff = 25 * 60 * 1000;
          d.glucoseData.forEach(([ptTime, ptVal]) => {
            const diff = Math.abs(ptTime - t);
            if (diff < minDiff) {
              minDiff = diff;
              closestVal = ptVal;
            }
          });
          if (closestVal !== null) {
            valuesAtTime.push(closestVal);
          }
        });

        if (valuesAtTime.length > 0) {
          const avg =
            valuesAtTime.reduce((sum, v) => sum + v, 0) / valuesAtTime.length;
          meanPoints.push([t, Math.round(avg * 10) / 10]);
        }
      }
    }

    return {
      days: daysList,
      boundaryHour: bHour,
      meanTrendline: meanPoints,
      commonDomain: cDomain,
    };
  }, [cluster.clusterDataJson, treatments, normalizedUnits]);

  // 2. Build Multistep Story Definitions (Day-by-Day Progression)
  const steps: StoryStep[] = useMemo(() => {
    const rawAi = cluster.aiInsight as Record<string, unknown> | null;
    const existingStory = rawAi?.quickCoachStory as QuickCoachStory | undefined;
    const startHour = Math.floor(cluster.meanTimeMinutes / 60);
    const startMin = (cluster.meanTimeMinutes % 60).toString().padStart(2, "0");
    const patternTimeStr = `${startHour}:${startMin}`;

    const stepList: StoryStep[] = [];

    // Step 0: Mean only (Blood glucose only)
    stepList.push({
      index: 0,
      label: "Average Trend",
      shortName: "Mean",
      narration:
        existingStory?.audio_script ||
        `Let's look at your recurring ${isHyper ? "highs" : "lows"} pattern this week. On average, blood sugar climbed around ${patternTimeStr}. Notice the steady upward drift.`,
      isMeanOnly: true,
      dayIndices: [],
    });

    // Step 1 to N: Day by Day
    days.forEach((d, idx) => {
      const stepNum = idx + 1;
      const isFirst = idx === 0;
      const daysIncluded = Array.from({ length: idx + 1 }, (_, i) => i);

      const introPhrase = isFirst
        ? `Let's take it day by day. First, let's look at ${d.dayName}.`
        : `Then let's look at ${d.dayName}, very similar.`;

      const timeRangePhrase =
        d.startTimeStr && d.endTimeStr
          ? `You can see that you were high from ${d.startTimeStr} to ${d.endTimeStr}`
          : `Notice the sharp rise in blood sugar`;

      const treatmentPhrase =
        d.carbsData.length > 0
          ? ` following dinner carbs and insulin.`
          : ` following your evening meal.`;

      stepList.push({
        index: stepNum,
        label: `${d.dayName}: Trace & Treatments`,
        shortName: d.dayName.slice(0, 3),
        narration: `${introPhrase} ${timeRangePhrase}${treatmentPhrase}`,
        isMeanOnly: false,
        dayIndices: daysIncluded,
      });
    });

    // Final Reflection Step
    stepList.push({
      index: stepList.length,
      label: "Ready for Reflection",
      shortName: "Wrap-up",
      narration: `Notice how across these days, extended evening eating outlasted the initial insulin doses. Ready to choose a simple micro-habit to smooth out these evenings?`,
      isMeanOnly: false,
      dayIndices: days.map((_, i) => i),
    });

    return stepList;
  }, [cluster.meanTimeMinutes, cluster.aiInsight, isHyper, days]);

  const currentStep = steps[currentStepIndex] || steps[0];
  const hasTreatmentsData = days.some(
    (d) => d.carbsData.length > 0 || d.insulinData.length > 0,
  );

  // 3. Build Dynamic 3-Grid ECharts Options based on Current Step
  const chartOption = useMemo(() => {
    const series: Array<Record<string, unknown>> = [];
    const LEFT_MARGIN = 55;
    const RIGHT_MARGIN = 15;
    const TITLE_GAP = 30;

    // A. Mean Trendline (Grid 0 - Glucose)
    series.push({
      name: "Average Trend",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      data: meanTrendline,
      showSymbol: false,
      lineStyle: {
        color: "#D9775B",
        width: currentStep.isMeanOnly ? 4 : 2.5,
        type: currentStep.isMeanOnly ? "solid" : "dashed",
        shadowColor: "rgba(217, 119, 91, 0.3)",
        shadowBlur: currentStep.isMeanOnly ? 8 : 0,
      },
      itemStyle: { color: "#D9775B" },
      animationDuration: 1000,
      markLine: {
        silent: true,
        symbol: "none",
        data: [
          {
            yAxis: thresholds.high,
            lineStyle: { color: CHART_THEME.clinicalHigh, type: "dashed" },
          },
          {
            yAxis: thresholds.low,
            lineStyle: { color: CHART_THEME.clinicalLow, type: "dashed" },
          },
        ],
      },
    });

    // B. Daily Traces & Bar Treatments based on Current Step
    if (!currentStep.isMeanOnly) {
      currentStep.dayIndices.forEach((dayIdx) => {
        const d = days[dayIdx];
        if (!d) return;

        // 1. Glucose Line
        series.push({
          name: `${d.dayName} Glucose`,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: d.glucoseData,
          showSymbol: false,
          smooth: true,
          lineStyle: { color: d.color, width: 3 },
          itemStyle: { color: d.color },
          animationDuration: 900,
        });

        // 2. Carbs Bars (Grid 1)
        if (d.carbsData.length > 0) {
          series.push({
            name: `${d.dayName} Carbs`,
            type: "bar",
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: d.carbsData.map((c) => c.value),
            itemStyle: {
              color: d.color,
              opacity: 0.85,
              borderRadius: [3, 3, 0, 0],
            },
            barWidth: 7,
            animationDuration: 800,
          });
        }

        // 3. Insulin Bars (Grid 2)
        if (d.insulinData.length > 0) {
          series.push({
            name: `${d.dayName} Insulin`,
            type: "bar",
            xAxisIndex: 2,
            yAxisIndex: 2,
            data: d.insulinData.map((i) => i.value),
            itemStyle: {
              color: d.color,
              opacity: 0.85,
              borderRadius: [3, 3, 0, 0],
            },
            barWidth: 7,
            animationDuration: 800,
          });
        }
      });
    }

    // Grid Layout
    const grid: object[] = [
      {
        top: "8%",
        left: LEFT_MARGIN,
        right: RIGHT_MARGIN,
        height: hasTreatmentsData ? "45%" : "80%",
        containLabel: false,
      },
    ];

    const xAxis: object[] = [
      {
        type: "value",
        gridIndex: 0,
        min: commonDomain.min,
        max: commonDomain.max,
        axisLabel: {
          formatter: (v: number) => formatAxisLabel(v),
          color: "#8C827A",
          fontSize: 10,
        },
        splitLine: { show: false },
        axisLine: { lineStyle: { color: "#E8E1D9" } },
      },
    ];

    const yAxis: object[] = [
      {
        type: "value",
        gridIndex: 0,
        name: `Glucose (${isMmol ? "mmol/L" : "mg/dL"})`,
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: TITLE_GAP,
        nameTextStyle: { color: "#8C827A", fontSize: 9, fontWeight: 600 },
        splitLine: { lineStyle: { color: "#F0ECE6" } },
        axisLabel: { color: "#8C827A", fontSize: 9 },
        min: (v: { min: number }) => {
          const lower = Math.floor(v.min * 0.9);
          return isMmol ? Math.max(lower, 2) : Math.max(lower, 40);
        },
        max: (v: { max: number }) => Math.ceil(v.max * 1.1),
      },
    ];

    if (hasTreatmentsData) {
      // Middle Grid: Carbs
      grid.push({
        left: LEFT_MARGIN,
        right: RIGHT_MARGIN,
        top: "59%",
        height: "17%",
        containLabel: false,
      });
      xAxis.push({
        type: "value",
        gridIndex: 1,
        show: false,
        min: commonDomain.min,
        max: commonDomain.max,
      });
      yAxis.push({
        type: "value",
        gridIndex: 1,
        name: "Carbs (g)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: TITLE_GAP,
        nameTextStyle: { color: "#8C827A", fontSize: 8, fontWeight: 600 },
        splitLine: { show: false },
        axisLabel: { color: "#8C827A", fontSize: 8 },
      });

      // Bottom Grid: Insulin
      grid.push({
        left: LEFT_MARGIN,
        right: RIGHT_MARGIN,
        top: "80%",
        height: "16%",
        containLabel: false,
      });
      xAxis.push({
        type: "value",
        gridIndex: 2,
        show: false,
        min: commonDomain.min,
        max: commonDomain.max,
      });
      yAxis.push({
        type: "value",
        gridIndex: 2,
        name: "Insulin (u)",
        nameLocation: "middle",
        nameRotate: 90,
        nameGap: TITLE_GAP,
        nameTextStyle: { color: "#8C827A", fontSize: 8, fontWeight: 600 },
        splitLine: { show: false },
        axisLabel: { color: "#8C827A", fontSize: 8 },
      });
    }

    return {
      grid,
      xAxis,
      yAxis,
      series,
      axisPointer: {
        link: { xAxisIndex: "all" },
      },
      animationDurationUpdate: 600,
      animationEasingUpdate: "cubicOut",
    };
  }, [
    meanTrendline,
    currentStep,
    days,
    hasTreatmentsData,
    commonDomain,
    thresholds,
    isMmol,
  ]);

  // 4. Voice Narration Trigger
  const speakCurrentNarration = useCallback((text: string) => {
    if (
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
    ) {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Step Transition
  const goToStep = useCallback(
    (stepIdx: number) => {
      const target = Math.max(0, Math.min(stepIdx, steps.length - 1));
      setCurrentStepIndex(target);
      speakCurrentNarration(steps[target].narration);

      // Keep the top of the chart comfortably in view without clipping
      if (
        typeof window !== "undefined" &&
        typeof window.scrollTo === "function"
      ) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (target === steps.length - 1) {
        setIsCompleted(true);
        setIsPlaying(false);
        if (onStoryEnd) onStoryEnd();
      }
    },
    [steps, speakCurrentNarration, onStoryEnd],
  );

  const handleNextStep = () => {
    goToStep(currentStepIndex + 1);
  };

  const handlePrevStep = () => {
    goToStep(currentStepIndex - 1);
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    } else {
      setIsPlaying(true);
      if (currentStepIndex === steps.length - 1) {
        goToStep(0);
      } else {
        speakCurrentNarration(currentStep.narration);
      }
    }
  };

  const handleRestart = () => {
    goToStep(0);
    setIsPlaying(false);
    if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
  };

  // 5. Auto-advance steps when playing
  useEffect(() => {
    if (!isPlaying) return;

    if (currentStepIndex < steps.length - 1) {
      autoPlayTimerRef.current = window.setTimeout(() => {
        goToStep(currentStepIndex + 1);
      }, STEP_AUTO_ADVANCE_MS);
    } else {
      setIsPlaying(false);
    }

    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [isPlaying, currentStepIndex, steps.length, goToStep]);

  return (
    <div
      data-testid="quick-coach-story-player"
      className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E8E1D9] shadow-sm space-y-2.5"
    >
      {/* Header & Step Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4C5B]">
          <Volume2 className="w-3.5 h-3.5 text-[#D9775B]" />
          <span>Multistep Story Player</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2C4C5B]/10 text-[#2C4C5B] animate-pulse">
          <Sparkles className="w-3 h-3 text-[#D9775B]" /> {currentStep.label}
        </span>
      </div>

      {/* Step Pills Timeline */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {steps.map((s, idx) => {
          const isActive = idx === currentStepIndex;
          const isPassed = idx < currentStepIndex;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => goToStep(idx)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                isActive
                  ? "bg-[#D9775B] text-white shadow-sm scale-105"
                  : isPassed
                    ? "bg-[#2C4C5B]/15 text-[#2C4C5B]"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <span>{s.shortName}</span>
            </button>
          );
        })}
      </div>

      {/* 3-Grid ECharts Canvas Container */}
      <div
        ref={containerRef}
        data-testid="echarts-story-container"
        className="w-full h-[260px] rounded-xl bg-[#FBF9F5] border border-[#E8E1D9]/60 overflow-hidden relative"
      >
        <ReactECharts
          ref={chartRef}
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
          notMerge={false}
          lazyUpdate={true}
        />
      </div>

      {/* Spoken Narration Subtitle Box */}
      <div className="bg-[#FBF9F5] rounded-xl px-3 py-2 border border-[#E8E1D9]/70 text-xs text-gray-800 leading-relaxed italic transition-all duration-300 shadow-sm min-h-[44px] flex items-center">
        "{currentStep.narration}"
      </div>

      {/* Controls & Navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={currentStepIndex === 0}
          aria-label="Previous Step"
          className="p-2 rounded-xl border border-[#E8E1D9] text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handlePlayToggle}
          aria-label={
            isPlaying
              ? "Pause Story"
              : isCompleted
                ? "Replay Story"
                : "Play Story"
          }
          data-testid="play-story-btn"
          className="flex-1 py-2 px-3 rounded-xl bg-[#2C4C5B] text-white font-bold text-xs shadow hover:bg-[#233c48] active:scale-95 transition-all flex items-center justify-center gap-1.5"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" /> Pause Story
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              {isCompleted ? "Replay Story" : "Play Story"}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleNextStep}
          disabled={currentStepIndex === steps.length - 1}
          aria-label="Next Step"
          className="py-2 px-3 rounded-xl bg-[#2C4C5B]/10 text-[#2C4C5B] font-bold text-xs hover:bg-[#2C4C5B]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          <span className="text-[11px]">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleRestart}
          aria-label="Restart"
          className="p-2 rounded-xl border border-[#E8E1D9] text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {isCompleted && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 pl-1">
            <CheckCircle2 className="w-4 h-4" /> Ready for reflection
          </span>
        )}
      </div>
    </div>
  );
}
