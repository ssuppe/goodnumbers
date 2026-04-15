import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import WeeklyVibe from "./WeeklyVibe";

describe("WeeklyVibe", () => {
  it("renders all vibe options", () => {
    render(<WeeklyVibe selectedVibe={null} onChange={vi.fn()} />);
    expect(screen.getByText("Wilted")).toBeInTheDocument();
    expect(screen.getByText("Sprouting")).toBeInTheDocument();
    expect(screen.getByText("Growing")).toBeInTheDocument();
    expect(screen.getByText("Flourishing")).toBeInTheDocument();
  });

  it("highlights the selected vibe", () => {
    render(<WeeklyVibe selectedVibe="Sprouting" onChange={vi.fn()} />);
    const selectedButton = screen.getByText("Sprouting").closest("button");
    expect(selectedButton).toHaveClass("ring-2");
  });

  it("calls onChange with the correct vibe when clicked", () => {
    const handleChange = vi.fn();
    render(<WeeklyVibe selectedVibe={null} onChange={handleChange} />);

    fireEvent.click(screen.getByText("Growing"));
    expect(handleChange).toHaveBeenCalledWith("Growing");
  });
});
