import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PodcastPlayer from "./PodcastPlayer";
import { mockJournalForView } from "../../mocks/journal";

describe("PodcastPlayer", () => {
  it("renders the title, description, and a lazy-load button", () => {
    render(
      <PodcastPlayer
        title={mockJournalForView.podcastTitle}
        description={mockJournalForView.podcastDescription}
        audioUrl={mockJournalForView.podcastAudioUrl}
      />,
    );
    expect(
      screen.getByRole("heading", { name: mockJournalForView.podcastTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(mockJournalForView.podcastDescription!),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Click to load AI discussion/i }),
    ).toBeInTheDocument();
  });

  it("loads and displays the audio player when the button is clicked", () => {
    render(
      <PodcastPlayer
        title={mockJournalForView.podcastTitle}
        description={mockJournalForView.podcastDescription}
        audioUrl={mockJournalForView.podcastAudioUrl}
      />,
    );
    const loadButton = screen.getByRole("button", {
      name: /Click to load AI discussion/i,
    });
    fireEvent.click(loadButton);

    expect(
      screen.queryByRole("button", { name: /Click to load AI discussion/i }),
    ).not.toBeInTheDocument();
    const audioPlayer = screen.getByTestId("audio-player");
    expect(audioPlayer).toBeInTheDocument();
    expect(audioPlayer).toHaveAttribute(
      "src",
      mockJournalForView.podcastAudioUrl,
    );
  });
});
