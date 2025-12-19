import { Fragment } from './fragment'
import { Mark } from './mark'
import { Node, TextNode } from './node'
import type { Attrs } from './types'

/**
 * Simplified content matching - parses content expressions and validates children.
 * This is a simplified version of ProseMirror's ContentMatch state machine.
 */
export class ContentMatch {
  private readonly allowedTypes: Set<string> = new Set()
  private readonly allowedGroups: Set<string> = new Set()
  private readonly minCount: number
  private readonly maxCount: number // -1 for unlimited
  private readonly isEmpty: boolean

  constructor(
    private readonly expr: string,
    private readonly schema: Schema,
  ) {
    this.isEmpty = !expr
    if (this.isEmpty) {
      this.minCount = 0
      this.maxCount = 0
      return
    }

    // Parse simple expressions like "block+", "inline*", "text*", "paragraph block*"
    // Split by space for sequences
    const parts = expr.split(/\s+/).filter(Boolean)

    let min = 0
    let max = 0

    for (const part of parts) {
      // Extract type/group name and quantifier
      const match = part.match(/^(\w+)([+*?]?)$/)
      if (!match) continue

      const [, name, quantifier] = match

      // Check if it's a specific type or a group
      if (schema.nodes[name]) {
        this.allowedTypes.add(name)
      } else {
        // Treat as a group
        this.allowedGroups.add(name)
      }

      // Handle quantifiers for min/max counting (simplified)
      switch (quantifier) {
        case '+':
          min = Math.max(min, 1)
          max = -1 // unlimited
          break
        case '*':
          max = -1
          break
        case '?':
          max = max === -1 ? -1 : max + 1
          break
        default:
          min = Math.max(min, 1)
          max = max === -1 ? -1 : max + 1
      }
    }

    this.minCount = min
    this.maxCount = max
  }

  /** Check if a node type is allowed as a child. */
  allowsType(type: NodeType): boolean {
    if (this.isEmpty) return false
    if (this.allowedTypes.has(type.name)) return true
    for (const group of this.allowedGroups) {
      if (type.isInGroup(group)) return true
    }
    return false
  }

  /** Validate that all children in the fragment are allowed. */
  validContent(fragment: Fragment): boolean {
    if (this.isEmpty) return fragment.childCount === 0

    // Check that all children are of allowed types
    for (let i = 0; i < fragment.childCount; i++) {
      const child = fragment.child(i)
      if (!this.allowsType(child.type)) return false
    }

    // Check minimum count
    if (fragment.childCount < this.minCount) return false

    // Check maximum count
    if (this.maxCount !== -1 && fragment.childCount > this.maxCount) return false

    return true
  }

  /** True if this match state represents a valid end state. */
  get validEnd(): boolean {
    return this.minCount === 0
  }

  /**
   * Try to match a node type. Returns this match (simplified - we don't
   * have a state machine, so we just check if the type is allowed).
   */
  matchType(type: NodeType): ContentMatch | null {
    return this.allowsType(type) ? this : null
  }

  /**
   * Find a wrapping sequence of node types that would allow the given
   * type to appear in this content. Returns an array of node types
   * (possibly empty) or null if no wrapping works.
   */
  findWrapping(type: NodeType): NodeType[] | null {
    // Direct match
    if (this.allowsType(type)) return []

    // Try wrapping in allowed types that could contain this type
    for (const typeName of this.allowedTypes) {
      const wrapType = this.schema.nodes[typeName]
      if (wrapType?.contentMatch?.allowsType(type)) {
        return [wrapType]
      }
    }

    // Try wrapping via groups
    for (const group of this.allowedGroups) {
      for (const name in this.schema.nodes) {
        const wrapType = this.schema.nodes[name]
        if (wrapType.isInGroup(group) && wrapType.contentMatch && wrapType.contentMatch.allowsType(type)) {
          return [wrapType]
        }
      }
    }

    return null
  }

  /**
   * Get the first allowed node type that can fill this content, if any.
   */
  defaultType(): NodeType | null {
    for (const typeName of this.allowedTypes) {
      const type = this.schema.nodes[typeName]
      if (type && !type.hasRequiredAttrs()) return type
    }
    for (const group of this.allowedGroups) {
      for (const name in this.schema.nodes) {
        const type = this.schema.nodes[name]
        if (type.isInGroup(group) && !type.hasRequiredAttrs()) return type
      }
    }
    return null
  }
}

/** Specification for defining attributes on nodes or marks. */
export interface AttributeSpec {
  /** The default value for this attribute. */
  default?: unknown
  /** A function or type name used to validate values of this attribute. */
  validate?: string | ((value: unknown) => void)
}

/** Specification for defining a node type. */
export interface NodeSpec {
  /** The content expression for this node. */
  content?: string
  /** The marks allowed inside this node. */
  marks?: string
  /** The group(s) this node belongs to. */
  group?: string
  /** Whether this is an inline node. */
  inline?: boolean
  /** Whether this node is an atom (not directly editable). */
  atom?: boolean
  /** The attributes for nodes of this type. */
  attrs?: { [name: string]: AttributeSpec }
  /** Whether nodes of this type can be selected. */
  selectable?: boolean
  /** Whether nodes of this type can be dragged. */
  draggable?: boolean
  /** Whether this node contains code. */
  code?: boolean
  /** How whitespace in this node is parsed. */
  whitespace?: 'pre' | 'normal'
  /** Whether this node is a defining context. */
  definingAsContext?: boolean
  /** Whether this node defines content. */
  definingForContent?: boolean
  /** Shorthand for both defining properties. */
  defining?: boolean
  /** Whether sides of this node count as boundaries. */
  isolating?: boolean
  /** Custom debug string function. */
  toDebugString?: (node: Node) => string
  /** Custom leaf text function. */
  leafText?: (node: Node) => string
  /** Whether this is a linebreak replacement node. */
  linebreakReplacement?: boolean
  /** Allow additional properties. */
  [key: string]: unknown
}

/** Specification for defining a mark type. */
export interface MarkSpec {
  /** The attributes for marks of this type. */
  attrs?: { [name: string]: AttributeSpec }
  /** Whether this mark is inclusive at cursor position. */
  inclusive?: boolean
  /** Which other marks this mark excludes. */
  excludes?: string
  /** The group(s) this mark belongs to. */
  group?: string
  /** Whether this mark can span multiple adjacent nodes. */
  spanning?: boolean
  /** Whether this mark represents code. */
  code?: boolean
  /** Allow additional properties. */
  [key: string]: unknown
}

/** Specification for a schema. */
export interface SchemaSpec<Nodes extends string = string, Marks extends string = string> {
  /** The node types in this schema. */
  nodes: { [name in Nodes]: NodeSpec }
  /** The mark types in this schema. */
  marks?: { [name in Marks]: MarkSpec }
  /** The name of the top-level node type. */
  topNode?: string
}

// Attribute handling

class Attribute {
  readonly hasDefault: boolean
  readonly default: unknown
  readonly validate?: (value: unknown) => void

  constructor(typeName: string, attrName: string, options: AttributeSpec) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, 'default')
    this.default = options.default

    if (typeof options.validate === 'string') {
      const types = options.validate.split('|')
      this.validate = (value: unknown) => {
        const name = value === null ? 'null' : typeof value
        if (!types.includes(name)) {
          throw new RangeError(
            `Expected value of type ${types.join(' or ')} for attribute ${attrName} on type ${typeName}, got ${name}`,
          )
        }
      }
    } else {
      this.validate = options.validate
    }
  }

  get isRequired(): boolean {
    return !this.hasDefault
  }
}

function initAttrs(typeName: string, attrs?: { [name: string]: AttributeSpec }): { [name: string]: Attribute } {
  const result: { [name: string]: Attribute } = Object.create(null)
  if (attrs) {
    for (const name in attrs) {
      result[name] = new Attribute(typeName, name, attrs[name])
    }
  }
  return result
}

function defaultAttrs(attrs: { [name: string]: Attribute }): Attrs | null {
  const defaults: { [name: string]: unknown } = Object.create(null)
  for (const attrName in attrs) {
    const attr = attrs[attrName]
    if (!attr.hasDefault) return null
    defaults[attrName] = attr.default
  }
  return defaults
}

function computeAttrs(attrs: { [name: string]: Attribute }, value: Attrs | null): Attrs {
  const built: { [name: string]: unknown } = Object.create(null)
  for (const name in attrs) {
    let given = value?.[name]
    if (given === undefined) {
      const attr = attrs[name]
      if (attr.hasDefault) given = attr.default
      else throw new RangeError(`No value supplied for attribute ${name}`)
    }
    built[name] = given
  }
  return built
}

/**
 * Node types are objects allocated once per Schema and used to
 * tag Node instances with their type.
 */
export class NodeType {
  /** The groups this node type belongs to. */
  readonly groups: readonly string[]
  /** @internal */
  readonly attrs: { [name: string]: Attribute }
  /** @internal */
  readonly defaultAttrs: Attrs | null
  /** True if this is a block type. */
  readonly isBlock: boolean
  /** True if this is the text node type. */
  readonly isText: boolean
  /** True if this node has inline content. */
  inlineContent = false
  /** The set of marks allowed in this node. */
  markSet: readonly MarkType[] | null = null
  /** @internal Content match for validating children. */
  contentMatch: ContentMatch | null = null

  constructor(
    /** The name of this node type. */
    readonly name: string,
    /** The schema this node type belongs to. */
    readonly schema: Schema,
    /** The spec this type is based on. */
    readonly spec: NodeSpec,
  ) {
    this.groups = spec.group ? spec.group.split(' ') : []
    this.attrs = initAttrs(name, spec.attrs)
    this.defaultAttrs = defaultAttrs(this.attrs)
    this.isBlock = !(spec.inline || name === 'text')
    this.isText = name === 'text'
  }

  /** True if this is an inline type. */
  get isInline(): boolean {
    return !this.isBlock
  }

  /** True if this is a textblock type. */
  get isTextblock(): boolean {
    return this.isBlock && this.inlineContent
  }

  /** True for node types that allow no content. */
  get isLeaf(): boolean {
    return !this.spec.content
  }

  /** True when this node is an atom. */
  get isAtom(): boolean {
    return this.isLeaf || !!this.spec.atom
  }

  /** The whitespace option for this node type. */
  get whitespace(): 'pre' | 'normal' {
    return this.spec.whitespace || (this.spec.code ? 'pre' : 'normal')
  }

  /** Return true when this node type is part of the given group. */
  isInGroup(group: string): boolean {
    return this.groups.includes(group)
  }

  /** Check whether this node type has any required attributes. */
  hasRequiredAttrs(): boolean {
    for (const n in this.attrs) {
      if (this.attrs[n].isRequired) return true
    }
    return false
  }

  /**
   * Indicates whether this node allows some of the same content as
   * the given node type.
   */
  compatibleContent(other: NodeType): boolean {
    if (this === other) return true
    // Check if there's overlap in allowed content
    if (!this.contentMatch || !other.contentMatch) {
      return this.inlineContent === other.inlineContent
    }
    // Both must allow at least one common type
    for (const name in this.schema.nodes) {
      const type = this.schema.nodes[name]
      if (this.contentMatch.allowsType(type) && other.contentMatch.allowsType(type)) {
        return true
      }
    }
    return false
  }

  /** @internal */
  computeAttrs(attrs: Attrs | null): Attrs {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    return computeAttrs(this.attrs, attrs)
  }

  /**
   * Create a Node of this type.
   */
  create(
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[] | null,
    marks?: readonly Mark[],
  ): Node {
    if (this.isText) throw new Error("NodeType.create can't construct text nodes")
    return new Node(this, this.computeAttrs(attrs), Fragment.from(content), Mark.setFrom(marks))
  }

  /**
   * Like create, but checks the given content against the node type's
   * content restrictions.
   */
  createChecked(
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[] | null,
    marks?: readonly Mark[],
  ): Node {
    const fragment = Fragment.from(content)
    this.checkContent(fragment)
    return new Node(this, this.computeAttrs(attrs), fragment, Mark.setFrom(marks))
  }

  /**
   * Like create, but tries to fill in required content.
   */
  createAndFill(
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[] | null,
    marks?: readonly Mark[],
  ): Node | null {
    const computedAttrs = this.computeAttrs(attrs)
    const fragment = Fragment.from(content)
    // Simplified: just return the node if content is valid
    if (this.validContent(fragment)) {
      return new Node(this, computedAttrs, fragment, Mark.setFrom(marks))
    }
    return null
  }

  /** Returns true if the given fragment is valid content for this node type. */
  validContent(content: Fragment): boolean {
    // Check content types against content expression
    if (this.contentMatch && !this.contentMatch.validContent(content)) {
      return false
    }
    // Also check marks
    for (let i = 0; i < content.childCount; i++) {
      if (!this.allowsMarks(content.child(i).marks)) return false
    }
    return true
  }

  /** Throws if the given fragment is not valid content. */
  checkContent(content: Fragment): void {
    if (!this.validContent(content)) {
      throw new RangeError(`Invalid content for node ${this.name}: ${content.toString().slice(0, 50)}`)
    }
  }

  /** Check whether the given mark type is allowed in this node. */
  allowsMarkType(markType: MarkType): boolean {
    return this.markSet === null || this.markSet.includes(markType)
  }

  /** Test whether the given set of marks are allowed in this node. */
  allowsMarks(marks: readonly Mark[]): boolean {
    if (this.markSet === null) return true
    for (let i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) return false
    }
    return true
  }

  /** Removes marks not allowed in this node from the given set. */
  allowedMarks(marks: readonly Mark[]): readonly Mark[] {
    if (this.markSet === null) return marks
    let copy: Mark[] | undefined
    for (let i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        if (!copy) copy = marks.slice(0, i)
      } else if (copy) {
        copy.push(marks[i])
      }
    }
    return !copy ? marks : copy.length ? copy : Mark.none
  }

  /**
   * Get the content match at a specific child index.
   * Simplified: returns the same contentMatch since we don't have a state machine.
   */
  contentMatchAt(_index: number): ContentMatch {
    if (!this.contentMatch) {
      throw new Error(`No content match for node type ${this.name}`)
    }
    return this.contentMatch
  }

  /**
   * Test whether replacing the range from `from` to `to` with the given
   * replacement fragment would leave the node's content valid.
   */
  canReplaceWith(_from: number, _to: number, type: NodeType, marks?: readonly Mark[]): boolean {
    if (!this.contentMatch) return false
    if (!this.contentMatch.allowsType(type)) return false
    if (marks && !this.allowsMarks(marks)) return false
    return true
  }

  /** @internal */
  static compile<Nodes extends string>(
    nodes: { [name in Nodes]: NodeSpec },
    schema: Schema,
  ): { readonly [name in Nodes]: NodeType } {
    const result: { [name: string]: NodeType } = Object.create(null)

    for (const name in nodes) {
      result[name] = new NodeType(name, schema, nodes[name])
    }

    const topType = schema.spec.topNode || 'doc'
    if (!result[topType]) throw new RangeError(`Schema is missing its top node type ('${topType}')`)
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")
    for (const _ in result.text.attrs) throw new RangeError('The text node type should not have attributes')

    return result as { readonly [name in Nodes]: NodeType }
  }
}

/**
 * Mark types are objects allocated once per Schema that describe
 * a type of mark (like emphasis or links).
 */
export class MarkType {
  /** @internal */
  readonly attrs: { [name: string]: Attribute }
  /** Marks that this mark type excludes. */
  excluded: readonly MarkType[] = []
  /** @internal */
  readonly instance: Mark | null

  constructor(
    /** The name of this mark type. */
    readonly name: string,
    /** The rank of this mark type (determines ordering). */
    readonly rank: number,
    /** The schema this mark type belongs to. */
    readonly schema: Schema,
    /** The spec this type is based on. */
    readonly spec: MarkSpec,
  ) {
    this.attrs = initAttrs(name, spec.attrs)
    const defaults = defaultAttrs(this.attrs)
    this.instance = defaults ? new Mark(this, defaults) : null
  }

  /** Create a mark of this type. */
  create(attrs: Attrs | null = null): Mark {
    if (!attrs && this.instance) return this.instance
    return new Mark(this, computeAttrs(this.attrs, attrs))
  }

  /** Remove marks of this type from the given set. */
  removeFromSet(set: readonly Mark[]): readonly Mark[] {
    for (let i = 0; i < set.length; i++) {
      if (set[i].type === this) {
        set = set.slice(0, i).concat(set.slice(i + 1))
        i--
      }
    }
    return set
  }

  /** Test whether there is a mark of this type in the given set. */
  isInSet(set: readonly Mark[]): Mark | undefined {
    for (let i = 0; i < set.length; i++) {
      if (set[i].type === this) return set[i]
    }
    return undefined
  }

  /** Test whether this mark type excludes the given mark type. */
  excludes(other: MarkType): boolean {
    return this.excluded.includes(other)
  }

  /** @internal */
  static compile(marks: { [name: string]: MarkSpec }, schema: Schema): { [name: string]: MarkType } {
    const result: { [name: string]: MarkType } = Object.create(null)
    let rank = 0
    for (const name in marks) {
      result[name] = new MarkType(name, rank++, schema, marks[name])
    }
    return result
  }
}

/**
 * A document schema. Holds node and mark type objects for the nodes
 * and marks that may occur in conforming documents.
 */
export class Schema<Nodes extends string = string, Marks extends string = string> {
  /** The spec this schema is based on. */
  readonly spec: SchemaSpec<Nodes, Marks>
  /** An object mapping node names to node type objects. */
  readonly nodes: { readonly [name in Nodes]: NodeType } & {
    readonly [key: string]: NodeType
  }
  /** A map from mark names to mark type objects. */
  readonly marks: { readonly [name in Marks]: MarkType } & {
    readonly [key: string]: MarkType
  }
  /** The type of the default top node. */
  readonly topNodeType: NodeType
  /** Linebreak replacement node, if any. */
  readonly linebreakReplacement: NodeType | null = null

  constructor(spec: SchemaSpec<Nodes, Marks>) {
    this.spec = spec

    this.nodes = NodeType.compile(spec.nodes, this as Schema)
    this.marks = MarkType.compile(spec.marks || {}, this as Schema) as {
      readonly [name in Marks]: MarkType
    } & { readonly [key: string]: MarkType }

    // Set up content matching (simplified version)
    for (const name in this.nodes) {
      if (name in this.marks) {
        throw new RangeError(`${name} can not be both a node and a mark`)
      }
      const type = this.nodes[name]
      const contentExpr = type.spec.content || ''
      const markExpr = type.spec.marks

      // Simplified: set inlineContent based on content expression
      type.inlineContent = contentExpr.includes('inline') || contentExpr.includes('text')

      // Set up content matching for validation
      type.contentMatch = new ContentMatch(contentExpr, this as Schema)

      // Handle linebreak replacement
      if (type.spec.linebreakReplacement) {
        if (this.linebreakReplacement) throw new RangeError('Multiple linebreak nodes defined')
        if (!type.isInline || !type.isLeaf)
          throw new RangeError('Linebreak replacement nodes must be inline leaf nodes')
        ;(this as { linebreakReplacement: NodeType }).linebreakReplacement = type
      }

      // Set up allowed marks
      type.markSet =
        markExpr === '_'
          ? null
          : markExpr
            ? this.gatherMarks(markExpr.split(' '))
            : markExpr === '' || !type.inlineContent
              ? []
              : null
    }

    // Set up mark exclusions
    for (const name in this.marks) {
      const type = this.marks[name]
      const excl = type.spec.excludes
      ;(type as { excluded: readonly MarkType[] }).excluded =
        excl === undefined ? [type] : excl === '' ? [] : this.gatherMarks(excl.split(' '))
    }

    this.topNodeType = this.nodes[spec.topNode || 'doc']
  }

  private gatherMarks(names: readonly string[]): MarkType[] {
    const found: MarkType[] = []
    for (const name of names) {
      const mark = this.marks[name]
      if (mark) {
        found.push(mark)
      } else {
        for (const prop in this.marks) {
          const m = this.marks[prop]
          if (name === '_' || m.spec.group?.split(' ').includes(name)) {
            found.push(m)
          }
        }
      }
    }
    return found
  }

  /**
   * Create a node in this schema.
   */
  node(
    type: string | NodeType,
    attrs: Attrs | null = null,
    content?: Fragment | Node | readonly Node[],
    marks?: readonly Mark[],
  ): Node {
    if (typeof type === 'string') {
      type = this.nodeType(type)
    } else if (!(type instanceof NodeType)) {
      throw new RangeError(`Invalid node type: ${type}`)
    } else if (type.schema !== this) {
      throw new RangeError(`Node type from different schema used (${type.name})`)
    }
    return type.createChecked(attrs, content, marks)
  }

  /**
   * Create a text node in the schema.
   */
  text(text: string, marks?: readonly Mark[] | null): Node {
    const type = this.nodes.text
    return new TextNode(type, type.defaultAttrs!, text, Mark.setFrom(marks))
  }

  /**
   * Create a mark with the given type and attributes.
   */
  mark(type: string | MarkType, attrs?: Attrs | null): Mark {
    if (typeof type === 'string') type = this.marks[type]
    return type.create(attrs)
  }

  /** Deserialize a node from its JSON representation. */
  nodeFromJSON(json: ReturnType<Node['toJSON']>): Node {
    return Node.fromJSON(this, json)
  }

  /** Deserialize a mark from its JSON representation. */
  markFromJSON(json: ReturnType<Mark['toJSON']>): Mark {
    return Mark.fromJSON(this, json)
  }

  /** Get a node type by name. */
  nodeType(name: string): NodeType {
    const found = this.nodes[name]
    if (!found) throw new RangeError(`Unknown node type: ${name}`)
    return found
  }
}
