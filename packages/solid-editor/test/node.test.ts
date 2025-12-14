import { describe, it, expect } from "vitest";
import { Fragment, Schema, Node } from "../src/model";
import {
  schema,
  doc,
  p,
  blockquote,
  ul,
  li,
  em,
  strong,
  code,
  br,
  img,
  hr,
  a,
} from "./schema";
import { eq } from "./builder";

// Custom schema for specific tests
const customSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "(text|contact)*" },
    text: {},
    contact: {
      inline: true,
      attrs: { name: {}, email: {} },
      leafText(node: Node) {
        return `${node.attrs.name} <${node.attrs.email}>`;
      },
    },
    hard_break: {},
  },
});

describe("Node", () => {
  describe("toString", () => {
    it("nests", () => {
      expect(doc(ul(li(p("hey"), p()), li(p("foo")))).toString()).toBe(
        'doc(bullet_list(list_item(paragraph("hey"), paragraph), list_item(paragraph("foo"))))'
      );
    });

    it("shows inline children", () => {
      expect(doc(p("foo", img(), br(), "bar")).toString()).toBe(
        'doc(paragraph("foo", image, hard_break, "bar"))'
      );
    });

    it("shows marks", () => {
      expect(doc(p("foo", em("bar", strong("quux")), code("baz"))).toString()).toBe(
        'doc(paragraph("foo", em("bar"), em(strong("quux")), code("baz")))'
      );
    });
  });

  describe("cut", () => {
    function testCut(doc: Node & { tag: { a?: number; b?: number } }, expected: Node) {
      const from = doc.tag.a ?? 0;
      const to = doc.tag.b;
      expect(eq(doc.cut(from, to), expected)).toBe(true);
    }

    it("extracts a full block", () => {
      testCut(
        doc(p("foo"), "<a>", p("bar"), "<b>", p("baz")),
        doc(p("bar"))
      );
    });

    it("cuts text", () => {
      testCut(
        doc(p("0"), p("foo<a>bar<b>baz"), p("2")),
        doc(p("bar"))
      );
    });

    it("cuts deeply", () => {
      testCut(
        doc(
          blockquote(
            ul(li(p("a"), p("b<a>c")), li(p("d")), "<b>", li(p("e"))),
            p("3")
          )
        ),
        doc(blockquote(ul(li(p("c")), li(p("d")))))
      );
    });

    it("works from the left", () => {
      testCut(
        doc(blockquote(p("foo<b>bar"))),
        doc(blockquote(p("foo")))
      );
    });

    it("works to the right", () => {
      testCut(
        doc(blockquote(p("foo<a>bar"))),
        doc(blockquote(p("bar")))
      );
    });

    it("preserves marks", () => {
      testCut(
        doc(
          p(
            "foo",
            em("ba<a>r", img(), strong("baz"), br()),
            "qu<b>ux",
            code("xyz")
          )
        ),
        doc(p(em("r", img(), strong("baz"), br()), "qu"))
      );
    });
  });

  describe("between", () => {
    function testBetween(doc: Node & { tag: { a: number; b: number } }, ...nodeNames: string[]) {
      let i = 0;
      doc.nodesBetween(doc.tag.a, doc.tag.b, (node, pos) => {
        if (i === nodeNames.length) {
          throw new Error("More nodes iterated than listed (" + node.type.name + ")");
        }
        const compare = node.isText ? node.text! : node.type.name;
        if (compare !== nodeNames[i]) {
          throw new Error(
            "Expected " + JSON.stringify(nodeNames[i]) + ", got " + JSON.stringify(compare)
          );
        }
        i++;
        if (!node.isText && doc.nodeAt(pos) !== node) {
          throw new Error(
            "Pos " + pos + " does not point at node " + node + " " + doc.nodeAt(pos)
          );
        }
      });
      expect(i).toBe(nodeNames.length);
    }

    it("iterates over text", () => {
      testBetween(
        doc(p("foo<a>bar<b>baz")),
        "paragraph",
        "foobarbaz"
      );
    });

    it("descends multiple levels", () => {
      testBetween(
        doc(blockquote(ul(li(p("f<a>oo")), p("b"), "<b>"), p("c"))),
        "blockquote",
        "bullet_list",
        "list_item",
        "paragraph",
        "foo",
        "paragraph",
        "b"
      );
    });

    it("iterates over inline nodes", () => {
      testBetween(
        doc(
          p(
            em("x"),
            "f<a>oo",
            em("bar", img(), strong("baz"), br()),
            "quux",
            code("xy<b>z")
          )
        ),
        "paragraph",
        "foo",
        "bar",
        "image",
        "baz",
        "hard_break",
        "quux",
        "xyz"
      );
    });
  });

  describe("textBetween", () => {
    it("adds block separator around empty paragraphs", () => {
      expect(doc(p("one"), p(), p("two")).textBetween(0, 12, "\n")).toBe(
        "one\n\ntwo"
      );
    });

    it("adds block separator around leaf nodes", () => {
      expect(
        doc(p("one"), hr(), hr(), p("two")).textBetween(0, 12, "\n", "---")
      ).toBe("one\n---\n---\ntwo");
    });

    it("doesn't add block separator around non-rendered leaf nodes", () => {
      expect(doc(p("one"), hr(), hr(), p("two")).textBetween(0, 12, "\n")).toBe(
        "one\ntwo"
      );
    });
  });

  describe("textContent", () => {
    it("works on a whole doc", () => {
      expect(doc(p("foo")).textContent).toBe("foo");
    });

    it("works on a text node", () => {
      expect(schema.text("foo").textContent).toBe("foo");
    });

    it("works on a nested element", () => {
      expect(doc(ul(li(p("hi")), li(p(em("a"), "b")))).textContent).toBe("hiab");
    });
  });

  describe("from", () => {
    function testFrom(
      arg: Node | Node[] | Fragment | null,
      expected: Node
    ) {
      expect(eq(expected.copy(Fragment.from(arg)), expected)).toBe(true);
    }

    it("wraps a single node", () => {
      testFrom(schema.node("paragraph"), doc(p()));
    });

    it("wraps an array", () => {
      testFrom(
        [schema.node("hard_break"), schema.text("foo")],
        p(br(), "foo")
      );
    });

    it("preserves a fragment", () => {
      testFrom(doc(p("foo")).content, doc(p("foo")));
    });

    it("accepts null", () => {
      testFrom(null, p());
    });

    it("joins adjacent text", () => {
      testFrom([schema.text("a"), schema.text("b")], p("ab"));
    });
  });

  describe("toJSON", () => {
    function roundTrip(doc: Node) {
      expect(eq(schema.nodeFromJSON(doc.toJSON()), doc)).toBe(true);
    }

    it("can serialize a simple node", () => {
      roundTrip(doc(p("foo")));
    });

    it("can serialize marks", () => {
      roundTrip(doc(p("foo", em("bar", strong("baz")), " ", a("x"))));
    });

    it("can serialize inline leaf nodes", () => {
      roundTrip(doc(p("foo", em(img(), "bar"))));
    });

    it("can serialize block leaf nodes", () => {
      roundTrip(doc(p("a"), hr(), p("b"), p()));
    });

    it("can serialize nested nodes", () => {
      roundTrip(
        doc(
          blockquote(ul(li(p("a"), p("b")), li(p(img())))),
          p("c")
        )
      );
    });
  });
});
