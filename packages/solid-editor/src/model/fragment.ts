import type { Schema } from "./schema";
import type { Node, TextNode } from "./node";

/**
 * A fragment represents a node's collection of child nodes.
 *
 * Like nodes, fragments are persistent data structures, and you
 * should not mutate them or their content. Rather, you create new
 * instances whenever needed.
 */
export class Fragment {
  /** The size of the fragment, which is the total of the size of its content nodes. */
  readonly size: number;

  constructor(
    /** The child nodes in this fragment. */
    readonly content: readonly Node[],
    size?: number
  ) {
    this.size = size ?? 0;
    if (size === undefined) {
      for (let i = 0; i < content.length; i++) {
        (this as { size: number }).size += content[i].nodeSize;
      }
    }
  }

  /**
   * Invoke a callback for all descendant nodes between the given two
   * positions (relative to start of this fragment).
   */
  nodesBetween(
    from: number,
    to: number,
    f: (
      node: Node,
      start: number,
      parent: Node | null,
      index: number
    ) => boolean | void,
    nodeStart = 0,
    parent?: Node
  ): void {
    for (let i = 0, pos = 0; pos < to; i++) {
      const child = this.content[i];
      const end = pos + child.nodeSize;
      if (
        end > from &&
        f(child, nodeStart + pos, parent || null, i) !== false &&
        child.content.size
      ) {
        const start = pos + 1;
        child.nodesBetween(
          Math.max(0, from - start),
          Math.min(child.content.size, to - start),
          f,
          nodeStart + start
        );
      }
      pos = end;
    }
  }

  /**
   * Call the given callback for every descendant node.
   */
  descendants(
    f: (
      node: Node,
      pos: number,
      parent: Node | null,
      index: number
    ) => boolean | void
  ): void {
    this.nodesBetween(0, this.size, f);
  }

  /**
   * Extract the text between `from` and `to`.
   */
  textBetween(
    from: number,
    to: number,
    blockSeparator?: string | null,
    leafText?: string | null | ((leafNode: Node) => string)
  ): string {
    let text = "";
    let first = true;
    this.nodesBetween(
      from,
      to,
      (node, pos) => {
        const nodeText = node.isText
          ? node.text!.slice(Math.max(from, pos) - pos, to - pos)
          : !node.isLeaf
            ? ""
            : leafText
              ? typeof leafText === "function"
                ? leafText(node)
                : leafText
              : (node.type.spec.leafText?.(node) ?? "");

        if (
          node.isBlock &&
          (node.isLeaf && nodeText) ||
          (node.isTextblock && blockSeparator)
        ) {
          if (first) first = false;
          else text += blockSeparator;
        }
        text += nodeText;
      },
      0
    );
    return text;
  }

  /**
   * Create a new fragment containing the combined content of this
   * fragment and the other.
   */
  append(other: Fragment): Fragment {
    if (!other.size) return this;
    if (!this.size) return other;

    const last = this.lastChild!;
    const first = other.firstChild!;
    const content = this.content.slice();
    let i = 0;

    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = (last as TextNode).withText(
        last.text! + first.text!
      );
      i = 1;
    }

    for (; i < other.content.length; i++) {
      content.push(other.content[i]);
    }

    return new Fragment(content, this.size + other.size);
  }

  /** Cut out the sub-fragment between the two given positions. */
  cut(from: number, to: number = this.size): Fragment {
    if (from === 0 && to === this.size) return this;

    const result: Node[] = [];
    let size = 0;

    if (to > from) {
      for (let i = 0, pos = 0; pos < to; i++) {
        let child = this.content[i];
        const end = pos + child.nodeSize;

        if (end > from) {
          if (pos < from || end > to) {
            if (child.isText) {
              child = child.cut(
                Math.max(0, from - pos),
                Math.min(child.text!.length, to - pos)
              );
            } else {
              child = child.cut(
                Math.max(0, from - pos - 1),
                Math.min(child.content.size, to - pos - 1)
              );
            }
          }
          result.push(child);
          size += child.nodeSize;
        }
        pos = end;
      }
    }

    return new Fragment(result, size);
  }

  /** Create a new fragment in which the node at the given index is replaced. */
  replaceChild(index: number, node: Node): Fragment {
    const current = this.content[index];
    if (current === node) return this;
    const copy = this.content.slice();
    const size = this.size + node.nodeSize - current.nodeSize;
    copy[index] = node;
    return new Fragment(copy, size);
  }

  /** Create a new fragment by prepending the given node. */
  addToStart(node: Node): Fragment {
    return new Fragment(
      [node].concat(this.content as Node[]),
      this.size + node.nodeSize
    );
  }

  /** Create a new fragment by appending the given node. */
  addToEnd(node: Node): Fragment {
    return new Fragment(
      (this.content as Node[]).concat(node),
      this.size + node.nodeSize
    );
  }

  /** Compare this fragment to another one. */
  eq(other: Fragment): boolean {
    if (this.content.length !== other.content.length) return false;
    for (let i = 0; i < this.content.length; i++) {
      if (!this.content[i].eq(other.content[i])) return false;
    }
    return true;
  }

  /** The first child of the fragment, or `null` if it is empty. */
  get firstChild(): Node | null {
    return this.content.length ? this.content[0] : null;
  }

  /** The last child of the fragment, or `null` if it is empty. */
  get lastChild(): Node | null {
    return this.content.length ? this.content[this.content.length - 1] : null;
  }

  /** The number of child nodes in this fragment. */
  get childCount(): number {
    return this.content.length;
  }

  /** Get the child node at the given index. Raises an error when out of range. */
  child(index: number): Node {
    const found = this.content[index];
    if (!found)
      throw new RangeError("Index " + index + " out of range for " + this);
    return found;
  }

  /** Get the child node at the given index, if it exists. */
  maybeChild(index: number): Node | null {
    return this.content[index] || null;
  }

  /** Call `f` for every child node, passing the node, its offset, and its index. */
  forEach(f: (node: Node, offset: number, index: number) => void): void {
    for (let i = 0, p = 0; i < this.content.length; i++) {
      const child = this.content[i];
      f(child, p, i);
      p += child.nodeSize;
    }
  }

  /**
   * Find the index and inner offset corresponding to a given relative
   * position in this fragment.
   */
  findIndex(pos: number): { index: number; offset: number } {
    if (pos === 0) return { index: 0, offset: pos };
    if (pos === this.size) return { index: this.content.length, offset: pos };
    if (pos > this.size || pos < 0)
      throw new RangeError(`Position ${pos} outside of fragment (${this})`);

    for (let i = 0, curPos = 0; ; i++) {
      const cur = this.child(i);
      const end = curPos + cur.nodeSize;
      if (end >= pos) {
        if (end === pos) return { index: i + 1, offset: end };
        return { index: i, offset: curPos };
      }
      curPos = end;
    }
  }

  /** Return a debugging string that describes this fragment. */
  toString(): string {
    return "<" + this.toStringInner() + ">";
  }

  toStringInner(): string {
    return this.content.join(", ");
  }

  /** Create a JSON-serializable representation of this fragment. */
  toJSON(): ReturnType<Node["toJSON"]>[] | null {
    return this.content.length ? this.content.map((n) => n.toJSON()) : null;
  }

  /** Deserialize a fragment from its JSON representation. */
  static fromJSON(schema: Schema, value: unknown): Fragment {
    if (!value) return Fragment.empty;
    if (!Array.isArray(value))
      throw new RangeError("Invalid input for Fragment.fromJSON");
    return new Fragment(value.map((v) => schema.nodeFromJSON(v)));
  }

  /**
   * Build a fragment from an array of nodes. Ensures that adjacent
   * text nodes with the same marks are joined together.
   */
  static fromArray(array: readonly Node[]): Fragment {
    if (!array.length) return Fragment.empty;

    let joined: Node[] | undefined;
    let size = 0;

    for (let i = 0; i < array.length; i++) {
      const node = array[i];
      size += node.nodeSize;

      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) joined = array.slice(0, i) as Node[];
        joined[joined.length - 1] = (joined[joined.length - 1] as TextNode).withText(
          (joined[joined.length - 1] as TextNode).text + (node as TextNode).text
        );
      } else if (joined) {
        joined.push(node);
      }
    }

    return new Fragment(joined || array, size);
  }

  /**
   * Create a fragment from something that can be interpreted as a
   * set of nodes.
   */
  static from(nodes?: Fragment | Node | readonly Node[] | null): Fragment {
    if (!nodes) return Fragment.empty;
    if (nodes instanceof Fragment) return nodes;
    if (Array.isArray(nodes)) return this.fromArray(nodes);
    if ((nodes as Node).attrs !== undefined)
      return new Fragment([nodes as Node], (nodes as Node).nodeSize);
    throw new RangeError("Can not convert " + nodes + " to a Fragment");
  }

  /** An empty fragment. Reused for nodes without children. */
  static empty: Fragment = new Fragment([], 0);
}
