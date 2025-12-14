import {
  Schema,
  Node,
  NodeType,
  MarkType,
  type Attrs,
  type SchemaSpec,
} from "../src/model";

type Tags = { [tag: string]: number };

export type ChildSpec = string | Node | { flat: readonly Node[]; tag: Tags };

const noTag: Tags = Object.create(null);

// Attach tag property to Node prototype
(Node.prototype as unknown as { tag: Tags }).tag = noTag;

function flatten(
  schema: Schema,
  children: ChildSpec[],
  f: (node: Node) => Node
): { nodes: Node[]; tag: Tags } {
  const result: Node[] = [];
  let pos = 0;
  let tag: Tags = noTag;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    if (typeof child === "string") {
      // Parse position markers like <a>, <b>
      const re = /<(\w+)>/g;
      let m: RegExpExecArray | null;
      let at = 0;
      let out = "";

      while ((m = re.exec(child))) {
        out += child.slice(at, m.index);
        pos += m.index - at;
        at = m.index + m[0].length;
        if (tag === noTag) tag = Object.create(null);
        tag[m[1]] = pos;
      }

      out += child.slice(at);
      pos += child.length - at;
      if (out) result.push(f(schema.text(out)));
    } else {
      const childWithTag = child as { tag?: Tags; flat?: readonly Node[] };

      if (childWithTag.tag && childWithTag.tag !== noTag) {
        if (tag === noTag) tag = Object.create(null);
        for (const id in childWithTag.tag) {
          tag[id] =
            childWithTag.tag[id] +
            (childWithTag.flat || (child as Node).isText ? 0 : 1) +
            pos;
        }
      }

      if (childWithTag.flat) {
        for (let j = 0; j < childWithTag.flat.length; j++) {
          const node = f(childWithTag.flat[j]);
          pos += node.nodeSize;
          result.push(node);
        }
      } else {
        const node = f(child as Node);
        pos += node.nodeSize;
        result.push(node);
      }
    }
  }

  return { nodes: result, tag };
}

function id<T>(x: T): T {
  return x;
}

function takeAttrs(
  attrs: Attrs | null,
  args: [a?: Attrs | ChildSpec, ...b: ChildSpec[]]
): Attrs | null {
  const a0 = args[0];
  if (
    !args.length ||
    (a0 &&
      (typeof a0 === "string" ||
        a0 instanceof Node ||
        (a0 as { flat?: unknown }).flat))
  ) {
    return attrs;
  }

  args.shift();
  if (!attrs) return a0 as Attrs;
  if (!a0) return attrs;

  const result: { [key: string]: unknown } = {};
  for (const prop in attrs) result[prop] = attrs[prop];
  for (const prop in a0 as Attrs) result[prop] = (a0 as Attrs)[prop];
  return result;
}

export type NodeBuilder = (
  attrsOrFirstChild?: Attrs | ChildSpec,
  ...children: ChildSpec[]
) => Node & { tag: Tags };

export type MarkBuilder = (
  attrsOrFirstChild?: Attrs | ChildSpec,
  ...children: ChildSpec[]
) => ChildSpec;

type Builders<S extends Schema> = {
  schema: S;
} & {
  [key: string]: NodeBuilder | MarkBuilder;
};

/** Create a builder function for nodes with content. */
function block(type: NodeType, attrs: Attrs | null = null): NodeBuilder {
  const result = function (...args: unknown[]) {
    const myAttrs = takeAttrs(attrs, args as [Attrs | ChildSpec, ...ChildSpec[]]);
    const { nodes, tag } = flatten(
      type.schema,
      args as ChildSpec[],
      id
    );
    const node = type.create(myAttrs, nodes);
    if (tag !== noTag) (node as unknown as { tag: Tags }).tag = tag;
    return node;
  };

  if (type.isLeaf) {
    try {
      (result as unknown as { flat: Node[] }).flat = [type.create(attrs)];
    } catch (_) {
      // Ignore errors for leaf nodes without required attrs
    }
  }

  return result as NodeBuilder;
}

/** Create a builder function for marks. */
function mark(type: MarkType, attrs: Attrs | null): MarkBuilder {
  return function (...args: unknown[]) {
    const markInstance = type.create(
      takeAttrs(attrs, args as [Attrs | ChildSpec, ...ChildSpec[]])
    );
    const { nodes, tag } = flatten(
      type.schema,
      args as ChildSpec[],
      (n) => {
        const newMarks = markInstance.addToSet(n.marks);
        return newMarks.length > n.marks.length ? n.mark(newMarks) : n;
      }
    );
    return { flat: nodes, tag };
  };
}

/**
 * Create builder functions for a schema.
 *
 * Usage:
 * ```ts
 * const b = builders(mySchema, {
 *   p: { nodeType: "paragraph" },
 *   em: { markType: "em" },
 * });
 *
 * const doc = b.doc(b.p("Hello ", b.em("world")));
 * ```
 */
export function builders<S extends Schema>(
  schema: S,
  names?: { [name: string]: Attrs & { nodeType?: string; markType?: string } }
): Builders<S> {
  const result: { [key: string]: unknown } = { schema };

  // Create builders for all node types
  for (const name in schema.nodes) {
    result[name] = block(schema.nodes[name], {});
  }

  // Create builders for all mark types
  for (const name in schema.marks) {
    result[name] = mark(schema.marks[name], {});
  }

  // Create custom builders from names map
  if (names) {
    for (const name in names) {
      const value = names[name];
      const typeName = value.nodeType || value.markType || name;
      const nodeType = schema.nodes[typeName];
      const markType = schema.marks[typeName];

      if (nodeType) {
        result[name] = block(nodeType, value);
      } else if (markType) {
        result[name] = mark(markType, value);
      }
    }
  }

  return result as Builders<S>;
}

/**
 * Compare two nodes for equality, for use in test assertions.
 */
export function eq<T extends { eq(other: T): boolean }>(a: T, b: T): boolean {
  return a.eq(b);
}
