import { describe, it, expect } from "vitest";
import { Fragment, Slice } from "../src/model";
import { ReplaceStep } from "../src/transform";
import { doc, p } from "./schema";
import { eq } from "./builder";

const testDoc = doc(p("foobar"));

function mkStep(from: number, to: number, val: string | null) {
  return new ReplaceStep(
    from,
    to,
    val == null
      ? Slice.empty
      : new Slice(Fragment.from(testDoc.type.schema.text(val)), 0, 0)
  );
}

describe("Step", () => {
  describe("merge", () => {
    function yes(
      from1: number,
      to1: number,
      val1: string | null,
      from2: number,
      to2: number,
      val2: string | null
    ) {
      return () => {
        const step1 = mkStep(from1, to1, val1);
        const step2 = mkStep(from2, to2, val2);
        const merged = step1.merge(step2);
        expect(merged).not.toBeNull();
        const result1 = step1.apply(testDoc);
        expect(result1.doc).not.toBeNull();
        const result2 = step2.apply(result1.doc!);
        expect(result2.doc).not.toBeNull();
        const mergedResult = merged!.apply(testDoc);
        expect(eq(mergedResult.doc!, result2.doc!)).toBe(true);
      };
    }

    function no(
      from1: number,
      to1: number,
      val1: string | null,
      from2: number,
      to2: number,
      val2: string | null
    ) {
      return () => {
        const step1 = mkStep(from1, to1, val1);
        const step2 = mkStep(from2, to2, val2);
        expect(step1.merge(step2)).toBeNull();
      };
    }

    it("merges typing changes", yes(2, 2, "a", 3, 3, "b"));

    it("merges inverse typing", yes(2, 2, "a", 2, 2, "b"));

    it("doesn't merge separated typing", no(2, 2, "a", 4, 4, "b"));

    it("doesn't merge inverted separated typing", no(3, 3, "a", 2, 2, "b"));

    it("merges adjacent backspaces", yes(3, 4, null, 2, 3, null));

    it("merges adjacent deletes", yes(2, 3, null, 2, 3, null));

    it("doesn't merge separate backspaces", no(1, 2, null, 2, 3, null));

    it("merges backspace and type", yes(2, 3, null, 2, 2, "x"));

    it("merges longer adjacent inserts", yes(2, 2, "quux", 6, 6, "baz"));

    it("merges inverted longer inserts", yes(2, 2, "quux", 2, 2, "baz"));

    it("merges longer deletes", yes(2, 5, null, 2, 4, null));

    it("merges inverted longer deletes", yes(4, 6, null, 2, 4, null));

    it("merges overwrites", yes(3, 4, "x", 4, 5, "y"));
  });

  describe("apply", () => {
    it("can apply a simple insertion", () => {
      const step = mkStep(2, 2, "X");
      const result = step.apply(testDoc);
      expect(result.failed).toBeNull();
      expect(result.doc!.textContent).toBe("fXoobar");
    });

    it("can apply a simple deletion", () => {
      const step = mkStep(2, 4, null);
      const result = step.apply(testDoc);
      expect(result.failed).toBeNull();
      // Deletes positions 2-4 which is "oo" from "foobar"
      expect(result.doc!.textContent).toBe("fbar");
    });

    it("can apply a replacement", () => {
      const step = mkStep(2, 4, "XY");
      const result = step.apply(testDoc);
      expect(result.failed).toBeNull();
      // Replaces "oo" with "XY"
      expect(result.doc!.textContent).toBe("fXYbar");
    });
  });

  describe("invert", () => {
    it("can invert an insertion", () => {
      const step = mkStep(2, 2, "X");
      const result = step.apply(testDoc);
      expect(result.doc).not.toBeNull();
      const inverted = step.invert(testDoc);
      const restored = inverted.apply(result.doc!);
      expect(eq(restored.doc!, testDoc)).toBe(true);
    });

    it("can invert a deletion", () => {
      const step = mkStep(2, 4, null);
      const result = step.apply(testDoc);
      expect(result.doc).not.toBeNull();
      const inverted = step.invert(testDoc);
      const restored = inverted.apply(result.doc!);
      expect(eq(restored.doc!, testDoc)).toBe(true);
    });

    it("can invert a replacement", () => {
      const step = mkStep(2, 4, "XY");
      const result = step.apply(testDoc);
      expect(result.doc).not.toBeNull();
      const inverted = step.invert(testDoc);
      const restored = inverted.apply(result.doc!);
      expect(eq(restored.doc!, testDoc)).toBe(true);
    });
  });

  describe("getMap", () => {
    it("returns correct map for insertion", () => {
      const step = mkStep(2, 2, "abc");
      const map = step.getMap();
      expect(map.map(0)).toBe(0);
      expect(map.map(2)).toBe(5); // after insertion
      expect(map.map(3)).toBe(6);
    });

    it("returns correct map for deletion", () => {
      const step = mkStep(2, 5, null);
      const map = step.getMap();
      expect(map.map(0)).toBe(0);
      expect(map.map(2)).toBe(2);
      expect(map.map(5)).toBe(2);
      expect(map.map(6)).toBe(3);
    });
  });
});
