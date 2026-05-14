import { describe, it, expect } from "vitest";
import { mulberry32 } from "@/engine/rng";

describe("mulberry32", () => {
  it("returns deterministic floats in [0, 1)", () => {
    const rng = mulberry32(42);
    const samples = [rng(), rng(), rng(), rng()];
    samples.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    });
  });

  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});
