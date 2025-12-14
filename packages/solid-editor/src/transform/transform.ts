import { Node, Fragment, Slice } from "../model";
import { Mapping } from "./map";
import { Step, StepResult } from "./step";
import { ReplaceStep } from "./replace_step";

/**
 * Error type for transform failures.
 */
export class TransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformError";
  }
}

/**
 * Abstraction to build up and track an array of steps representing
 * a document transformation.
 *
 * Most transforming methods return the `Transform` object itself, so
 * that they can be chained.
 */
export class Transform {
  /** The steps in this transform. */
  readonly steps: Step[] = [];
  /** The documents before each of the steps. */
  readonly docs: Node[] = [];
  /** A mapping with the maps for each of the steps in this transform. */
  readonly mapping: Mapping = new Mapping();

  /** Create a transform that starts with the given document. */
  constructor(
    /** The current document (the result of applying the steps in the transform). */
    public doc: Node
  ) {}

  /** The starting document. */
  get before(): Node {
    return this.docs.length ? this.docs[0] : this.doc;
  }

  /**
   * Apply a new step in this transform, saving the result. Throws an
   * error when the step fails.
   */
  step(step: Step): this {
    const result = this.maybeStep(step);
    if (result.failed) throw new TransformError(result.failed);
    return this;
  }

  /**
   * Try to apply a step in this transformation, ignoring it if it
   * fails. Returns the step result.
   */
  maybeStep(step: Step): StepResult {
    const result = step.apply(this.doc);
    if (!result.failed) this.addStep(step, result.doc!);
    return result;
  }

  /** True when the document has been changed (when there are any steps). */
  get docChanged(): boolean {
    return this.steps.length > 0;
  }

  /** @internal */
  addStep(step: Step, doc: Node): void {
    this.docs.push(this.doc);
    this.steps.push(step);
    this.mapping.appendMap(step.getMap());
    this.doc = doc;
  }

  /**
   * Replace the part of the document between `from` and `to` with the
   * given `slice`.
   */
  replace(from: number, to = from, slice = Slice.empty): this {
    const step = replaceStep(this.doc, from, to, slice);
    if (step) this.step(step);
    return this;
  }

  /**
   * Replace the given range with the given content, which may be a
   * fragment, node, or array of nodes.
   */
  replaceWith(from: number, to: number, content: Fragment | Node | readonly Node[]): this {
    return this.replace(from, to, new Slice(Fragment.from(content), 0, 0));
  }

  /** Delete the content between the given positions. */
  delete(from: number, to: number): this {
    return this.replace(from, to, Slice.empty);
  }

  /** Insert the given content at the given position. */
  insert(pos: number, content: Fragment | Node | readonly Node[]): this {
    return this.replaceWith(pos, pos, content);
  }

  /**
   * Insert the given text at the given position, inheriting marks from
   * the position.
   */
  insertText(text: string, from: number, to = from): this {
    const schema = this.doc.type.schema;
    const $from = this.doc.resolve(from);
    // Get marks at this position
    const marks = to === from ? $from.marks() : [];
    return this.replaceWith(from, to, schema.text(text, marks));
  }
}

/**
 * Create a ReplaceStep that fits a slice into a given position.
 * Returns null if the replace would be a no-op.
 *
 * This is a simplified version - the full ProseMirror implementation
 * has sophisticated fitting logic for complex cases.
 */
export function replaceStep(
  doc: Node,
  from: number,
  to = from,
  slice = Slice.empty
): Step | null {
  if (from === to && !slice.size) return null;

  const $from = doc.resolve(from);
  const $to = doc.resolve(to);

  // Simple case: no open nodes and we're replacing within the same parent
  if (fitsTrivially($from, $to, slice)) {
    return new ReplaceStep(from, to, slice);
  }

  // For now, just create the step and let it fail if it doesn't fit.
  // The full implementation would use the Fitter class to adjust the slice.
  return new ReplaceStep(from, to, slice);
}

/**
 * Check if a slice fits trivially at the given position.
 */
function fitsTrivially(
  $from: { start(): number; parent: Node; index(): number },
  $to: { start(): number; index(): number },
  slice: Slice
): boolean {
  return (
    !slice.openStart &&
    !slice.openEnd &&
    $from.start() === $to.start() &&
    $from.parent.canReplace($from.index(), $to.index(), slice.content)
  );
}
