Glucose Pattern Card: Component Specification1. Executive SummaryThe Glucose Pattern Card is a modular, reusable UI component designed to visualize specific blood glucose events (e.g., post-meal spikes, nocturnal hypoglycemia). It combines high-level metrics, detailed interactive charting, and AI-driven insights into a single vertical stack.This component is designed to be repeated multiple times on a "Daily Feed" or "Insights" page.2. UX Design Specifications2.1 Visual HierarchyThe card follows a strict vertical rhythm to guide the user's eye:Header (Context): Immediate identification of the event ("High Blood Sugar") and key metadata (Active Days, Average Duration).Visualization (Evidence): A clear, interactive chart proving the event occurred.Analysis (Insight): Textual explanation of why this matters (Spikes, Recovery Rates).Action (Recommendation): A distinct block suggesting a behavioral change.Interaction (Footer): A lightweight input field for user annotation.2.2 Color SystemWe use a semantic color palette based on standard utility classes (Tailwind CSS naming convention).ElementColorTailwind ClassHex ValuePurposePrimary TextSlate 900text-slate-900#0f172aHeadings, high contrast textSecondary TextSlate 500text-slate-500#64748bMetadata, labelsBordersSlate 200border-slate-200#e2e8f0Subtle separationBackgroundWhitebg-white#ffffffCard surfaceChart: Day 1Blue 500stroke-blue-500#3b82f6Data seriesChart: Day 2Purple 500stroke-purple-500#8b5cf6Data seriesChart: Day 3Emerald 500stroke-emerald-500#10b981Data seriesLimit LineRed 500stroke-red-500#ef4444Threshold indicatorRecommendationIndigobg-indigo-50#eef2ffdistinct action block2.3 TypographyFont Family: Sans-serif (Inter or system default).Card Title: text-lg font-bold (18px, Bold).Metric Label: text-sm font-medium (14px, Medium).Insight Title: text-sm font-semibold (14px, Semibold).Body Text: text-sm leading-relaxed (14px, Regular).3. Data Structure & PropsTo make this component modular, it should accept data via props rather than hardcoding it. Below is the recommended TypeScript interface.3.1 Interface Definitioninterface GlucoseDataPoint {
time: string;
[key: string]: number | string; // Dynamic keys for days (e.g., 'Mon 12': 120)
}

interface Insight {
type: 'warning' | 'info' | 'success';
title: string;
description: string;
icon: 'ArrowUpRight' | 'TrendingDown' | 'Activity';
}

interface GlucosePatternCardProps {
title: string;
metrics: {
activeDays: number;
avgDurationMin: number;
};
chartData: GlucoseDataPoint[];
dayKeys: string[]; // Array of keys to plot (e.g. ['Mon 12', 'Tue 13'])
threshold: number; // e.g., 140
insights: Insight[];
recommendation?: string;
} 4. Reference ImplementationBelow is the complete, functional React code. It uses recharts for visualization and lucide-react for iconography.Dependenciesreactrechartslucide-reacttailwindcss (for styling)Codebaseimport React, { useState } from 'react';
import {
LineChart, Line, XAxis, YAxis, CartesianGrid,
Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import {
MoreHorizontal, ArrowUpRight, TrendingDown,
Info, Calendar, Activity
} from 'lucide-react';

const GlucosePatternCard = () => {
const [noteText, setNoteText] = useState('');

// 1. Mock Data (Replace with Props in production)
const data = [
{ time: '00:00', 'Mon 12': 95, 'Tue 13': 98, 'Wed 14': 92 },
{ time: '08:00', 'Mon 12': 130, 'Tue 13': 110, 'Wed 14': 105 },
{ time: '14:00', 'Mon 12': 140, 'Tue 13': 135, 'Wed 14': 120 },
{ time: '20:00', 'Mon 12': 150, 'Tue 13': 160, 'Wed 14': 130 },
{ time: '23:59', 'Mon 12': 110, 'Tue 13': 120, 'Wed 14': 105 },
];

const dayColors = {
'Mon 12': '#3b82f6', // Blue
'Tue 13': '#8b5cf6', // Purple
'Wed 14': '#10b981', // Emerald
};

return (
<div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

      {/* --- HEADER SECTION --- */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-bold text-slate-900">
            High Blood Sugar event around 8:30 PM
          </h2>
          <button className="text-slate-400 hover:text-slate-600">
            <MoreHorizontal size={20} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-slate-400" />
            <span className="font-medium text-slate-700">3 Active Days</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-300"></div>
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-slate-400" />
            <span className="font-medium text-slate-700">45 min Avg Duration</span>
          </div>
        </div>
      </div>

      {/* --- CHART SECTION --- */}
      <div className="p-5">
        <div className="h-64 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />

              {Object.entries(dayColors).map(([day, color]) => (
                <Line
                  key={day}
                  type="monotone"
                  dataKey={day}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ))}
              <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* --- INSIGHTS SECTION --- */}
        <div className="space-y-3">
          {/* Insight 1 */}
          <div className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="p-2 bg-white rounded-md shadow-sm border border-slate-100 h-fit">
              <ArrowUpRight className="text-amber-600" size={18} />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm mb-1">Post-Meal Spikes Detected</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Consistent elevation observed approximately 2 hours after evening meals.
              </p>
            </div>
          </div>

          {/* Recommendation */}
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex gap-3">
            <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-indigo-900 text-sm block mb-1">Recommendation</span>
              <p className="text-sm text-indigo-800">
                Try a 15-minute walk after your 8:00 PM meal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- FOOTER ACTION --- */}
      <div className="px-5 py-4 bg-gray-50 border-t border-slate-100">
         <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Add a note about this event..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          {noteText && (
            <button className="absolute right-2 top-1.5 px-3 py-0.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 transition-colors">
              Save
            </button>
          )}
        </div>
      </div>
    </div>

);
};

export default GlucosePatternCard; 5. Implementation Notes for EngineersResponsiveness: The card uses w-full max-w-3xl, meaning it will fill the container width up to 768px (approx). It is fully fluid and safe for mobile viewports.Chart Height: The chart container is fixed at h-64 (256px). Do not make this percentage-based without a fixed-height parent, or Recharts will collapse to 0 height.Tooltip Styling: The Recharts tooltip defaults are overridden with inline styles to match the rounded-xl and shadow aesthetic of the card.Legend: The legend is customized with wrapperStyle={{ paddingTop: '20px' }} to ensure it doesn't overlap the X-axis labels.
