import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ClusterChatInterface from "../ClusterChatInterface";
import { api } from "../../../lib/api";

// Mock axios API
vi.mock("../../../lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("ClusterChatInterface Component", () => {
  const defaultProps = {
    journalId: "j-1",
    clusterId: "c-1",
    initialPrompt: "Hello, do you want to reflect?",
    onSaveInsight: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders initial prompt inside model message bubble", () => {
    render(<ClusterChatInterface {...defaultProps} />);
    expect(
      screen.getByText("Hello, do you want to reflect?"),
    ).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<ClusterChatInterface {...defaultProps} />);
    const closeBtn = screen.getByTitle("Close chat drawer");
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it("allows user to type a message and send it successfully", async () => {
    // Mock the backend chat reply
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { reply: "That sounds like a great point." },
    });

    render(<ClusterChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      "Ask a question or explain what happened...",
    );
    const sendButton = screen.getByRole("button", { name: "" }); // Send icon button has no text name

    fireEvent.change(input, {
      target: { value: "I ate pizza and forgot to bolus" },
    });
    fireEvent.click(sendButton);

    // Verify user message is appended to UI
    expect(
      screen.getByText("I ate pizza and forgot to bolus"),
    ).toBeInTheDocument();

    // Verify loading state
    expect(screen.getByText("AI Coach is thinking...")).toBeInTheDocument();

    // Wait for API response and check if AI reply is appended
    await waitFor(() => {
      expect(
        screen.getByText("That sounds like a great point."),
      ).toBeInTheDocument();
    });

    // Check API endpoint was hit correctly
    expect(api.post).toHaveBeenCalledWith("/journals/j-1/clusters/c-1/chat", {
      message: "I ate pizza and forgot to bolus",
      chatHistory: [
        { role: "model", content: "Hello, do you want to reflect?" },
      ],
    });
  });

  it("displays an error message if the chat request fails", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network Error"));

    render(<ClusterChatInterface {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      "Ask a question or explain what happened...",
    );
    const sendButton = screen.getByRole("button", { name: "" });

    fireEvent.change(input, { target: { value: "Network failure test" } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unable to reach the AI coach. Please check your connection and try again.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("triggers insight synthesis and calls onSaveInsight on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        synthesizedInsight:
          '> "Synthesized POV note"\n* **Resolution:** Adjust lunch bolus',
      },
    });

    render(<ClusterChatInterface {...defaultProps} />);

    const saveButton = screen.getByRole("button", {
      name: "Summarize my notes",
    });
    fireEvent.click(saveButton);

    // Shows loading synthesis overlay
    expect(screen.getByText("Synthesizing Reflection")).toBeInTheDocument();

    await waitFor(() => {
      expect(defaultProps.onSaveInsight).toHaveBeenCalledWith(
        '> "Synthesized POV note"\n* **Resolution:** Adjust lunch bolus',
      );
    });

    expect(api.post).toHaveBeenCalledWith(
      "/journals/j-1/clusters/c-1/save-insight",
      {
        chatHistory: [
          { role: "model", content: "Hello, do you want to reflect?" },
        ],
      },
    );
  });
});
