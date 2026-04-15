import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Goals from "./Goals";

describe("Goals", () => {
  it("renders the DataDisplayWidget with the correct title", () => {
    const mockData = "My goal is to pre-bolus.";
    render(<Goals data={mockData} />);
    expect(
      screen.getByRole("heading", { name: /Goals for Next Week Data/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"My goal is to pre-bolus."/i)).toBeInTheDocument();
  });
});
