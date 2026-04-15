import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AGPChart from "./AGPChart";

describe("AGPChart", () => {
  it("renders the DataDisplayWidget with the correct title", () => {
    const mockData = { value: 123 };
    render(<AGPChart data={mockData} />);
    expect(
      screen.getByRole("heading", {
        name: /Ambulatory Glucose Profile \(AGP\) Chart Data/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"value": 123/i)).toBeInTheDocument();
  });
});
