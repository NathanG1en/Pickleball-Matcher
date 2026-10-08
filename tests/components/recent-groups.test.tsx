import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  saveRecentGroup,
  getRecentGroups,
  removeRecentGroup,
} from "@/lib/storage/recent-groups";
import { RecentGroupsHome } from "@/components/groups/recent-groups-home";
import { RecentGroupTracker } from "@/components/groups/recent-group-tracker";

// Mock localStorage in node test environment
const mockStorage: Record<string, string> = {};
const storageMock: Storage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  },
  key: (index: number) => Object.keys(mockStorage)[index] || null,
  get length() {
    return Object.keys(mockStorage).length;
  },
};

describe("Recent Groups Storage & Components", () => {
  beforeEach(() => {
    storageMock.clear();
    Object.defineProperty(globalThis, "window", {
      value: {
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        localStorage: storageMock,
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    });
  });

  it("saves and retrieves recent groups deduplicated and capped at 5", () => {
    saveRecentGroup({ id: "grp-1", name: "Tuesday Morning" });
    saveRecentGroup({ id: "grp-2", name: "Thursday Nights" });
    saveRecentGroup({ id: "grp-1", name: "Tuesday Morning" }); // duplicate

    const recents = getRecentGroups();
    expect(recents).toHaveLength(2);
    expect(recents[0].id).toBe("grp-1");
    expect(recents[1].id).toBe("grp-2");

    // Add more up to limit
    saveRecentGroup({ id: "grp-3", name: "Group 3" });
    saveRecentGroup({ id: "grp-4", name: "Group 4" });
    saveRecentGroup({ id: "grp-5", name: "Group 5" });
    saveRecentGroup({ id: "grp-6", name: "Group 6" });

    const capped = getRecentGroups();
    expect(capped).toHaveLength(5);
    expect(capped[0].id).toBe("grp-6");
  });

  it("removes a group by id", () => {
    saveRecentGroup({ id: "grp-1", name: "Tuesday Morning" });
    saveRecentGroup({ id: "grp-2", name: "Thursday Nights" });

    removeRecentGroup("grp-1");
    const recents = getRecentGroups();
    expect(recents).toHaveLength(1);
    expect(recents[0].id).toBe("grp-2");
  });

  it("renders RecentGroupsHome hero card when 1 group is stored", () => {
    saveRecentGroup({ id: "grp-hero", name: "Sunset Pickleballers" });

    const html = renderToStaticMarkup(<RecentGroupsHome />);
    expect(html).toContain("Sunset Pickleballers");
    expect(html).toContain("Your Group on this Device");
    expect(html).toContain("/g/grp-hero");
  });

  it("renders RecentGroupsHome list when multiple groups are stored", () => {
    saveRecentGroup({ id: "grp-1", name: "Alpha League" });
    saveRecentGroup({ id: "grp-2", name: "Beta League" });

    const html = renderToStaticMarkup(<RecentGroupsHome />);
    expect(html).toContain("Alpha League");
    expect(html).toContain("Beta League");
    expect(html).toContain("Your Groups on this Device (2)");
  });

  it("renders nothing when storage is empty", () => {
    storageMock.clear();
    const html = renderToStaticMarkup(<RecentGroupsHome />);
    expect(html).toBe("");
  });

  it("renders RecentGroupTracker null component safely", () => {
    const html = renderToStaticMarkup(
      <RecentGroupTracker groupId="grp-test" groupName="Test Group" />
    );
    expect(html).toBe("");
  });

  it("excludes specified group in RecentGroupsHome when excludeGroupId matches", () => {
    saveRecentGroup({ id: "grp-active", name: "Active Group" });

    const html = renderToStaticMarkup(<RecentGroupsHome excludeGroupId="grp-active" />);
    expect(html).toBe("");
  });

  it("renders HomeScreenTip safely", async () => {
    const { HomeScreenTip } = await import("@/components/groups/home-screen-tip");
    const html = renderToStaticMarkup(<HomeScreenTip />);
    expect(typeof html).toBe("string");
  });
});
