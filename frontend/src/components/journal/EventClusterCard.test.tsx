import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EventClusterCard from "./EventClusterCard";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import { mockJournalForView } from "../../mocks/journal";
import type { GlycemicEventCluster } from "@goodnumbers/types";
import { InsightPriority } from "@goodnumbers/types";
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

    const isHigh = ["HIGH", "HYPER", "VERY_HIGH"].includes(
      mockCluster.eventType.toUpperCase(),
    );
    const expectedTerm = isHigh ? "high blood sugar" : "low blood sugar";

    const heading = screen.getByRole("heading", {
      name: (name) =>
        name.toLowerCase().includes(expectedTerm) &&
        name.includes(`${mockCluster.eventCount}`),
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders a CollapsingNoteArea for user notes", () => {
    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote="My note"
        onNoteChange={mockOnNoteChange}
      />,
    );

    // When there is a value, it starts expanded (textarea)
    const textarea = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    expect(textarea.tagName).toBe("TEXTAREA");
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

    // 1. Find the collapsed input and focus it to expand
    const input = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    fireEvent.focus(input);

    // 2. Now find the expanded textarea and type
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

    // Focus to expand
    const input = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    fireEvent.focus(input);

    const textarea = screen.getByPlaceholderText(
      /Why do you think this happened?/i,
    );
    expect(textarea).toHaveAttribute("maxLength", "1000");
  });

  it("parses valid JSON and renders the ClusterEventsChart", () => {
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
        treatments={mockTreatments}
      />,
    );

    expect(ClusterEventsChart).toHaveBeenCalledWith(
      expect.objectContaining({ treatments: mockTreatments }),
      expect.anything(),
    );
  });

  it("renders insights when provided", () => {
    const insights = [
      { priority: InsightPriority.IMPORTANT, note: "Uncovered meal" },
    ];
    const clusterWithInsights = { ...mockCluster, insights };
    render(
      <EventClusterCard
        cluster={clusterWithInsights}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );
    // Initially hidden
    expect(screen.queryByText("Uncovered meal")).not.toBeInTheDocument();

    // Click to expand
    const toggle = screen.getByText("Data Analysis");
    fireEvent.click(toggle);

    expect(screen.getByText("Uncovered meal")).toBeInTheDocument();
  });
});
