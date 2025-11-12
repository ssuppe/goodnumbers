import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import WeeklyVibe from "./WeeklyVibe";

describe("WeeklyVibe", () => {
  it("renders the DataDisplayWidget with the correct title", () => {
    const mockData = "Sprouting";
    render(<WeeklyVibe data={mockData} />);
    expect(
      screen.getByRole("heading", { name: /Weekly Vibe Data/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"Sprouting"/i)).toBeInTheDocument();
  });
});
