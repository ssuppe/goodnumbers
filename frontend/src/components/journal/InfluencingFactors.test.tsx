import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import InfluencingFactors from "./InfluencingFactors";

describe("InfluencingFactors", () => {
  it("renders the DataDisplayWidget with the correct title", () => {
    const mockData = ["Good Sleep", "Travel"];
    render(<InfluencingFactors data={mockData} />);
    expect(
      screen.getByRole("heading", { name: /Influencing Factors Data/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"Good Sleep"/i)).toBeInTheDocument();
  });
});
