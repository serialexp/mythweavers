/**
 * Common types used throughout the model.
 */

/** An object holding the attributes of a node or mark. */
export type Attrs = { readonly [attr: string]: unknown }

/** Empty attributes object, reused for nodes without attributes. */
export const emptyAttrs: Attrs = Object.create(null)
