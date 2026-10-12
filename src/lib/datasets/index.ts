/**
 * Built-in datasets. Sport and Birds are transcribed from the course
 * (N. Ben Amor, Chapter 2, slides 73–82); EnjoySport is Mitchell's example
 * used on slides 83–87.
 */
import type { Dataset } from '../ce/types';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const SPORT: Dataset = {
  id: 'sport',
  name: 'Sport',
  source: 'Course, slides 73–78',
  description: 'Which sports events are concepts of interest? 3 positive and 2 negative examples, 5 categorical attributes. The final version space has 6 hypotheses.',
  attributes: [
    { kind: 'categorical', name: 'Sport', values: ['football', 'hockey', 'gymnastics', 'handball', 'decathlon'] },
    { kind: 'categorical', name: 'Type', values: ['team', 'individual'] },
    { kind: 'categorical', name: 'Place', values: ['outdoor', 'indoor'] },
    { kind: 'categorical', name: 'Level', values: ['national', 'world'] },
    { kind: 'categorical', name: 'Day', values: days },
  ],
  examples: [
    { id: 'x1', values: ['football', 'team', 'outdoor', 'national', 'Saturday'], label: true },
    { id: 'x2', values: ['hockey', 'team', 'outdoor', 'national', 'Saturday'], label: true },
    { id: 'x3', values: ['gymnastics', 'individual', 'indoor', 'world', 'Saturday'], label: false },
    { id: 'x4', values: ['handball', 'team', 'indoor', 'national', 'Saturday'], label: true },
    { id: 'x5', values: ['decathlon', 'individual', 'outdoor', 'world', 'Sunday'], label: false },
  ],
  testInstances: [
    { label: 'National handball match on Sunday', values: ['handball', 'team', 'indoor', 'national', 'Sunday'] },
    { label: 'Hockey world final on Saturday', values: ['hockey', 'team', 'outdoor', 'world', 'Saturday'] },
    { label: 'Individual world event on Monday', values: ['gymnastics', 'individual', 'indoor', 'world', 'Monday'] },
  ],
};

export const BIRDS: Dataset = {
  id: 'birds',
  name: 'Birds',
  source: 'Course, slides 79–82',
  description: 'Ducks (+) versus penguins (−). Size is an interval attribute on the integer grid [0, +∞[; neck colour uses the hierarchy warm = {russet, orange}, cold = {grey}.',
  attributes: [
    { kind: 'categorical', name: 'Flat bill', values: ['True', 'False'] },
    { kind: 'interval', name: 'Size', min: 0, max: Infinity, step: 1, unit: 'cm' },
    {
      kind: 'categorical',
      name: 'Neck colour',
      values: ['russet', 'orange', 'grey'],
      hierarchy: [
        { name: 'warm colour', members: ['russet', 'orange'] },
        { name: 'cold colour', members: ['grey'] },
      ],
    },
  ],
  examples: [
    { id: 'duck 1', values: ['True', 30, 'russet'], label: true },
    { id: 'penguin 1', values: ['False', 70, 'grey'], label: false },
    { id: 'duck 2', values: ['True', 40, 'orange'], label: true },
    { id: 'penguin 2', values: ['False', 60, 'orange'], label: false },
  ],
  sampleHypotheses: [
    { label: 'h1', h: [{ t: 'val', v: 'True' }, { t: 'int', lo: 30, hi: 55 }, { t: 'any' }] },
    { label: 'h2', h: [{ t: 'val', v: 'True' }, { t: 'int', lo: 0, hi: 59 }, { t: 'grp', g: 'warm colour' }] },
    { label: 'h3', h: [{ t: 'any' }, { t: 'int', lo: 0, hi: 42 }, { t: 'any' }] },
  ],
  testInstances: [
    { label: 'Small flat-billed russet bird', values: ['True', 35, 'russet'] },
    { label: 'Large grey bird without flat bill', values: ['False', 80, 'grey'] },
    { label: 'Medium orange bird without flat bill', values: ['False', 50, 'orange'] },
  ],
};

const enjoyAttrs: Dataset['attributes'] = [
  { kind: 'categorical', name: 'Sky', values: ['Sunny', 'Cloudy', 'Rainy'] },
  { kind: 'categorical', name: 'Temp', values: ['Warm', 'Cold'] },
  { kind: 'categorical', name: 'Humidity', values: ['Normal', 'High'] },
  { kind: 'categorical', name: 'Wind', values: ['Strong', 'Weak'] },
  { kind: 'categorical', name: 'Water', values: ['Warm', 'Cool'] },
  { kind: 'categorical', name: 'Forecast', values: ['Same', 'Change'] },
];

export const ENJOY_SPORT: Dataset = {
  id: 'enjoysport',
  name: 'EnjoySport',
  source: 'Mitchell (1997), course slides 85–87',
  description: 'The classic EnjoySport data. It yields the 6-hypothesis version space of slide 85, used on slides 86–87 to classify new days.',
  attributes: enjoyAttrs,
  examples: [
    { id: 'd1', values: ['Sunny', 'Warm', 'Normal', 'Strong', 'Warm', 'Same'], label: true },
    { id: 'd2', values: ['Sunny', 'Warm', 'High', 'Strong', 'Warm', 'Same'], label: true },
    { id: 'd3', values: ['Rainy', 'Cold', 'High', 'Strong', 'Warm', 'Change'], label: false },
    { id: 'd4', values: ['Sunny', 'Warm', 'High', 'Strong', 'Cool', 'Change'], label: true },
  ],
  testInstances: [
    { label: 'Slide 86 — A', values: ['Sunny', 'Warm', 'Normal', 'Strong', 'Cool', 'Change'] },
    { label: 'Slide 87 — B', values: ['Rainy', 'Cold', 'Normal', 'Weak', 'Warm', 'Same'] },
    { label: 'Slide 87 — C', values: ['Sunny', 'Warm', 'Normal', 'Weak', 'Warm', 'Same'] },
    { label: 'Slide 87 — D', values: ['Sunny', 'Cold', 'Normal', 'Strong', 'Warm', 'Same'] },
  ],
};

export const ENJOY_SPORT_NOISY: Dataset = {
  id: 'enjoysport-noisy',
  name: 'Noisy EnjoySport',
  source: 'Course, slide 83 (limits)',
  description: 'Slide 83: example 2 is labelled negative although the concept is conjunctive. With example 4, G becomes empty and the version space collapses.',
  attributes: enjoyAttrs,
  examples: [
    { id: 'd1', values: ['Sunny', 'Warm', 'Normal', 'Strong', 'Warm', 'Same'], label: true },
    { id: 'd2', values: ['Sunny', 'Warm', 'High', 'Strong', 'Warm', 'Same'], label: false },
    { id: 'd3', values: ['Rainy', 'Cold', 'High', 'Strong', 'Warm', 'Change'], label: false },
    { id: 'd4', values: ['Sunny', 'Warm', 'High', 'Strong', 'Cool', 'Change'], label: true },
  ],
};

export const CONTRADICTION: Dataset = {
  id: 'contradiction',
  name: 'Contradictory labels',
  source: 'Synthetic',
  description: 'The same instance appears once as positive and once as negative (plus a repeated example). No hypothesis can be consistent: the version space becomes empty.',
  attributes: [
    { kind: 'categorical', name: 'Shape', values: ['circle', 'square', 'triangle'] },
    { kind: 'categorical', name: 'Colour', values: ['red', 'green', 'blue'] },
    { kind: 'categorical', name: 'Size', values: ['small', 'large'] },
  ],
  examples: [
    { id: 'a', values: ['circle', 'red', 'small'], label: true },
    { id: 'a (repeat)', values: ['circle', 'red', 'small'], label: true },
    { id: 'b', values: ['square', 'green', 'large'], label: false },
    { id: 'a (contradiction)', values: ['circle', 'red', 'small'], label: false },
  ],
};

export const SHAPES_BRANCHING: Dataset = {
  id: 'shapes-branching',
  name: 'Shapes — wide G boundary',
  source: 'Synthetic',
  description: 'One positive and one completely different negative example give a G boundary with four hypotheses; later examples prune it.',
  attributes: [
    { kind: 'categorical', name: 'Shape', values: ['circle', 'square', 'triangle'] },
    { kind: 'categorical', name: 'Colour', values: ['red', 'green', 'blue'] },
    { kind: 'categorical', name: 'Size', values: ['small', 'large'] },
    { kind: 'categorical', name: 'Fill', values: ['solid', 'hollow'] },
  ],
  examples: [
    { id: 's1', values: ['circle', 'red', 'small', 'solid'], label: true },
    { id: 's2', values: ['square', 'green', 'large', 'hollow'], label: false },
    { id: 's3', values: ['circle', 'red', 'large', 'solid'], label: true },
  ],
};

export const SHAPES_CONVERGE: Dataset = {
  id: 'shapes-converge',
  name: 'Shapes — convergence',
  source: 'Synthetic',
  description: 'Target concept "red circle". After five examples S and G meet: the concept is learnt exactly (slide 84).',
  attributes: SHAPES_BRANCHING.attributes,
  examples: [
    { id: 'c1', values: ['circle', 'red', 'small', 'solid'], label: true },
    { id: 'c2', values: ['square', 'green', 'large', 'hollow'], label: false },
    { id: 'c3', values: ['circle', 'red', 'large', 'hollow'], label: true },
    { id: 'c4', values: ['circle', 'green', 'small', 'solid'], label: false },
    { id: 'c5', values: ['triangle', 'red', 'small', 'solid'], label: false },
  ],
};

export const BUILTIN_DATASETS: Dataset[] = [SPORT, BIRDS, ENJOY_SPORT, ENJOY_SPORT_NOISY, CONTRADICTION, SHAPES_BRANCHING, SHAPES_CONVERGE];

export function emptyCustomDataset(): Dataset {
  return {
    id: 'custom',
    name: 'Custom dataset',
    source: 'Your data',
    description: 'Edit attributes and examples, or import a CSV / Excel / JSON file.',
    attributes: [
      { kind: 'categorical', name: 'A1', values: ['a', 'b'] },
      { kind: 'categorical', name: 'A2', values: ['x', 'y'] },
    ],
    examples: [
      { id: 'e1', values: ['a', 'x'], label: true },
      { id: 'e2', values: ['b', 'y'], label: false },
    ],
  };
}
