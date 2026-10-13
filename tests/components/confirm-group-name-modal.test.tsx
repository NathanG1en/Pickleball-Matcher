import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmGroupNameModal } from "@/components/groups/confirm-group-name-modal";

describe("ConfirmGroupNameModal component", () => {
  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ConfirmGroupNameModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Group"
        description="Are you sure?"
        groupName="My Cool Group"
        confirmButtonText="Delete Group"
      />
    );
    expect(html).toBe("");
  });

  it("renders modal with group name in description and confirmation prompt", () => {
    const html = renderToStaticMarkup(
      <ConfirmGroupNameModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Transfer Host"
        description="You are about to transfer host privileges."
        groupName="Friday Night Picklers"
        confirmButtonText="Transfer Host"
      />
    );

    expect(html).toContain("Transfer Host");
    expect(html).toContain("You are about to transfer host privileges.");
    expect(html).toContain("Friday Night Picklers");
    expect(html).toContain('placeholder="Friday Night Picklers"');
    expect(html).toContain("Cancel");
  });

  it("renders error message when error is provided", () => {
    const html = renderToStaticMarkup(
      <ConfirmGroupNameModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Transfer Host"
        description="Are you sure?"
        groupName="Friday Night Picklers"
        confirmButtonText="Transfer Host"
        error="Group name does not match."
      />
    );

    expect(html).toContain("Group name does not match.");
    expect(html).toContain('role="alert"');
  });
});

