import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import EventClusterCard from "./EventClusterCard";
import { mockJournalForView } from "../../mocks/journal";

describe("EventClusterCard", () => {
  it("renders the DataDisplayWidget with a dynamic title", () => {
    const mockCluster = mockJournalForView.clusters[0];
    render(<EventClusterCard cluster={mockCluster} />);

    const expectedTitle = `Glycemic Event Cluster: ${mockCluster.eventType} (x${mockCluster.eventCount})`;
    // Use a flexible text matcher to find the heading that CONTAINS the title.
    const heading = screen.getByRole("heading", {
      name: (name) => name.includes(expectedTitle),
    });
    expect(heading).toBeInTheDocument();

    expect(screen.getByText(/"journalId":/i)).toBeInTheDocument();
  });
});
