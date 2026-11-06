import { SKILLS } from "./config";

/** Lower-case, unify quotes/dashes, keep characters that matter for matching (%, £, $, :, +, /). */
export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9%£$:+/'\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/** Whole-word / whole-phrase match on normalised text. */
export function hasTerm(normalisedText: string, term: string): boolean {
  const t = normalise(term).trim();
  if (!t) return false;
  return normalisedText.includes(` ${t} `);
}

export function findTerms(normalisedText: string, terms: string[]): string[] {
  return terms.filter((t) => hasTerm(normalisedText, t));
}

export function startsWithTerm(normalisedText: string, term: string): boolean {
  const t = normalise(term).trim();
  return normalisedText.trimStart().startsWith(`${t} `) || normalisedText.trim() === t;
}

/** Canonical skills found in text, using the alias lexicon. */
export function findSkills(text: string): string[] {
  const n = normalise(text);
  return Object.entries(SKILLS)
    .filter(([, aliases]) => aliases.some((a) => hasTerm(n, a)))
    .map(([skill]) => skill);
}

/** Map free-text skill tags (from a profile) to canonical skills, keeping unknown tags as-is. */
export function canonicalSkills(tags: string[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) {
    const found = findSkills(tag);
    if (found.length) found.forEach((s) => out.add(s));
    else if (tag.trim()) out.add(tag.trim().toLowerCase());
  }
  return [...out];
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\n+|•/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 0 at or below a, 1 at or above b, linear in between. */
export const linear = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
export const round2 = (x: number) => Math.round(x * 100) / 100;
export const ratio = (n: number, d: number) => (d > 0 ? n / d : 0);
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const pct = (x: number) => Math.round(x * 100);
