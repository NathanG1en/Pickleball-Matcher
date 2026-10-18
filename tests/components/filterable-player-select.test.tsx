import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FilterablePlayerSelect } from "@/components/groups/filterable-player-select";

describe("FilterablePlayerSelect component", () => {
  const options = [
    { id: "p1", name: "Alice Adams", rating: 1000, ratedGamesPlayed: 5 },
    { id: "p2", name: "Bob Brown", rating: 1100, ratedGamesPlayed: 8 },
    { id: "p1", name: "Alice Duplicate", rating: 1000, ratedGamesPlayed: 5 }, // Duplicate id
  ];

  it("renders combobox trigger with placeholder when no value is selected", () => {
    const html = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Team 1 Player 1"
        placeholder="Select a player..."
        value=""
        onChange={vi.fn()}
        options={options}
        dataTestId="test-select"
      />
    );

    expect(html).toContain('data-testid="test-select"');
    expect(html).toContain("Select a player...");
  });

  it("renders selected player name when value matches an option", () => {
    const html = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Team 1 Player 1"
        placeholder="Select a player..."
        value="p2"
        onChange={vi.fn()}
        options={options}
        dataTestId="test-select"
      />
    );

    expect(html).toContain("Bob Brown");
    expect(html).not.toContain("Select a player...");
  });
});

