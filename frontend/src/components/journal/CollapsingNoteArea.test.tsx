import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CollapsingNoteArea from "./CollapsingNoteArea";

describe("CollapsingNoteArea", () => {
  const mockOnChange = vi.fn();
  const placeholderText = "Leave a note...";

  it("renders as a collapsed input initially when empty", () => {
    render(
      <CollapsingNoteArea
        value=""
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );
    const input = screen.getByPlaceholderText(placeholderText);
    expect(input.tagName).toBe("INPUT");
  });

  it("renders as an expanded textarea initially when content exists", () => {
    render(
      <CollapsingNoteArea
        value="Some notes"
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );
    const textarea = screen.getByPlaceholderText(placeholderText);
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveValue("Some notes");
  });

  it("expands to textarea on focus", () => {
    render(
      <CollapsingNoteArea
        value=""
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );
    const input = screen.getByPlaceholderText(placeholderText);

    fireEvent.focus(input);

    const textarea = screen.getByPlaceholderText(placeholderText);
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("calls onChange when typing", () => {
    render(
      <CollapsingNoteArea
        value="Start"
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );
    const textarea = screen.getByPlaceholderText(placeholderText);

    fireEvent.change(textarea, { target: { value: "Start typing" } });
    expect(mockOnChange).toHaveBeenCalledWith("Start typing");
  });

  it("collapses on blur if empty", () => {
    vi.useFakeTimers();
    render(
      <CollapsingNoteArea
        value=""
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );

    // Expand first
    const input = screen.getByPlaceholderText(placeholderText);
    fireEvent.focus(input);

    const textarea = screen.getByPlaceholderText(placeholderText);

    // Blur
    fireEvent.blur(textarea);

    // Fast forward timers for the timeout
    act(() => {
      vi.runAllTimers();
    });

    const collapsedInput = screen.getByPlaceholderText(placeholderText);
    expect(collapsedInput.tagName).toBe("INPUT");
    vi.useRealTimers();
  });

  it("does NOT collapse on blur if content exists", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <CollapsingNoteArea
        value=""
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );

    // Expand
    fireEvent.focus(screen.getByPlaceholderText(placeholderText));

    // Update props to simulate typing
    rerender(
      <CollapsingNoteArea
        value="Some content"
        onChange={mockOnChange}
        placeholder={placeholderText}
      />,
    );

    const textarea = screen.getByPlaceholderText(placeholderText);
    fireEvent.blur(textarea);

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByPlaceholderText(placeholderText).tagName).toBe(
      "TEXTAREA",
    );
    vi.useRealTimers();
  });

  it("enforces maxLength", () => {
    render(
      <CollapsingNoteArea
        value=""
        onChange={mockOnChange}
        maxLength={500}
        placeholder={placeholderText}
      />,
    );
    // Expand it
    fireEvent.focus(screen.getByPlaceholderText(placeholderText));

    const textarea = screen.getByPlaceholderText(placeholderText);
    expect(textarea).toHaveAttribute("maxLength", "500");
  });

  it("displays character count", () => {
    render(
      <CollapsingNoteArea
        value="Hello"
        onChange={mockOnChange}
        maxLength={100}
        placeholder={placeholderText}
      />,
    );
    expect(screen.getByText("5 / 100 characters")).toBeInTheDocument();
  });
});
