import { describe, it, expect } from "vitest";
import { Node, Slice } from "../src/model";
import { doc, p, blockquote, ul, li, em, a, h1 } from "./schema";
import { eq } from "./builder";

describe("Node", () => {
  describe("slice", () => {
    function t(
      docNode: Node & { tag: { a?: number; b?: number } },
      expected: Node,
      openStart: number,
      openEnd: number
    ) {
      const from = docNode.tag.a ?? 0;
      const to = docNode.tag.b;
      const slice = docNode.slice(from, to);
      expect(slice.content.eq(expected.content)).toBe(true);
      expect(slice.openStart).toBe(openStart);
      expect(slice.openEnd).toBe(openEnd);
    }

    it("can cut half a paragraph", () => {
      t(doc(p("hello<b> world")), doc(p("hello")), 0, 1);
    });

    it("can cut to the end of a paragraph", () => {
      t(doc(p("hello<b>")), doc(p("hello")), 0, 1);
    });

    it("leaves off extra content", () => {
      t(doc(p("hello<b> world"), p("rest")), doc(p("hello")), 0, 1);
    });

    it("preserves styles", () => {
      t(doc(p("hello ", em("WOR<b>LD"))), doc(p("hello ", em("WOR"))), 0, 1);
    });

    it("can cut multiple blocks", () => {
      t(doc(p("a"), p("b<b>")), doc(p("a"), p("b")), 0, 1);
    });

    it("can cut to a top-level position", () => {
      t(doc(p("a"), "<b>", p("b")), doc(p("a")), 0, 0);
    });

    it("can cut to a deep position", () => {
      t(
        doc(blockquote(ul(li(p("a")), li(p("b<b>"))))),
        doc(blockquote(ul(li(p("a")), li(p("b"))))),
        0,
        4
      );
    });

    it("can cut everything after a position", () => {
      t(doc(p("hello<a> world")), doc(p(" world")), 1, 0);
    });

    it("can cut from the start of a textblock", () => {
      t(doc(p("<a>hello")), doc(p("hello")), 1, 0);
    });

    it("leaves off extra content before", () => {
      t(doc(p("foo"), p("bar<a>baz")), doc(p("baz")), 1, 0);
    });

    it("preserves styles after cut", () => {
      t(
        doc(
          p("a sentence with an ", em("emphasized ", a("li<a>nk")), " in it")
        ),
        doc(p(em(a("nk")), " in it")),
        1,
        0
      );
    });

    it("preserves styles started after cut", () => {
      t(
        doc(p("a ", em("sentence"), " wi<a>th ", em("text"), " in it")),
        doc(p("th ", em("text"), " in it")),
        1,
        0
      );
    });

    it("can cut from a top-level position", () => {
      t(doc(p("a"), "<a>", p("b")), doc(p("b")), 0, 0);
    });

    it("can cut from a deep position", () => {
      t(
        doc(blockquote(ul(li(p("a")), li(p("<a>b"))))),
        doc(blockquote(ul(li(p("b"))))),
        4,
        0
      );
    });

    it("can cut part of a text node", () => {
      t(doc(p("hell<a>o wo<b>rld")), p("o wo"), 0, 0);
    });

    it("can cut across paragraphs", () => {
      t(doc(p("on<a>e"), p("t<b>wo")), doc(p("e"), p("t")), 1, 1);
    });

    it("can cut part of marked text", () => {
      t(
        doc(p("here's noth<a>ing and ", em("here's e<b>m"))),
        p("ing and ", em("here's e")),
        0,
        0
      );
    });

    it("can cut across different depths", () => {
      t(
        doc(
          ul(li(p("hello")), li(p("wo<a>rld")), li(p("x"))),
          p(em("bo<b>o"))
        ),
        doc(ul(li(p("rld")), li(p("x"))), p(em("bo"))),
        3,
        1
      );
    });

    it("can cut between deeply nested nodes", () => {
      t(
        doc(
          blockquote(
            p("foo<a>bar"),
            ul(li(p("a")), li(p("b"), "<b>", p("c"))),
            p("d")
          )
        ),
        blockquote(p("bar"), ul(li(p("a")), li(p("b")))),
        1,
        2
      );
    });

    it("can include parents", () => {
      const d = doc(blockquote(p("fo<a>o"), p("bar<b>"))) as Node & {
        tag: { a: number; b: number };
      };
      const slice = d.slice(d.tag.a, d.tag.b, true);
      expect(slice.toString()).toBe(
        '<blockquote(paragraph("o"), paragraph("bar"))>(2,2)'
      );
    });
  });

  describe("replace", () => {
    function rpl(
      docNode: Node & { tag: { a: number; b: number } },
      insert: (Node & { tag: { a: number; b: number } }) | null,
      expected: Node
    ) {
      const slice = insert
        ? insert.slice(insert.tag.a, insert.tag.b)
        : Slice.empty;
      expect(eq(docNode.replace(docNode.tag.a, docNode.tag.b, slice), expected)).toBe(
        true
      );
    }

    it("joins on delete", () => {
      rpl(doc(p("on<a>e"), p("t<b>wo")), null, doc(p("onwo")));
    });

    it("merges matching blocks", () => {
      rpl(
        doc(p("on<a>e"), p("t<b>wo")),
        doc(p("xx<a>xx"), p("yy<b>yy")),
        doc(p("onxx"), p("yywo"))
      );
    });

    it("merges when adding text", () => {
      rpl(doc(p("on<a>e"), p("t<b>wo")), doc(p("<a>H<b>")), doc(p("onHwo")));
    });

    it("can insert text", () => {
      rpl(
        doc(p("before"), p("on<a><b>e"), p("after")),
        doc(p("<a>H<b>")),
        doc(p("before"), p("onHe"), p("after"))
      );
    });

    it("doesn't merge non-matching blocks", () => {
      rpl(
        doc(p("on<a>e"), p("t<b>wo")),
        doc(h1("<a>H<b>")),
        doc(p("onHwo"))
      );
    });

    it("can merge a nested node", () => {
      rpl(
        doc(blockquote(blockquote(p("on<a>e"), p("t<b>wo")))),
        doc(p("<a>H<b>")),
        doc(blockquote(blockquote(p("onHwo"))))
      );
    });

    it("can replace within a block", () => {
      rpl(
        doc(blockquote(p("a<a>bc<b>d"))),
        doc(p("x<a>y<b>z")),
        doc(blockquote(p("ayd")))
      );
    });

    it("can insert a split", () => {
      rpl(
        doc(p("foo<a><b>bar")),
        doc(p("<a>x"), p("y<b>")),
        doc(p("foox"), p("ybar"))
      );
    });

    it("keeps the node type of the left node", () => {
      rpl(
        doc(h1("foo<a>bar"), "<b>"),
        doc(p("foo<a>baz"), "<b>"),
        doc(h1("foobaz"))
      );
    });

    it("keeps the node type even when empty", () => {
      rpl(
        doc(h1("<a>bar"), "<b>"),
        doc(p("foo<a>baz"), "<b>"),
        doc(h1("baz"))
      );
    });

    function bad(
      docNode: Node & { tag: { a: number; b: number } },
      insert: (Node & { tag: { a: number; b: number } }) | null,
      pattern: string
    ) {
      const slice = insert
        ? insert.slice(insert.tag.a, insert.tag.b)
        : Slice.empty;
      expect(() =>
        docNode.replace(docNode.tag.a, docNode.tag.b, slice)
      ).toThrow(new RegExp(pattern, "i"));
    }

    it("doesn't allow the left side to be too deep", () => {
      bad(doc(p("<a><b>")), doc(blockquote(p("<a>")), "<b>"), "deeper");
    });

    it("doesn't allow a depth mismatch", () => {
      bad(doc(p("<a><b>")), doc("<a>", p("<b>")), "inconsistent");
    });

    it("rejects a bad fit", () => {
      bad(doc("<a><b>"), doc(p("<a>foo<b>")), "invalid content");
    });

    it("rejects unjoinable content", () => {
      bad(
        doc(ul(li(p("a")), "<a>"), "<b>"),
        doc(p("foo", "<a>"), "<b>"),
        "cannot join"
      );
    });

    it("rejects an unjoinable delete", () => {
      bad(
        doc(blockquote(p("a"), "<a>"), ul("<b>", li(p("b")))),
        null,
        "cannot join"
      );
    });

    it("checks content validity", () => {
      bad(
        doc(blockquote("<a>", p("hi")), "<b>"),
        doc(blockquote("hi", "<a>"), "<b>"),
        "invalid content"
      );
    });
  });
});
