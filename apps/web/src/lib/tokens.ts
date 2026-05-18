/**
 * imovi design tokens
 * Single source of truth for all colours used across components.
 * Import as: import { tokens as C } from '@/lib/tokens';
 */
export const tokens = {
  // Backgrounds
  bg:          '#07090e',
  surface:     '#0d1118',
  surface2:    '#141c27',
  surface3:    '#1b2535',

  // Borders
  border:      '#1e2d3f',
  borderMid:   '#273a52',

  // Text
  text:        '#dde5f0',
  text2:       '#5e7080',
  text3:       '#2b3a4a',

  // Accent (emerald green)
  accent:      '#00d97e',
  accentDim:   'rgba(0,217,126,0.08)',
  accentMid:   'rgba(0,217,126,0.20)',
  accentGlow:  'rgba(0,217,126,0.06)',

  // Semantic
  positive:    '#4ade80',
  negative:    '#f87171',
  blue:        '#4f8ef7',
  blueDim:     'rgba(79,142,247,0.10)',
  amber:       '#f8b740',
} as const;

export type Tokens = typeof tokens;
