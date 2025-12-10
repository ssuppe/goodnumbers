import React from 'react';
import { AgpChart, type AgpDataPoint } from './charts/AgpChart';
import { type GlucoseUnit } from '../../lib/agpUtils';
import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react';

export interface Insight {
  priority: 'CRITICAL' | 'SERIOUS' | 'IMPORTANT' | 'ALWAYS_INCLUDE' | string;
  note: string;
}

interface ChartAnalysisCardProps {
  title: string;
  subtitle?: string;
  data: AgpDataPoint[];
  units: GlucoseUnit;
  insights: Insight[];
  patientLowGoal?: number;
  patientHighGoal?: number;
}

export function ChartAnalysisCard({ 
  title, 
  subtitle, 
  data, 
  units, 
  insights, 
  patientLowGoal, 
  patientHighGoal 
}: ChartAnalysisCardProps) {
  
  const getIcon = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'SERIOUS': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'IMPORTANT': return <Info className="w-5 h-5 text-blue-500" />;
      case 'ALWAYS_INCLUDE':
      default: return <Lightbulb className="w-5 h-5 text-gray-500" />;
    }
  };

  const getBgColor = (priority: string) => {
     switch (priority) {
      case 'CRITICAL': return 'bg-red-50 border-red-100 text-red-900';
      case 'SERIOUS': return 'bg-amber-50 border-amber-100 text-amber-900';
      default: return 'bg-white border-transparent';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        
        <div className="mt-6">
          <AgpChart 
            data={data} 
            units={units} 
            patientLowGoal={patientLowGoal} 
            patientHighGoal={patientHighGoal} 
          />
        </div>

        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Analysis & Insights</h4>
          
          {insights && insights.length > 0 ? (
            <ul className="space-y-2">
              {insights.map((insight, idx) => (
                <li 
                  key={idx} 
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getBgColor(insight.priority)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(insight.priority)}
                  </div>
                  <span className="text-sm leading-relaxed">
                    {insight.note}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 italic">No specific insights available for this period.</p>
          )}
        </div>
      </div>
    </div>
  );
}
