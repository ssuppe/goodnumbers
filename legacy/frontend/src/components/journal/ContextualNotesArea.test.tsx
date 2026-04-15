import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ContextualNotesArea from "./ContextualNotesArea";

describe("ContextualNotesArea", () => {
  const mockSetNotes = vi.fn();
  const placeholderText =
    "Add anything else about how you feel or what you were up to this week";

  it("renders as a collapsed input initially when empty", () => {
    render(<ContextualNotesArea notes="" setNotes={mockSetNotes} />);
    const input = screen.getByPlaceholderText(placeholderText);
    expect(input.tagName).toBe("INPUT");
  });

  it("renders as an expanded textarea initially when content exists", () => {
    render(<ContextualNotesArea notes="Some notes" setNotes={mockSetNotes} />);
    const textarea = screen.getByPlaceholderText(placeholderText);
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveValue("Some notes");
  });

  it("expands to textarea on focus", () => {
    render(<ContextualNotesArea notes="" setNotes={mockSetNotes} />);
    const input = screen.getByPlaceholderText(placeholderText);

    fireEvent.focus(input);

    const textarea = screen.getByPlaceholderText(placeholderText);
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("calls setNotes when typing", () => {
    render(<ContextualNotesArea notes="Start" setNotes={mockSetNotes} />);
    const textarea = screen.getByPlaceholderText(placeholderText);

    fireEvent.change(textarea, { target: { value: "Start typing" } });
    expect(mockSetNotes).toHaveBeenCalledWith("Start typing");
  });

  it("collapses on blur if empty", () => {
    vi.useFakeTimers();
    render(<ContextualNotesArea notes="" setNotes={mockSetNotes} />);

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
      <ContextualNotesArea notes="" setNotes={mockSetNotes} />,
    );

    // Expand
    fireEvent.focus(screen.getByPlaceholderText(placeholderText));

    // Update props to simulate typing
    rerender(
      <ContextualNotesArea notes="Some content" setNotes={mockSetNotes} />,
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

  it("enforces maxLength of 2000 characters", () => {
    render(<ContextualNotesArea notes="" setNotes={mockSetNotes} />);
    // Expand it
    fireEvent.focus(screen.getByPlaceholderText(placeholderText));

    const textarea = screen.getByPlaceholderText(placeholderText);
    expect(textarea).toHaveAttribute("maxLength", "2000");
  });

  it("displays character count", () => {
    render(<ContextualNotesArea notes="Hello" setNotes={mockSetNotes} />);
    expect(screen.getByText("5 characters")).toBeInTheDocument();
  });
});
