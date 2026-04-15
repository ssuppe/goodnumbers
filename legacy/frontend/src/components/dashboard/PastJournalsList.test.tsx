import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PastJournalsList from "./PastJournalsList";
import { type JournalSummary } from "../../types/dashboard";

describe("PastJournalsList", () => {
  it("renders nothing when the journals list is empty", () => {
    const { container } = render(<PastJournalsList journals={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a list of journals with titles, emojis, and correct links", () => {
    const mockJournals: JournalSummary[] = [
      {
        id: "1",
        createdAt: new Date().toISOString(),
        podcastTitle: "Week 1",
        podcastDescription: "Desc 1",
        weeklyVibe: "Sprouting",
      },
      {
        id: "2",
        createdAt: new Date().toISOString(),
        podcastTitle: "Week 2",
        podcastDescription: "Desc 2",
        weeklyVibe: "Wilted",
      },
    ];
    render(
      <MemoryRouter>
        <PastJournalsList journals={mockJournals} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Week 1")).toBeInTheDocument();
    expect(screen.getByText("🌱")).toBeInTheDocument(); // Sprouting emoji
    expect(screen.getByText("🥀")).toBeInTheDocument(); // Wilted emoji

    const viewLinks = screen.getAllByRole("link", { name: /view/i });
    expect(viewLinks[0]).toHaveAttribute("href", "/journal/1");
    expect(viewLinks[1]).toHaveAttribute("href", "/journal/2");
  });
});
