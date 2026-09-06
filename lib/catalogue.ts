import rows from '../data/schemes.json';
import type { Scheme } from './types';
export const catalogue = rows as Scheme[];
export const categories = [
  'All schemes',
  ...new Set(catalogue.map((s) => s.category)),
];
