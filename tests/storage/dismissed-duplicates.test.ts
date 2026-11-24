import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissDuplicateWarning,
  getDismissedDuplicates,
  getDismissedDuplicatesSnapshot,
} from "@/lib/storage/dismissed-duplicates";

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

describe("dismissed-duplicates storage", () => {
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

  it("adds and retrieves dismissed duplicate matches in localStorage per session", () => {
    const sessionId = "sess_1";

    expect(getDismissedDuplicates(sessionId)).toEqual([]);
    expect(getDismissedDuplicatesSnapshot(sessionId)).toBe("[]");

    dismissDuplicateWarning(sessionId, "m_1", "m_2");

    const dismissed = getDismissedDuplicates(sessionId);
    expect(dismissed).toContain("m_1");
    expect(dismissed).toContain("m_2");

    // Adding another duplicate pair
    dismissDuplicateWarning(sessionId, "m_3");
    const dismissedAfter = getDismissedDuplicates(sessionId);
    expect(dismissedAfter).toContain("m_1");
    expect(dismissedAfter).toContain("m_2");
    expect(dismissedAfter).toContain("m_3");

    // Other session is isolated
    expect(getDismissedDuplicates("sess_other")).toEqual([]);
  });
});

