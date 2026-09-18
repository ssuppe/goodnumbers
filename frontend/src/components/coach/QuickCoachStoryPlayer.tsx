import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import {
  type GlycemicEventCluster,
  type QuickCoachStory,
} from "@goodnumbers/types";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface QuickCoachStoryPlayerProps {
  cluster: GlycemicEventCluster;
  onStoryEnd?: () => void;
}

export default function QuickCoachStoryPlayer({
  cluster,
  onStoryEnd,
}: QuickCoachStoryPlayerProps) {
  const chartRef = useRef<ReactECharts>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [activeCueIndex, setActiveCueIndex] = useState<number>(-1);
  const timerRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);

  const story: QuickCoachStory = useMemo(() => {
    const rawAi = cluster.aiInsight as Record<string, unknown> | null;
    return (
      (rawAi?.quickCoachStory as QuickCoachStory) || {
        audio_script: `Here is your recurring ${cluster.eventType === "hyper" ? "highs" : "lows"} pattern this week.`,
        animation_cues: [
          { time_ms: 0, action: "DRAW_MEAN", label: "Average Trend" },
          {
            time_ms: 3000,
            action: "DRAW_DAY",
            day_index: 0,
            label: "Daily Trace",
          },
          {
            time_ms: 5000,
            action: "DRAW_TREATMENTS",
            day_index: 0,
            label: "Treatments",
          },
        ],
      }
    );
  }, [cluster.aiInsight, cluster.eventType]);

  const totalDurationMs = useMemo(() => {
    const lastCue = story.animation_cues[story.animation_cues.length - 1];
    return Math.max(lastCue ? lastCue.time_ms + 4000 : 8000, 6000);
  }, [story]);

  // Parse cues up to current time
  const visibleCues = useMemo(() => {
    return story.animation_cues.filter((c) => c.time_ms <= currentTimeMs);
  }, [story.animation_cues, currentTimeMs]);

  const hasDrawMean = visibleCues.some((c) => c.action === "DRAW_MEAN");
  const drawnDaysCount = visibleCues.filter(
    (c) => c.action === "DRAW_DAY",
  ).length;
  const hasTreatments = visibleCues.some((c) => c.action === "DRAW_TREATMENTS");

  // Handle SpeechSynthesis & Clock
  const handlePlay = () => {
    if (isCompleted) {
      updateCurrentTime(0);
      setActiveCueIndex(-1);
      setIsCompleted(false);
    }
    setIsPlaying(true);

    if (
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
    ) {
      if (window.speechSynthesis.paused && !isCompleted) {
        window.speechSynthesis.resume();
      } else {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(
          story.audio_script,
        );
        utterance.rate = 1.0;
        utterance.onend = () => {
          setIsPlaying(false);
          setIsCompleted(true);
          if (onStoryEnd) onStoryEnd();
        };
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  };

  const updateCurrentTime = (time: number) => {
    currentTimeRef.current = time;
    setCurrentTimeMs(time);
  };

  const handleReplay = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    updateCurrentTime(0);
    setActiveCueIndex(-1);
    setIsCompleted(false);
    handlePlay();
  };

  useEffect(() => {
    if (isPlaying) {
      const startTime = Date.now() - currentTimeRef.current;
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        currentTimeRef.current = elapsed;
        setCurrentTimeMs(elapsed);

        // Find active cue
        const currentCueIdx = story.animation_cues.reduce((acc, cue, idx) => {
          return cue.time_ms <= elapsed ? idx : acc;
        }, -1);
        setActiveCueIndex(currentCueIdx);

        if (elapsed >= totalDurationMs) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsPlaying(false);
          setIsCompleted(true);
          if (onStoryEnd) onStoryEnd();
        }
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalDurationMs, onStoryEnd, story.animation_cues]);

  // Build ECharts Options dynamically based on visible cues
  const chartOption = useMemo(() => {
    // Relative time slots (0 to 180 min offset)
    const timeLabels = ["0m", "30m", "60m", "90m", "120m", "150m", "180m"];
    const isHyper = cluster.eventType === "hyper";

    // Baseline Mean Trendline data
    const meanData = isHyper
      ? [130, 155, 195, 230, 215, 185, 150]
      : [110, 95, 68, 55, 62, 85, 105];

    // Daily traces
    const dayTraces = [
      isHyper
        ? [125, 160, 210, 245, 220, 190, 160]
        : [115, 90, 65, 50, 58, 80, 100],
      isHyper
        ? [135, 150, 185, 220, 205, 175, 145]
        : [105, 98, 72, 60, 68, 90, 110],
      isHyper
        ? [128, 158, 190, 235, 225, 195, 155]
        : [112, 92, 66, 54, 60, 82, 102],
    ];

    const series: Array<Record<string, unknown>> = [];

    // Target Range Area (70 - 180)
    series.push({
      name: "Target Range",
      type: "line",
      markArea: {
        silent: true,
        itemStyle: {
          color: "rgba(84, 166, 122, 0.08)",
        },
        data: [[{ yAxis: 70, name: "Target Range" }, { yAxis: 180 }]],
      },
      data: [],
    });

    // 1. Mean Series
    if (hasDrawMean) {
      series.push({
        name: "Average Trend",
        type: "line",
        smooth: true,
        lineStyle: {
          color: isHyper ? "#D9775B" : "#8A4F7D",
          width: 4,
          shadowColor: "rgba(0,0,0,0.15)",
          shadowBlur: 8,
        },
        itemStyle: {
          color: isHyper ? "#D9775B" : "#8A4F7D",
        },
        data: meanData,
        animationDuration: 1200,
      });
    }

    // 2. Stacked Daily Traces
    dayTraces.slice(0, drawnDaysCount).forEach((trace, idx) => {
      series.push({
        name: `Day ${idx + 1}`,
        type: "line",
        smooth: true,
        lineStyle: {
          color: isHyper
            ? "rgba(217, 119, 91, 0.4)"
            : "rgba(138, 79, 125, 0.4)",
          width: 2,
          type: "dashed",
        },
        showSymbol: false,
        data: trace,
        animationDuration: 800,
      });
    });

    // 3. Treatment MarkPoints
    if (hasTreatments) {
      series.push({
        name: "Treatments",
        type: "line",
        data: [],
        markPoint: {
          symbol: "pin",
          symbolSize: 32,
          itemStyle: {
            color: "#2C4C5B",
          },
          label: {
            fontSize: 9,
            color: "#fff",
            fontWeight: "bold",
          },
          data: [
            { name: "Bolus", value: "4.5u", coord: [1, isHyper ? 160 : 90] },
            { name: "Carbs", value: "50g", coord: [0, isHyper ? 125 : 115] },
          ],
        },
      });
    }

    return {
      grid: {
        top: 20,
        right: 15,
        bottom: 25,
        left: 35,
      },
      xAxis: {
        type: "category",
        data: timeLabels,
        axisLine: { lineStyle: { color: "#E8E1D9" } },
        axisLabel: { color: "#8C827A", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        min: 40,
        max: isHyper ? 280 : 200,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#F0ECE6" } },
        axisLabel: { color: "#8C827A", fontSize: 10 },
      },
      series,
      animationDurationUpdate: 600,
      animationEasingUpdate: "cubicOut",
    };
  }, [cluster.eventType, hasDrawMean, drawnDaysCount, hasTreatments]);

  const activeCue = story.animation_cues[activeCueIndex];
  const progressPercent = Math.min(
    (currentTimeMs / totalDurationMs) * 100,
    100,
  );

  return (
    <div
      data-testid="quick-coach-story-player"
      className="bg-white rounded-2xl p-4 border border-[#E8E1D9] shadow-sm space-y-4"
    >
      {/* Visual Header & Active Cue Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4C5B]">
          <Volume2 className="w-4 h-4 text-[#D9775B]" />
          <span>Audio-Visual Data Story</span>
        </div>
        {activeCue && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2C4C5B]/10 text-[#2C4C5B] animate-pulse">
            <Sparkles className="w-3 h-3 text-[#D9775B]" />{" "}
            {activeCue.label || activeCue.action}
          </span>
        )}
      </div>

      {/* ECharts Canvas Container */}
      <div
        data-testid="echarts-story-container"
        className="w-full h-56 rounded-xl bg-[#FBF9F5] border border-[#E8E1D9]/60 overflow-hidden relative"
      >
        <ReactECharts
          ref={chartRef}
          option={chartOption}
          style={{ height: "100%", width: "100%" }}
          notMerge={false}
          lazyUpdate={true}
        />
        {!hasDrawMean && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Tap Play to listen and watch your glycemic trend stack
            </p>
          </div>
        )}
      </div>

      {/* Spoken Narration Subtitle Box */}
      <div className="bg-[#FBF9F5] rounded-xl p-3 border border-[#E8E1D9]/70 text-xs text-gray-700 leading-relaxed italic">
        "{story.audio_script}"
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#D9775B] transition-all duration-100 ease-linear rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-medium text-gray-400">
          <span>{Math.round(currentTimeMs / 1000)}s</span>
          <span>{Math.round(totalDurationMs / 1000)}s</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            aria-label="Play Story"
            data-testid="play-story-btn"
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#2C4C5B] text-white font-bold text-xs shadow hover:bg-[#233c48] active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isCompleted ? "Replay Story" : "Play Data Story"}
          </button>
        ) : (
          <button
            onClick={handlePause}
            aria-label="Pause Story"
            className="flex-1 py-2.5 px-4 rounded-xl bg-gray-200 text-gray-800 font-bold text-xs hover:bg-gray-300 transition-all flex items-center justify-center gap-1.5"
          >
            <Pause className="w-3.5 h-3.5 fill-current" /> Pause
          </button>
        )}

        <button
          onClick={handleReplay}
          aria-label="Restart"
          className="p-2.5 rounded-xl border border-[#E8E1D9] text-gray-600 hover:bg-gray-50 transition-colors"
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
