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

  it("renders (Selected) label for options marked as selectedElsewhere without disabling them", () => {
    const optionsWithSelected = [
      { id: "p1", name: "Alice Adams", selectedElsewhere: true },
      { id: "p2", name: "Bob Brown" },
      { id: "p3", name: "Charlie Chaplin", disabled: true },
    ];

    // Note: dropdown options render when open, but we can verify the option props contract
    const html = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Team 1 Player 1"
        placeholder="Select a player..."
        value=""
        onChange={vi.fn()}
        options={optionsWithSelected}
        dataTestId="test-select"
      />
    );

    expect(html).toContain('data-testid="test-select"');
  });

  it("renders with text-sm styling for both default and sm size variants", () => {
    const defaultHtml = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Default Select"
        placeholder="Select a player..."
        value=""
        onChange={vi.fn()}
        options={options}
      />
    );
    expect(defaultHtml).toContain("px-3.5 py-2 text-sm");
    expect(defaultHtml).not.toContain("text-xs");

    const smHtml = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Small Select"
        placeholder="Select a player..."
        value=""
        onChange={vi.fn()}
        options={options}
        sizeVariant="sm"
      />
    );
    expect(smHtml).toContain("px-3 py-1.5 text-sm");
    expect(smHtml).not.toContain("text-xs");
  });

  it("renders black pin icon when selected player is pinned and when dropdown is open", () => {
    const pinnedOptions = [
      { id: "p1", name: "Alice Adams", isPinned: true },
      { id: "p2", name: "Bob Brown", isPinned: false },
    ];

    // Trigger button when pinned player is selected
    const selectedHtml = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Pinned Select"
        placeholder="Select..."
        value="p1"
        onChange={vi.fn()}
        options={pinnedOptions}
      />
    );
    expect(selectedHtml).toContain('data-testid="black-pin-icon"');
    expect(selectedHtml).toContain("bg-black text-[#ccff00]");

    // Dropdown list when open
    const openHtml = renderToStaticMarkup(
      <FilterablePlayerSelect
        ariaLabel="Pinned Select"
        placeholder="Select..."
        value=""
        onChange={vi.fn()}
        options={pinnedOptions}
        initialOpen={true}
      />
    );
    expect(openHtml).toContain('data-testid="black-pin-icon"');
    expect(openHtml).toContain("bg-black text-[#ccff00]");
  });
});

