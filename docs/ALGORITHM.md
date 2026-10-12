# The engine: hypothesis language and Candidate Elimination

This document explains the mathematics implemented in `src/lib/ce`. Slide numbers refer to the course
*Chapter 2: Machine Learning Theory — Learning by exploration* (N. Ben Amor).

## 1. Hypothesis language

A hypothesis is a conjunction of one constraint per attribute, `h = ⟨c₁, …, c_d⟩`. It covers an instance
`x = (x₁, …, x_d)` iff every `cᵢ` admits `xᵢ`. Internally a constraint is a tagged union
(`src/lib/ce/types.ts`):

| tag    | notation         | admits                                    |
| ------ | ---------------- | ----------------------------------------- |
| `any`  | `?`              | every value, including a missing value    |
| `none` | `∅`              | nothing                                   |
| `val`  | `team`           | exactly that categorical value            |
| `grp`  | `warm colour`    | every value of a hierarchy group          |
| `int`  | `[30, 40]`       | every grid value `lo ≤ v ≤ hi`            |

Dataset cells are `string | number | null`; `null` is a **missing value**, admitted only by `?`.

### Generality order 

`h₁ ⪰ h₂ ⇔ cover(h₂) ⊆ cover(h₁)`. For conjunctions this is the product of per-attribute orders:

* categorical: `c₁ ⪰ c₂ ⇔ leaves(c₂) ⊆ leaves(c₁)`, where `leaves(?)` is the whole domain;
* interval: `[a, b] ⪰ [c, d] ⇔ a ≤ c ∧ d ≤ b`, with `?` = `[min, max]`;
* any hypothesis containing `∅` covers nothing, so all of them are canonicalised to the single bottom
  element `⊥ = ⟨∅, …, ∅⟩`.

Canonical forms make equality syntactic: an interval equal to the whole domain becomes `?`, and a
group with a single member (`cold colour = {grey}`) is identified with that member (the top-most
node with the same extension is kept, so it is displayed as `cold colour`).

### Categorical hierarchies (Birds neck colour)

Values may be organised in a **tree** of named groups (`warm colour = {russet, orange}`,
`cold colour = {grey}`). The constraints of the attribute are the nodes of the tree. Because the
order is a tree:

* the least generalisation of a node `N` that admits `v` is the lowest common ancestor of `N` and `v`
  (unique) — e.g. `lub(russet, orange) = warm colour`;
* the maximal sub-constraints of `N` that reject `v` are the **siblings of the nodes on the path from
  `N` down to `v`** — e.g. from `?` rejecting `orange`: `{cold colour, russet}` (slide 81).

### Interval attributes (Birds size)

Values lie on the grid `min + k·step` (`min`, `max` may be ±∞; the course uses `[0, +∞[`, step 1).
Constraints are closed grid intervals:

* least generalisation of `[a, b]` admitting `v`: `[min(a, v), max(b, v)]`; of `∅`: `[v, v]`;
* maximal sub-intervals of `[a, b]` rejecting `v` (with `a ≤ v ≤ b`): `[a, v − step]` and
  `[v + step, b]`, each kept when non-empty — e.g. `?` rejecting 70 gives `[0, 69]` and `[71, +∞[`
  (slide 80).

The grid is what makes "minimal" well defined: on the reals there is no largest interval strictly
inside `[0, 70[`. This is stated explicitly instead of pretending that categorical constraints handle
numbers.

## 2. Minimal generalisation and specialisation

* `minimalGeneralizations(s, x)`: apply the per-attribute least generalisation to every attribute.
  For tree and interval orders it is unique, which is why `|S| = 1` throughout these languages.
* `minimalSpecializations(g, x)`: restrict **exactly one** attribute to one of its maximal
  sub-constraints rejecting `xᵢ`. Every maximal `h ≺ g` with `x ∉ cover(h)` has this form, because
  `x ∉ cover(h)` only requires one attribute to reject. If no attribute can be restricted, `⊥` is the
  only minimal specialisation.

## 3. Candidate Elimination 

```
G ← {⊤}, S ← {⊥}
for each example x:
  if x is positive:
    G ← { g ∈ G : g covers x }
    for s ∈ S not covering x:
      S ← S ∖ {s} ∪ { h ∈ mgen(s, x) : ∃g ∈ G, h ⪯ g }
    S ← min⪯(S)
  else:
    S ← { s ∈ S : s rejects x }
    for g ∈ G covering x:
      G ← G ∖ {g} ∪ { h ∈ mspec(g, x) : ∃s ∈ S, s ⪯ h }
    G ← max⪯(G)
```

`updateS` and `updateG` (`src/lib/ce/algorithm.ts`) implement one boundary update and return every
decision (checks, candidates, witnesses, pruned members). `candidateElimination` turns these into an
immutable trace: `init`, then for each example `present → filter → select → generate →
filter-candidates → prune → result`, each step carrying frozen `S` and `G` snapshots and the active
pseudocode lines. The simulator only moves an index through this array, so Previous/Next are exact.

The version space is empty iff `S = ∅` or `G = ∅` (slide 84). A resource guard stops the run with a
clear message if a boundary exceeds 5 000 hypotheses (G can grow exponentially).

## 4. Version space and lattice

`enumerateVersionSpace` lists `{ h : ∃s ∈ S, ∃g ∈ G, s ⪯ h ⪯ g }` exactly, as the union over pairs
`(s, g)` of products of per-attribute intervals of the constraint lattices. It reports `complete`,
`empty`, `infinite` (an unbounded interval is involved — the Birds version space is infinite) or
`too-large` (more than 20 000 candidates).

`buildLattice` draws:

* **complete** mode (≤ 120 members): every member of the version space, with the **Hasse edges** (the
  transitive reduction of `≺` restricted to the version space). Because the version space is convex,
  these are exactly the immediate generalisations of H inside it, and each one changes one constraint
  (the edge label, e.g. `Saturday → ?`, as on slide 77);
* **boundary** mode otherwise: S, G and verified sample hypotheses (e.g. h1–h3 of slide 82), with
  dashed edges meaning "more general, intermediate hypotheses hidden".

`⊤` and `⊥` are drawn as dashed anchors outside the version space. Nothing is invented to make the
picture look like a diamond: the Sport result is a diamond because its version space is one.

## 5. Classification 

`classifyWithVersionSpace` returns

* **positive** if every `s ∈ S` covers `x` (every member is ⪰ some `s`),
* **negative** if no `g ∈ G` covers `x` (every member is ⪯ some `g`),
* **undetermined** otherwise, and **no-hypothesis** if the version space is empty.

When the version space can be enumerated, the exact number of members voting each way is shown.
These are counts, not probabilities.

## 6. Verification

`tests/unit` contains:

* regression tests of every intermediate S/G of Sport (slides 75–77), Birds (slides 79–82),
  EnjoySport (slides 85–87) and the noisy example of slide 83;
* an **independent brute-force check**: enumerate all of H, keep the consistent hypotheses, take their
  minimal and maximal elements and compare with S and G — on every prefix of the course datasets and on
  300 random datasets mixing categorical attributes, hierarchies, finite interval attributes and
  missing values;
* tests of the trace (determinism, immutability, pseudocode lines), import parsers, exports and the
  presentation script.
