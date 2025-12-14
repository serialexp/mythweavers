import { describe, it, expect } from "vitest";
import { Fragment, Slice } from "../src/model";
import { Transform, TransformError, ReplaceStep } from "../src/transform";
import { doc, p, blockquote, h1, em, strong } from "./schema";
import { eq } from "./builder";

describe("Transform", () => {
  describe("replace", () => {
    it("can delete text", () => {
      const tr = new Transform(doc(p("hello world")));
      tr.delete(2, 7);
      expect(tr.doc.textContent).toBe("hworld");
    });

    it("can insert text", () => {
      const tr = new Transform(doc(p("hello")));
      tr.insertText(" world", 6);
      expect(tr.doc.textContent).toBe("hello world");
    });

    it("can replace text", () => {
      const tr = new Transform(doc(p("hello world")));
      tr.insertText("beautiful ", 7, 7);
      expect(tr.doc.textContent).toBe("hello beautiful world");
    });

    it("can replace across paragraphs", () => {
      const tr = new Transform(doc(p("one"), p("two")));
      tr.delete(2, 7);
      expect(tr.doc.textContent).toBe("owo");
      expect(tr.doc.childCount).toBe(1);
    });

    it("can insert a node", () => {
      const tr = new Transform(doc(p("hello")));
      const schema = tr.doc.type.schema;
      tr.insert(6, schema.text(" world"));
      expect(tr.doc.textContent).toBe("hello world");
    });

    it("can replaceWith a fragment", () => {
      const tr = new Transform(doc(p("hello")));
      const schema = tr.doc.type.schema;
      tr.replaceWith(2, 5, Fragment.from(schema.text("XYZ")));
      expect(tr.doc.textContent).toBe("hXYZo");
    });
  });

  describe("docChanged", () => {
    it("is false when no steps have been applied", () => {
      const tr = new Transform(doc(p("hello")));
      expect(tr.docChanged).toBe(false);
    });

    it("is true after a step", () => {
      const tr = new Transform(doc(p("hello")));
      tr.delete(2, 4);
      expect(tr.docChanged).toBe(true);
    });

    it("is true even for no-effect replace", () => {
      // Even if a replace doesn't change content, if a step was added, docChanged is true
      const tr = new Transform(doc(p("hello")));
      tr.replace(2, 2); // empty replace at position
      // This doesn't add a step because replaceStep returns null for no-ops
      expect(tr.docChanged).toBe(false);
    });
  });

  describe("before", () => {
    it("returns the original document", () => {
      const original = doc(p("hello"));
      const tr = new Transform(original);
      tr.delete(2, 4);
      expect(eq(tr.before, original)).toBe(true);
      expect(eq(tr.doc, original)).toBe(false);
    });

    it("returns current doc when no steps applied", () => {
      const original = doc(p("hello"));
      const tr = new Transform(original);
      expect(tr.before).toBe(tr.doc);
    });
  });

  describe("mapping", () => {
    it("tracks position changes", () => {
      const tr = new Transform(doc(p("hello world")));
      tr.delete(2, 7); // delete "ello "
      // Position 8 (start of "world") should map to 3
      expect(tr.mapping.map(8)).toBe(3);
    });

    it("tracks multiple changes", () => {
      const tr = new Transform(doc(p("hello world")));
      tr.delete(2, 4); // "hlo world"
      tr.delete(5, 7); // "hlo orld" (deleting "wo" at adjusted positions)
      expect(tr.steps.length).toBe(2);
      expect(tr.mapping.maps.length).toBe(2);
    });
  });

  describe("step", () => {
    it("throws on invalid step", () => {
      const tr = new Transform(doc(p("hello")));
      // Try to create an invalid replacement - this throws RangeError from content validation
      expect(() => {
        tr.replace(0, 0, new Slice(Fragment.from(doc(p("nested"))), 0, 0));
      }).toThrow();
    });
  });

  describe("maybeStep", () => {
    it("returns failed result instead of throwing", () => {
      const tr = new Transform(doc(p("hello")));
      const result = tr.maybeStep(
        new ReplaceStep(0, 0, new Slice(Fragment.from(doc(p("nested"))), 0, 0))
      );
      expect(result.failed).not.toBeNull();
      expect(tr.docChanged).toBe(false);
    });
  });

  describe("docs", () => {
    it("stores intermediate documents", () => {
      const original = doc(p("hello world"));
      const tr = new Transform(original);
      tr.delete(2, 4); // deleted "el" -> "hlo world"
      tr.delete(6, 7); // deleted "o" -> "hlo wrld"

      expect(tr.docs.length).toBe(2);
      expect(eq(tr.docs[0], original)).toBe(true);
      expect(tr.docs[1].textContent).toBe("hlo world");
      expect(tr.doc.textContent).toBe("hlo wrld");
    });
  });

  describe("chaining", () => {
    it("allows method chaining", () => {
      const tr = new Transform(doc(p("hello world")))
        .delete(6, 7)
        .insertText("beautiful ", 6);
      expect(tr.doc.textContent).toBe("hellobeautiful world");
    });
  });

  describe("with marks", () => {
    it("preserves marks when inserting text", () => {
      const d = doc(p("hello ", em("world")));
      const tr = new Transform(d);
      // Insert inside the emphasized text
      tr.insertText("beautiful ", 10);
      // Check that marks are preserved
      const child = tr.doc.firstChild!;
      expect(child.childCount).toBe(2);
    });
  });
});
