/**
 * Core types of the Candidate Elimination engine.
 *
 * The engine is framework-free TypeScript: it has no dependency on React,
 * Next.js or the browser, so it can be unit-tested in isolation.
 */

/** A dataset cell. `null` is the typed representation of a missing value. */
export type Cell = string | number | null;

/** A named group in a categorical value hierarchy, e.g. warm = {russet, orange}. */
export interface HierarchyGroup {
  name: string;
  /** Leaf values and/or names of other groups (nested hierarchies are allowed). */
  members: string[];
}

export interface CategoricalAttribute {
  kind: 'categorical';
  name: string;
  values: string[];
  /** Optional tree-structured hierarchy over the values (slide 79: warm/cold colours). */
  hierarchy?: HierarchyGroup[];
}

/**
 * Numerical attribute described by intervals (slide 79, Birds "Size").
 * Values live on the grid { min + k·step }. `min`/`max` may be ±Infinity,
 * which reproduces the course's notation [71, +∞[.
 */
export interface IntervalAttribute {
  kind: 'interval';
  name: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export type AttributeSpec = CategoricalAttribute | IntervalAttribute;

/**
 * One attribute constraint of a conjunctive hypothesis.
 *  - any  : "?"  — accepts every value (and a missing value)
 *  - none : "∅"  — accepts no value
 *  - val  : a single categorical value
 *  - grp  : a group of a categorical hierarchy (accepts all its leaves)
 *  - int  : a closed interval [lo, hi] of a numerical attribute
 */
export type Constraint =
  | { readonly t: 'any' }
  | { readonly t: 'none' }
  | { readonly t: 'val'; readonly v: string }
  | { readonly t: 'grp'; readonly g: string }
  | { readonly t: 'int'; readonly lo: number; readonly hi: number };

/** A conjunctive hypothesis: one constraint per attribute. */
export type Hypothesis = readonly Constraint[];

export interface Example {
  id: string;
  values: Cell[];
  /** true = positive example (c(x) = 1), false = negative example. */
  label: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  source?: string;
  attributes: AttributeSpec[];
  examples: Example[];
  /** Optional course hypotheses to display as verified samples of the version space. */
  sampleHypotheses?: { label: string; h: Hypothesis }[];
  /** Optional instances to try in the classifier. */
  testInstances?: { label: string; values: Cell[] }[];
}

export class CEResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CEResourceError';
  }
}

export class CEValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CEValidationError';
  }
}
