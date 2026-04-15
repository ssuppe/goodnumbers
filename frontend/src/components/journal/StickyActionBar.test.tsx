import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StickyActionBar from "./StickyActionBar";

describe("StickyActionBar", () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  it("renders Discard and Save buttons", () => {
    render(
      <StickyActionBar
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Discard")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("calls onSave when Save is clicked", () => {
    render(
      <StickyActionBar
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText("Save"));
    expect(mockOnSave).toHaveBeenCalled();
  });

  it("calls onCancel when Discard is clicked", () => {
    render(
      <StickyActionBar
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText("Discard"));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("disables buttons and shows loading text when isLoading is true", () => {
    render(
      <StickyActionBar
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isLoading={true}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /saving/i });
    const discardBtn = screen.getByText("Discard");

    expect(saveBtn).toBeDisabled();
    expect(discardBtn).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("displays error message when error prop is present", () => {
    const errorMessage = "Failed to save data";
    render(
      <StickyActionBar
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isLoading={false}
        error={errorMessage}
      />,
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toHaveClass("text-red-600");
  });
});
