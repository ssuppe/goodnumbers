import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DataDisplayWidget from "./DataDisplayWidget";

describe("DataDisplayWidget", () => {
  it("renders the title and pretty-prints the JSON data", () => {
    const mockData = {
      median: 120,
      percentile_range: [70, 180],
      notes: "This is a test note.",
    };
    render(<DataDisplayWidget title="AGP Chart Data" data={mockData} />);

    expect(
      screen.getByRole("heading", { name: /AGP Chart Data/i }),
    ).toBeInTheDocument();
    // Check for a few key pieces of the pretty-printed JSON
    expect(screen.getByText(/"median": 120/i)).toBeInTheDocument();
    expect(
      screen.getByText(/"notes": "This is a test note."/i),
    ).toBeInTheDocument();
  });

  it("renders a null state message if data is null", () => {
    render(<DataDisplayWidget title="Cluster Data" data={null} />);
    expect(
      screen.getByText(/No data available for Cluster Data/i),
    ).toBeInTheDocument();
  });
});
