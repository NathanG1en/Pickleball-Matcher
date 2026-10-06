import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

describe("Read-only sharing and PWA manifest", () => {
  it("resolves valid share IDs and returns null for invalid share IDs", async () => {
    const repository = new InMemoryRepositories({
      groups: [
        {
          id: "group-1",
          name: "Friday Club",
          organizerPinHash: "pin_hash",
          publicShareId: "valid-share-key-12345",
          createdAt: new Date(),
        },
      ],
    });

    const found = await repository.getGroupByShareId("valid-share-key-12345");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Friday Club");

    const notFound = await repository.getGroupByShareId("nonexistent-key");
    expect(notFound).toBeNull();
  });

  it("produces valid PWA manifest metadata", () => {
    const data = manifest();

    expect(data.name).toBe("Pickleball Matchmaker");
    expect(data.short_name).toBe("Pickleball");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.theme_color).toBe("#17615c");
    expect(data.background_color).toBe("#071317");
    expect(data.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
      ]),
    );
  });
});
