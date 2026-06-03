/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EventClusterCard from "../EventClusterCard";
import type { GlycemicEventCluster } from "@goodnumbers/types";

const mockCluster: GlycemicEventCluster = {
  id: "c1",
  userId: "u1",
  journalId: "j1",
  eventType: "hyper",
  meanTimeMinutes: 1200,
  eventCount: 3,
  activeDays: [1, 2, 3],
  clusterDataJson: JSON.stringify({
    events: [],
    timezone: "America/New_York",
    utcOffset: -240
  }),
  aiInsight: null,
  insights: [],
  quickLogSuggestions: "[]",
};

describe("EventClusterCard - Location Mapping", () => {
  it("displays formatted city name from IANA zone (America/New_York -> New York)", () => {
    render(
      <EventClusterCard 
        cluster={mockCluster} 
        showTimezone={true}
      />
    );
    expect(screen.getByText(/in New York/i)).toBeInTheDocument();
    expect(screen.getByText(/GMT-4/i)).toBeInTheDocument();
  });

  it("uses human-friendly fallback for GMT+1 (London / Paris)", () => {
    const londonSummer = {
      ...mockCluster,
      clusterDataJson: JSON.stringify({
        events: [],
        timezone: "Etc/GMT-1",
        utcOffset: 60
      })
    };
    render(<EventClusterCard cluster={londonSummer} showTimezone={true} />);
    expect(screen.getByText(/in London \/ Paris/i)).toBeInTheDocument();
    expect(screen.getByText(/GMT\+1/i)).toBeInTheDocument();
  });

  it("uses human-friendly fallback for GMT-5 (New York / Chicago)", () => {
    const nycWinter = {
      ...mockCluster,
      clusterDataJson: JSON.stringify({
        events: [],
        timezone: "Etc/GMT+5",
        utcOffset: -300
      })
    };
    render(<EventClusterCard cluster={nycWinter} showTimezone={true} />);
    expect(screen.getByText(/in New York \/ Chicago/i)).toBeInTheDocument();
  });

  it("hides timezone info when showTimezone is false", () => {
    render(<EventClusterCard cluster={mockCluster} showTimezone={false} />);
    expect(screen.queryByText(/in New York/i)).not.toBeInTheDocument();
  });
});
