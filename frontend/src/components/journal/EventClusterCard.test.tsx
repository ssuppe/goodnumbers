import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import EventClusterCard from "./EventClusterCard";
import { mockJournalForView } from "../../mocks/journal";

describe("EventClusterCard", () => {
  const mockCluster = mockJournalForView.clusters[0];
  const mockOnNoteChange = vi.fn();

  it("renders the DataDisplayWidget with a dynamic title", () => {
    render(
      <EventClusterCard
        cluster={mockCluster}
        userNote=""
        onNoteChange={mockOnNoteChange}
      />,
    );

    const expectedTitle = `Glycemic Event Cluster: ${mockCluster.eventType} (x${mockCluster.eventCount})`;
    const heading = screen.getByRole("heading", {
      name: (name) => name.includes(expectedTitle),
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
});
