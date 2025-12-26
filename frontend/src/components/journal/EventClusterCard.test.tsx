import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EventClusterCard from "./EventClusterCard";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import { mockJournalForView } from "../../mocks/journal";
import type { GlycemicEventCluster } from "@goodnumbers/types";
import type { Treatment } from "../../lib/agpUtils";

// Mock the chart component to verify it renders with correct props
vi.mock("./charts/ClusterEventsChart", () => ({
  ClusterEventsChart: vi.fn(() => <div data-testid="mock-cluster-chart" />),
}));

describe("EventClusterCard", () => {
  const mockCluster = mockJournalForView.clusters[0];
  const mockOnNoteChange = vi.fn();

  it("renders the structured header with dynamic title using colloquial terms", () => {
    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    // The title is now the full summary sentence using colloquial terms
    // Handle various high blood sugar types correctly for the test expectation
    const isHigh = ["HIGH", "HYPER", "VERY_HIGH"].includes(
      mockCluster.eventType.toUpperCase(),
    );
    const expectedTerm = isHigh ? "high blood sugar" : "low blood sugar";

    // We check that the heading contains the key parts: count and colloquial term
    const heading = screen.getByRole("heading", {
      name: (name) =>
        name.toLowerCase().includes(expectedTerm) &&
        name.includes(`${mockCluster.eventCount}`),
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders a textarea for user notes", () => {
    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote="My note"
        onNoteChange={mockOnNoteChange}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("My note");
  });

  it("calls onNoteChange when typing", () => {
    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    fireEvent.change(textarea, { target: { value: "New note" } });

    expect(mockOnNoteChange).toHaveBeenCalledWith("New note");
  });

  it("enforces maxLength of 1000 characters", () => {
    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    expect(textarea).toHaveAttribute("maxLength", "1000");
  });

  // --- New Tests for Cycle 2 ---

  it("parses valid JSON and renders the ClusterEventsChart", () => {
    const validJsonCluster: GlycemicEventCluster = {
      ...mockCluster,
      clusterDataJson: JSON.stringify({
        id: "test-cluster",
        events: [], // minimal valid object for the chart prop
      }),
    };

    render(
      <EventClusterCard
        cluster={validJsonCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    expect(screen.getByTestId("mock-cluster-chart")).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully by NOT rendering the chart", () => {
    const invalidJsonCluster: GlycemicEventCluster = {
      ...mockCluster,
      clusterDataJson: "{ invalid json string",
    };

    render(
      <EventClusterCard
        cluster={invalidJsonCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    expect(screen.queryByTestId("mock-cluster-chart")).not.toBeInTheDocument();
  });

  it("handles null/empty JSON gracefully by NOT rendering the chart", () => {
    // @ts-expect-error - simulating runtime null/undefined if types are loose
    const emptyJsonCluster: GlycemicEventCluster = {
      ...mockCluster,
      clusterDataJson: null,
    };

    render(
      <EventClusterCard
        cluster={emptyJsonCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    expect(screen.queryByTestId("mock-cluster-chart")).not.toBeInTheDocument();
  });

  it("passes the correct units prop to ClusterEventsChart", () => {
    const validJsonCluster: GlycemicEventCluster = {
      ...mockCluster,
      clusterDataJson: JSON.stringify({
        id: "test-cluster",
        events: [],
      }),
    };

    render(
      <EventClusterCard
        cluster={validJsonCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
        // @ts-expect-error - Testing new prop before implementation
        units="MMOL"
      />,
    );

    expect(ClusterEventsChart).toHaveBeenCalledWith(
      expect.objectContaining({ units: "MMOL" }),
      expect.anything(),
    );
  });

  it("passes treatments to ClusterEventsChart when provided", () => {
    const mockTreatments: Treatment[] = [
      { id: "t1", date: "2023-01-01T12:00:00Z", carbs: 15 },
    ];

    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
        // @ts-expect-error - Testing new prop before implementation
        treatments={mockTreatments}
      />,
    );

    expect(ClusterEventsChart).toHaveBeenCalledWith(
      expect.objectContaining({ treatments: mockTreatments }),
      expect.anything(),
    );
  });
});
