'use client'; // Client-side rendering for Tideline

import React, { useEffect, useRef } from 'react';
import { EventEmitter } from 'events'; // Correct import for EventEmitter
import * as d3 from 'd3';
import { TidelineChartType, TidelineConfig } from './tideline-chart-spec';
import { TidelineChart } from 'tideline';
// import tideline, { TidelineChart, TidelineConfig, TidelineChartType } from 'tideline'; // Import Tideline and types
const tideline = require('tideline');

interface TidelineChartComponentProps {
  config: TidelineConfig;
  data: any; // Replace 'any' with a more specific type for your data if possible
}

const TidelineChartComponent: React.FC<TidelineChartComponentProps> = ({ config, data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<TidelineChart | null>(null); // useRef to hold the chart instance

  useEffect(() => {
    const chartElement = chartContainerRef.current;
    if (!chartElement) {
      console.error('Chart container element not found.');
      return;
    }

    // Create event emitter (required by Tideline)
    const emitter = new EventEmitter();

    // Create the chart instance based on config.type
    let chart: TidelineChart | null = null;
    try {
      if (config.type === TidelineChartType.DAILY) {
        chart = tideline.oneDay(emitter, config);
      } else if (config.type === TidelineChartType.WEEKLY) {
        chart = tideline.twoWeek(emitter, config);
      } else {
        console.error('Invalid chart type specified in config.');
        return;
      }
      chartRef.current = chart; // Store chart instance in ref

      // Load data into the chart
      chart!.load(data); // Assuming 'data' prop contains the data for tideline

      // Render the chart using D3
      if (chart) {
        // Add this conditional check
        d3.select(chartElement).call(chart);
      }
    } catch (error) {
      console.error('Error creating or rendering Tideline chart:', error);
      return; // Exit early if chart creation/rendering fails
    }

    // Event listeners can be added here if needed, e.g.:
    emitter.on('navigated', (domain: any) => {
      console.log('Chart Navigated:', domain);
    });

    // Cleanup function (componentWillUnmount)
    return () => {
      if (chartRef.current && chartRef.current.destroy) {
        chartRef.current.destroy(); // Destroy the chart instance on unmount
        chartRef.current = null; // Clear the ref
      }
      emitter.removeAllListeners(); // Clean up event listeners
    };
  }, [config, data]); // React to config and data changes

  return <div id={config.id} style={{ width: config.width, height: config.height }} ref={chartContainerRef} />;
};

export default TidelineChartComponent;
