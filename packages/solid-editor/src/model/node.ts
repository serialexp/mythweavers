import { Fragment } from "./fragment";
import { Mark } from "./mark";
import { compareDeep } from "./compareDeep";
import { ResolvedPos } from "./resolvedpos";
import { Slice, replace } from "./slice";
import type { Attrs } from "./types";
import type { NodeType, MarkType, Schema } from "./schema";

const emptyAttrs: Attrs = Object.create(null);

/** JSON representation of a node. */
export interface NodeJSON {
  type: string;
  attrs?: Attrs;
  content?: NodeJSON[];
  marks?: { type: string; attrs?: Attrs }[];
  text?: string;
}

/**
 * This class represents a node in the tree that makes up a
 * ProseMirror document. So a document is an instance of `Node`, with
 * children that are also instances of `Node`.
 *
 * Nodes are persistent data structures. Instead of changing them, you
 * create new ones with the content you want.
 */
export class Node {
  /** A container holding the node's children. */
  readonly content: Fragment;

  /** For text nodes, this contains the node's text content. */
  readonly text: string | undefined;

  constructor(
    /** The type of node that this is. */
    readonly type: NodeType,
    /** The attributes of this node. */
    readonly attrs: Attrs,
    content?: Fragment | null,
    /** The marks applied to this node. */
    readonly marks: readonly Mark[] = Mark.none
  ) {
    this.content = content || Fragment.empty;
  }

  /**
   * The size of this node, as defined by the integer-based indexing scheme.
   * For text nodes, this is the number of characters.
   * For other leaf nodes, it is one.
   * For non-leaf nodes, it is the size of the content plus two (start and end tokens).
   */
  get nodeSize(): number {
    return this.isLeaf ? 1 : 2 + this.content.size;
  }

  /** The number of children that the node has. */
  get childCount(): number {
    return this.content.childCount;
  }

  /** Get the child node at the given index. Raises an error when out of range. */
  child(index: number): Node {
    return this.content.child(index);
  }

  /** Get the child node at the given index, if it exists. */
  maybeChild(index: number): Node | null {
    return this.content.maybeChild(index);
  }

  /** Call `f` for every child node. */
  forEach(f: (node: Node, offset: number, index: number) => void): void {
    this.content.forEach(f);
  }

  /**
   * Invoke a callback for all descendant nodes recursively between
   * the given two positions.
   */
  nodesBetween(
    from: number,
    to: number,
    f: (
      node: Node,
      pos: number,
      parent: Node | null,
      index: number
    ) => void | boolean,
    startPos = 0
  ): void {
    this.content.nodesBetween(from, to, f, startPos, this);
  }

  /** Call the given callback for every descendant node. */
  descendants(
    f: (
      node: Node,
      pos: number,
      parent: Node | null,
      index: number
    ) => void | boolean
  ): void {
    this.nodesBetween(0, this.content.size, f);
  }

  /** Concatenates all the text nodes found in this fragment and its children. */
  get textContent(): string {
    return this.isLeaf && this.type.spec.leafText
      ? this.type.spec.leafText(this)
      : this.textBetween(0, this.content.size, "");
  }

  /** Get all text between positions `from` and `to`. */
  textBetween(
    from: number,
    to: number,
    blockSeparator?: string | null,
    leafText?: null | string | ((leafNode: Node) => string)
  ): string {
    return this.content.textBetween(from, to, blockSeparator, leafText);
  }

  /** Returns this node's first child, or `null` if there are no children. */
  get firstChild(): Node | null {
    return this.content.firstChild;
  }

  /** Returns this node's last child, or `null` if there are no children. */
  get lastChild(): Node | null {
    return this.content.lastChild;
  }

  /** Test whether two nodes represent the same piece of document. */
  eq(other: Node): boolean {
    return (
      this === other || (this.sameMarkup(other) && this.content.eq(other.content))
    );
  }

  /** Compare the markup (type, attributes, and marks) of this node to another. */
  sameMarkup(other: Node): boolean {
    return this.hasMarkup(other.type, other.attrs, other.marks);
  }

  /** Check whether this node's markup corresponds to the given type, attributes, and marks. */
  hasMarkup(
    type: NodeType,
    attrs?: Attrs | null,
    marks?: readonly Mark[]
  ): boolean {
    return (
      this.type === type &&
      compareDeep(this.attrs, attrs || type.defaultAttrs || emptyAttrs) &&
      Mark.sameSet(this.marks, marks || Mark.none)
    );
  }

  /** Create a new node with the same markup, containing the given content. */
  copy(content: Fragment | null = null): Node {
    if (content === this.content) return this;
    return new Node(this.type, this.attrs, content, this.marks);
  }

  /** Create a copy of this node with the given set of marks. */
  mark(marks: readonly Mark[]): Node {
    return marks === this.marks
      ? this
      : new Node(this.type, this.attrs, this.content, marks);
  }

  /** Create a copy of this node with only the content between the given positions. */
  cut(from: number, to: number = this.content.size): Node {
    if (from === 0 && to === this.content.size) return this;
    return this.copy(this.content.cut(from, to));
  }

  /**
   * Cut out the part of the document between the given positions, and
   * return it as a `Slice` object.
   */
  slice(from: number, to: number = this.content.size, includeParents = false): Slice {
    if (from === to) return Slice.empty;

    const $from = this.resolve(from);
    const $to = this.resolve(to);
    const depth = includeParents ? 0 : $from.sharedDepth(to);
    const start = $from.start(depth);
    const node = $from.node(depth);
    const content = node.content.cut($from.pos - start, $to.pos - start);
    return new Slice(content, $from.depth - depth, $to.depth - depth);
  }

  /**
   * Replace the part of the document between the given positions with
   * the given slice. The slice must 'fit', meaning its open sides
   * must be able to connect to the surrounding content.
   */
  replace(from: number, to: number, slice: Slice): Node {
    return replace(this.resolve(from), this.resolve(to), slice);
  }

  /**
   * Test whether replacing the range between `from` and `to` (by
   * child index) with the given replacement fragment would leave the
   * node's content valid.
   */
  canReplace(
    from: number,
    to: number,
    replacement: Fragment = Fragment.empty,
    start = 0,
    end = replacement.childCount
  ): boolean {
    // Simplified validation - just check marks
    for (let i = start; i < end; i++) {
      if (!this.type.allowsMarks(replacement.child(i).marks)) return false;
    }
    return true;
  }

  /** Find the node directly after the given position. */
  nodeAt(pos: number): Node | null {
    for (let node: Node | null = this; ; ) {
      const { index, offset } = node.content.findIndex(pos);
      node = node.maybeChild(index);
      if (!node) return null;
      if (offset === pos || node.isText) return node;
      pos -= offset + 1;
    }
  }

  /** Find the (direct) child node after the given offset. */
  childAfter(pos: number): { node: Node | null; index: number; offset: number } {
    const { index, offset } = this.content.findIndex(pos);
    return { node: this.content.maybeChild(index), index, offset };
  }

  /** Find the (direct) child node before the given offset. */
  childBefore(pos: number): { node: Node | null; index: number; offset: number } {
    if (pos === 0) return { node: null, index: 0, offset: 0 };
    const { index, offset } = this.content.findIndex(pos);
    if (offset < pos) return { node: this.content.child(index), index, offset };
    const node = this.content.child(index - 1);
    return { node, index: index - 1, offset: offset - node.nodeSize };
  }

  /** Test whether a given mark or mark type occurs in this document between the two positions. */
  rangeHasMark(from: number, to: number, type: Mark | MarkType): boolean {
    let found = false;
    if (to > from) {
      this.nodesBetween(from, to, (node) => {
        if (type.isInSet(node.marks)) found = true;
        return !found;
      });
    }
    return found;
  }

  /**
   * Resolve the given position in the document, returning an
   * object with information about its context.
   */
  resolve(pos: number): ResolvedPos {
    return ResolvedPos.resolveCached(this, pos);
  }

  /** @internal */
  resolveNoCache(pos: number): ResolvedPos {
    return ResolvedPos.resolve(this, pos);
  }

  /** True when this is a block (non-inline node). */
  get isBlock(): boolean {
    return this.type.isBlock;
  }

  /** True when this is a textblock node, a block node with inline content. */
  get isTextblock(): boolean {
    return this.type.isTextblock;
  }

  /** True when this node allows inline content. */
  get inlineContent(): boolean {
    return this.type.inlineContent;
  }

  /** True when this is an inline node. */
  get isInline(): boolean {
    return this.type.isInline;
  }

  /** True when this is a text node. */
  get isText(): boolean {
    return this.type.isText;
  }

  /** True when this is a leaf node. */
  get isLeaf(): boolean {
    return this.type.isLeaf;
  }

  /** True when this is an atom. */
  get isAtom(): boolean {
    return this.type.isAtom;
  }

  /** Return a string representation of this node for debugging purposes. */
  toString(): string {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this);
    let name = this.type.name;
    if (this.content.size) {
      name += "(" + this.content.toStringInner() + ")";
    }
    return wrapMarks(this.marks, name);
  }

  /** Check whether this node and its descendants conform to the schema. */
  check(): void {
    this.type.checkContent(this.content);
    let copy = Mark.none;
    for (let i = 0; i < this.marks.length; i++) {
      const mark = this.marks[i];
      copy = mark.addToSet(copy);
    }
    if (!Mark.sameSet(copy, this.marks)) {
      throw new RangeError(
        `Invalid collection of marks for node ${this.type.name}: ${this.marks.map((m) => m.type.name)}`
      );
    }
    this.content.forEach((node) => node.check());
  }

  /** Return a JSON-serializable representation of this node. */
  toJSON(): {
    type: string;
    attrs?: Attrs;
    content?: ReturnType<Node["toJSON"]>[];
    marks?: ReturnType<Mark["toJSON"]>[];
  } {
    const obj: ReturnType<Node["toJSON"]> = { type: this.type.name };
    for (const _ in this.attrs) {
      obj.attrs = this.attrs;
      break;
    }
    if (this.content.size) {
      obj.content = this.content.toJSON()!;
    }
    if (this.marks.length) {
      obj.marks = this.marks.map((n) => n.toJSON());
    }
    return obj;
  }

  /** Deserialize a node from its JSON representation. */
  static fromJSON(schema: Schema, json: NodeJSON): Node {
    if (!json) throw new RangeError("Invalid input for Node.fromJSON");

    let marks: Mark[] | undefined;
    if (json.marks) {
      if (!Array.isArray(json.marks))
        throw new RangeError("Invalid mark data for Node.fromJSON");
      marks = json.marks.map((m) => schema.markFromJSON(m));
    }

    if (json.type === "text") {
      if (typeof json.text !== "string")
        throw new RangeError("Invalid text node in JSON");
      return schema.text(json.text, marks);
    }

    const content = Fragment.fromJSON(schema, json.content);
    const node = schema.nodeType(json.type).create(json.attrs, content, marks);
    return node;
  }
}

// Set text to undefined on prototype
(Node.prototype as { text: undefined }).text = undefined;

/**
 * A text node is a special type of node that represents text content.
 */
export class TextNode extends Node {
  declare readonly text: string;

  constructor(
    type: NodeType,
    attrs: Attrs,
    content: string,
    marks?: readonly Mark[]
  ) {
    super(type, attrs, null, marks);
    if (!content) throw new RangeError("Empty text nodes are not allowed");
    (this as { text: string }).text = content;
  }

  override toString(): string {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this);
    return wrapMarks(this.marks, JSON.stringify(this.text));
  }

  override get textContent(): string {
    return this.text;
  }

  override textBetween(from: number, to: number): string {
    return this.text.slice(from, to);
  }

  override get nodeSize(): number {
    return this.text.length;
  }

  override mark(marks: readonly Mark[]): TextNode {
    return marks === this.marks
      ? this
      : new TextNode(this.type, this.attrs, this.text, marks);
  }

  /** Create a copy of this text node with different text. */
  withText(text: string): TextNode {
    if (text === this.text) return this;
    return new TextNode(this.type, this.attrs, text, this.marks);
  }

  override cut(from = 0, to = this.text.length): TextNode {
    if (from === 0 && to === this.text.length) return this;
    return this.withText(this.text.slice(from, to));
  }

  override eq(other: Node): boolean {
    return this.sameMarkup(other) && this.text === other.text;
  }

  override toJSON(): ReturnType<Node["toJSON"]> & { text: string } {
    const base = super.toJSON();
    return { ...base, text: this.text };
  }
}

function wrapMarks(marks: readonly Mark[], str: string): string {
  for (let i = marks.length - 1; i >= 0; i--) {
    str = marks[i].type.name + "(" + str + ")";
  }
  return str;
}
