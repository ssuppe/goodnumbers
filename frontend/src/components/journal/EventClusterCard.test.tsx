import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EventClusterCard, { type AiInsight } from "./EventClusterCard";
import { ClusterEventsChart } from "./charts/ClusterEventsChart";
import { mockJournalForView } from "../../mocks/journal";
import type { GlycemicEventCluster } from "@goodnumbers/types";
import { InsightPriority } from "@goodnumbers/types";
import type { Treatment } from "../../lib/agpUtils";

// Mock the chart component to verify it renders with correct props
vi.mock("./charts/ClusterEventsChart", () => ({
  ClusterEventsChart: vi.fn(() => <div data-testid="mock-cluster-chart" />),
}));

// Mock ClusterChatInterface to isolate hybrid flow integration
vi.mock("./ClusterChatInterface", () => ({
  default: vi.fn(({ onSaveInsight, onClose }) => (
    <div data-testid="mock-chat-interface">
      <button
        onClick={() => onSaveInsight("synthesized note")}
        data-testid="mock-save-insight"
      >
        Mock Save
      </button>
      <button onClick={onClose} data-testid="mock-close-chat">
        Mock Close
      </button>
    </div>
  )),
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

  it("renders structured AI Co-pilot hypothesis and reflections for the doctor", () => {
    const aiInsight: AiInsight = {
      assessment: "Test AI Assessment",
      reflectionForDoctor: "Specific discussion point for doctor",
      quickLogSuggestions: ["Suggestion 1"],
    };
    const clusterWithAi = {
      ...mockCluster,
      aiInsight,
      quickLogSuggestions: aiInsight.quickLogSuggestions,
    } as unknown as GlycemicEventCluster;

    render(
      <EventClusterCard
        cluster={clusterWithAi}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    // Initially hidden
    expect(screen.queryByText("Test AI Assessment")).not.toBeInTheDocument();

    // Click to expand
    const toggle = screen.getByText("AI Co-pilot Hypothesis");
    fireEvent.click(toggle);

    expect(screen.getByText("Test AI Assessment")).toBeInTheDocument();
    expect(screen.getByText("For your Doctor")).toBeInTheDocument();
    expect(
      screen.getByText("Specific discussion point for doctor"),
    ).toBeInTheDocument();
    expect(screen.getByText("+ Suggestion 1")).toBeInTheDocument();
  });

  it("appends quick log suggestion to existing note", () => {
    const aiInsight: AiInsight = {
      assessment: "Test AI Assessment",
      reflectionForDoctor: "Reflection",
      quickLogSuggestions: ["Suggestion 1"],
    };
    const clusterWithAi = {
      ...mockCluster,
      aiInsight,
      quickLogSuggestions: aiInsight.quickLogSuggestions,
    } as unknown as GlycemicEventCluster;

    render(
      <EventClusterCard
        cluster={clusterWithAi}
        userNote="Existing note"
        onNoteChange={mockOnNoteChange}
      />,
    );

    // Expand AI
    fireEvent.click(screen.getByText("AI Co-pilot Hypothesis"));

    // Click suggestion
    fireEvent.click(screen.getByText("+ Suggestion 1"));
    expect(mockOnNoteChange).toHaveBeenCalledWith(
      "Existing note\n- Suggestion 1",
    );
  });

  describe("Hybrid Notes / AI Coach Flow", () => {
    it("renders the 'Help me reflect' button by default", () => {
      render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={mockOnNoteChange}
        />,
      );
      expect(
        screen.getByRole("button", { name: /help me reflect/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("mock-chat-interface"),
      ).not.toBeInTheDocument();
    });

    it("toggles to the AI Coach chat interface when 'Help me reflect' is clicked, and back on close", () => {
      render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={mockOnNoteChange}
        />,
      );

      // Verify notes label is visible initially
      expect(screen.getByText("Your Notes")).toBeInTheDocument();

      // Click "Help me reflect"
      fireEvent.click(screen.getByRole("button", { name: /help me reflect/i }));

      // Notes label should be replaced by the chat interface
      expect(screen.queryByText("Your Notes")).not.toBeInTheDocument();
      expect(screen.getByTestId("mock-chat-interface")).toBeInTheDocument();

      // Click mock close button inside the chat interface
      fireEvent.click(screen.getByTestId("mock-close-chat"));

      // Standard notes view should return
      expect(screen.getByText("Your Notes")).toBeInTheDocument();
      expect(
        screen.queryByTestId("mock-chat-interface"),
      ).not.toBeInTheDocument();
    });

    it("saves the synthesized insight and returns to manual note view on save", () => {
      const onNoteChangeMock = vi.fn();
      render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={onNoteChangeMock}
        />,
      );

      // Open coach chat
      fireEvent.click(screen.getByRole("button", { name: /help me reflect/i }));

      // Click mock save button inside chat interface
      fireEvent.click(screen.getByTestId("mock-save-insight"));

      // Verify callback was triggered with the synthesized text
      expect(onNoteChangeMock).toHaveBeenCalledWith("synthesized note");

      // Verify the chat interface closed and returned to notes view
      expect(screen.getByText("Your Notes")).toBeInTheDocument();
      expect(
        screen.queryByTestId("mock-chat-interface"),
      ).not.toBeInTheDocument();
    });
  });
});
