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
      observation: "Test AI Observation",
      probableDriver: "Test AI Driver",
      systemImpact: "Test AI Impact",
      lifestyleExperiment: "Test AI Experiment",
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
    expect(screen.queryByText("Test AI Observation")).not.toBeInTheDocument();

    // Click to expand
    const toggle = screen.getByText("AI Co-pilot Hypothesis");
    fireEvent.click(toggle);

    expect(screen.getByText("Test AI Observation")).toBeInTheDocument();
    expect(screen.getByText("Test AI Driver")).toBeInTheDocument();
    expect(screen.getByText("Test AI Experiment")).toBeInTheDocument();
    expect(screen.getByText("For your Doctor")).toBeInTheDocument();
    expect(
      screen.getByText("Specific discussion point for doctor"),
    ).toBeInTheDocument();
    expect(screen.getByText("+ Suggestion 1")).toBeInTheDocument();
  });

  it("appends quick log suggestion to existing note", () => {
    const aiInsight: AiInsight = {
      observation: "Test AI Observation",
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
    it("does not render the 'Help me reflect' button if onHelpReflect is not provided", () => {
      render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={mockOnNoteChange}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /help me reflect/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the 'Help me reflect' button and triggers onHelpReflect on click", () => {
      const onHelpReflectMock = vi.fn();
      render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={mockOnNoteChange}
          onHelpReflect={onHelpReflectMock}
        />,
      );

      const reflectBtn = screen.getByRole("button", {
        name: /help me reflect/i,
      });
      expect(reflectBtn).toBeInTheDocument();

      fireEvent.click(reflectBtn);
      expect(onHelpReflectMock).toHaveBeenCalledOnce();
    });

    it("applies active border ring highlighting and button active style when isChatActive is true", () => {
      const { container } = render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={mockOnNoteChange}
          onHelpReflect={vi.fn()}
          isChatActive={true}
        />,
      );

      // Card container has ring-mesa-primary class
      const cardContainer = container.firstChild;
      expect(cardContainer).toHaveClass("ring-2");
      expect(cardContainer).toHaveClass("ring-mesa-primary");

      // Button has active bg-mesa-primary style
      const reflectBtn = screen.getByRole("button", {
        name: /help me reflect/i,
      });
      expect(reflectBtn).toHaveClass("bg-mesa-primary");
    });

    it("applies green flash border on CollapsingNoteArea when note updates with synthesized quote", () => {
      const { rerender } = render(
        <EventClusterCard
          cluster={mockCluster}
          userNote=""
          onNoteChange={mockOnNoteChange}
          onHelpReflect={vi.fn()}
        />,
      );

      // Trigger userNote change to synthesized text (starts with '>')
      rerender(
        <EventClusterCard
          cluster={mockCluster}
          userNote='> "I ate pizza."\n* **Resolution:** Adjust bolus.'
          onNoteChange={mockOnNoteChange}
          onHelpReflect={vi.fn()}
        />,
      );

      // Underneath, the CollapsingNoteArea container should get the ring-green-500 style
      const textarea = screen.getByPlaceholderText(
        /Why do you think this happened?/i,
      );
      // The parent container of the textarea (from CollapsingNoteArea) has the custom class
      const collapsingNoteAreaContainer = textarea.parentElement?.parentElement;
      expect(collapsingNoteAreaContainer).toHaveClass("ring-2");
      expect(collapsingNoteAreaContainer).toHaveClass("ring-green-500");
    });
  });
});
