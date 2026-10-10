import { describe, it, expect } from "vitest";

describe("Canonical pair ordering", () => {
  it("orders accounts deterministically regardless of input order", () => {
    const accA = "acc_aaa";
    const accB = "acc_bbb";
    const [first1, second1] = accA < accB ? [accA, accB] : [accB, accA];
    const [first2, second2] = accB < accA ? [accB, accA] : [accA, accB];
    expect(first1).toBe("acc_aaa");
    expect(second1).toBe("acc_bbb");
    expect(first1).toBe(first2);
    expect(second1).toBe(second2);
  });
});
