import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import InsightsList from "./InsightsList";

describe("InsightsList", () => {
  it("renders the DataDisplayWidget with the correct title", () => {
    const mockData = [{ insight: "test" }];
    render(<InsightsList data={mockData} />);
    expect(
      screen.getByRole("heading", { name: /Key Insights Data/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"insight": "test"/i)).toBeInTheDocument();
  });
});
