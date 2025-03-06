// src/factories/tideline-chart-factory.ts
import * as d3 from 'd3'; // This will be version 3.5.17
import { EventEmitter } from 'events';
import plot from 'tideline';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tideline = require('tideline');
const { oneDay } = tideline;
import { TidelineConfig } from '../tideline-chart-spec';
import { AssessmentInsight } from '~/types/nightscout';
import { TidelineData } from '../nightscoutToTideLine';

// load styles
require('tideline/css/tideline.less');

export function createTidelineChart(config: TidelineConfig, data: any) {
  // Create event emitter required by Tideline
  const emitter = new EventEmitter();

  // Create chart
  const chart = oneDay(emitter);

  // Set up basics
  chart.id(config.id).width(config.width).height(config.height).imagesBaseUrl(config.imagesBaseUrl);

  // Set up DOM element
  d3.select(`#${config.id}`).call(chart);

  // Create pools
  config.pools.forEach((poolConfig, index) => {
    const pool = chart
      .newPool()
      .id(poolConfig.id, chart.poolGroup())
      .weight(poolConfig.weight)
      .gutterWeight(poolConfig.gutterWeight);

    if (poolConfig.label) {
      pool.label(poolConfig.label);
    }

    // Store pool instance for later data configuration
    // (would need a reference storage mechanism)
  });

  // Arrange pools
  chart.arrangePools();

  // Set up annotations and tooltips
  if (config.pools.some((p) => p.annotations)) {
    chart.setAnnotation();

    config.pools.forEach((poolConfig) => {
      if (poolConfig.annotations) {
        chart.annotations().addGroup(d3.select(`#${config.id}`).select(`#${poolConfig.id}`), poolConfig.id);
      }
    });
  }

  if (config.pools.some((p) => p.tooltips)) {
    chart.setTooltip();

    config.pools.forEach((poolConfig) => {
      if (poolConfig.tooltips) {
        chart.tooltips().addGroup(d3.select(`#${config.id}`).select(`#${poolConfig.id}`), poolConfig.id);
      }
    });
  }

  // Load data and configure pools with data-dependent attributes
  function loadData(tidelineData: TidelineData) {
    chart.data(tidelineData).setAxes();

    if (config.scrollNav) {
      chart.setNav().setScrollNav();
    } else {
      chart.setNav();
    }

    // Configure pools with scales and plot types
    config.pools.forEach((poolConfig, index) => {
      const pool = chart.pools()[index];

      poolConfig.plotTypes.forEach((plotConfig) => {
        // Create scales and axes
        if (plotConfig.axis) {
          const scale = createScale(plotConfig.axis, tidelineData, pool);

          pool.yAxis(
            d3.svg
              .axis()
              .scale(scale)
              .orient(plotConfig.axis.orient || 'left')
              .outerTickSize(0)
              .ticks(plotConfig.axis.ticks || 2),
          );
        }

        // Add plot types
        const plotOpts = {
          ...plotConfig.opts,
          data: plotConfig.data ? tidelineData.grouped[plotConfig.data] : undefined,
          emitter,
        };

        const plotModule = plot[plotConfig.type];
        if (plotModule) {
          pool.addPlotType(
            plotConfig.type,
            plotModule(pool, plotOpts),
            true, // Renders data
            true, // Renders on main x-axis
          );
        }
      });
    });

    // Locate to specified date or most recent data
    if (config.datetime) {
      // Convert datetime to domain edges
      const datetime = new Date(config.datetime);
      // Calculations to determine start/end would go here
      // Simplified example:
      const start = new Date(datetime);
      start.setHours(start.getHours() - 12);
      const end = new Date(datetime);
      end.setHours(end.getHours() + 12);

      chart.renderedData([start, end]);

      // Render each pool
      chart.pools().forEach((pool: any) => {
        pool.render(chart.poolGroup(), chart.renderedData());
      });

      chart.setAtDate(end, false);
    } else {
      // Render most recent data
      // Implementation details here
    }
  }

  // Helper function to create scales
  function createScale(axisConfig: any, data: TidelineData, pool: any) {
    // Implementation would depend on data types
    // Would use tideline.plot.util.scales for diabetes data
    // For example:
    if (axisConfig.scale === 'bolus') {
      return tideline.plot.util.scales.bolus(data.grouped.bolus, pool);
    } else if (axisConfig.scale === 'carbs') {
      return tideline.plot.util.scales.carbs(data.grouped.carbs, pool);
    }
    // etc.
  }

  // Load initial data
  loadData(data);

  // Return chart object for potential further manipulation
  return {
    chart,
    loadData,
    // Add methods for insights if needed
    renderInsights: (insights: AssessmentInsight[]) => {
      // Implementation to render insights below chart
    },
  };
}
