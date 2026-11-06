import type { BulletAnalysis, CvAnalysis, CvExperience, JdAnalysis } from "@/data/types";
import {
  FAMILY_TERMS,
  GENERIC_PHRASES,
  IMPACT_DEMAND_TERMS,
  NUMBER_WORDS,
  OUTCOME_WORDS,
  QUALIFICATIONS,
  REQUIRED_MARKERS,
  STRONG_VERBS,
  WEAK_OPENINGS,
} from "./config";
import { findSkills, findTerms, hasTerm, normalise, ratio, sentences, startsWithTerm } from "./text";

// Stage 1 — text understanding (imitates NLP). Results are stored on the
// CV / application document when it is saved.

export function analyseBullet(text: string): BulletAnalysis {
  const n = normalise(text);
  const quantified = /\d/.test(text) || NUMBER_WORDS.some((w) => hasTerm(n, w));
  const weak = WEAK_OPENINGS.find((p) => startsWithTerm(n, p));
  const strongVerb = STRONG_VERBS.some((v) => startsWithTerm(n, v));
  const outcomeWord = OUTCOME_WORDS.some((w) => hasTerm(n, w)) || /\bfrom\b.+\bto\b/.test(n);
  const strength = quantified && (strongVerb || outcomeWord) ? "Strong" : quantified || strongVerb ? "Partial" : "Weak";
  const reasons: string[] = [];
  if (!quantified) reasons.push("No measurable result");
  if (weak) reasons.push(`Starts with "${weak}"`);
  else if (!strongVerb) reasons.push("No strong action verb");
  return { text, quantified, weakOpening: Boolean(weak), strongVerb, outcomeWord, strength, reasons };
}

export function analyseCv(cv: { personalStatement: string; experience: CvExperience[]; skillsSection: string[] }): CvAnalysis {
  const bullets = cv.experience.flatMap((e) => e.bullets).filter((b) => b.trim());
  const analysed = bullets.map(analyseBullet);
  const fullText = [cv.personalStatement, ...cv.experience.flatMap((e) => [e.role, ...e.bullets]), ...cv.skillsSection].join("\n");
  const statement = normalise(cv.personalStatement);
  const genericHits = findTerms(statement, GENERIC_PHRASES);
  const familiesNamed = Object.entries(FAMILY_TERMS)
    .filter(([, terms]) => terms!.some((t) => hasTerm(statement, t)))
    .map(([f]) => f);
  const genericReasons = [
    ...(genericHits.length ? [`Generic phrases: ${genericHits.slice(0, 3).join(", ")}`] : []),
    ...(familiesNamed.length >= 2 ? [`Names ${familiesNamed.length} different role types`] : []),
  ];
  return {
    bulletCount: analysed.length,
    quantifiedRatio: ratio(analysed.filter((b) => b.quantified).length, analysed.length),
    weakOpeningRatio: ratio(analysed.filter((b) => b.weakOpening).length, analysed.length),
    strongRatio: ratio(analysed.filter((b) => b.strength === "Strong").length, analysed.length),
    bullets: analysed,
    mentionedSkills: findSkills(fullText),
    genericStatement: genericReasons.length > 0,
    genericReasons,
  };
}

export function analyseJd(text: string): JdAnalysis {
  const empty: JdAnalysis = {
    requiredSkills: [],
    desirableSkills: [],
    requiredQualifications: [],
    minYears: null,
    impactDemand: false,
    requiresDegreeClass: null,
    keywords: [],
  };
  if (!text.trim()) return empty;

  const parts = sentences(text);
  const isRequired = (s: string) => REQUIRED_MARKERS.some((m) => hasTerm(normalise(s), m));
  const anyRequired = parts.some(isRequired);
  const required = new Set<string>();
  const desirable = new Set<string>();
  const quals = new Set<string>();

  for (const s of parts) {
    const skills = findSkills(s);
    // Adverts with no explicit "required" wording: treat every listed skill as required.
    const req = !anyRequired || isRequired(s);
    skills.forEach((k) => (req ? required.add(k) : desirable.add(k)));
    if (req) findTerms(normalise(s), QUALIFICATIONS).forEach((q) => quals.add(q));
  }
  required.forEach((k) => desirable.delete(k));

  const n = normalise(text);
  const yearMatches = [...text.matchAll(/(?:minimum of |at least |minimum )?(\d{1,2})\s*\+?\s*(?:years|yrs)/gi)].map((m) => Number(m[1]));
  const requiresDegreeClass = /first[- ]class/i.test(text) ? "First" : /\b2[:.]1\b|upper second/i.test(text) ? "2:1" : null;

  return {
    requiredSkills: [...required],
    desirableSkills: [...desirable],
    requiredQualifications: [...quals],
    minYears: yearMatches.length ? Math.max(...yearMatches) : null,
    impactDemand: IMPACT_DEMAND_TERMS.some((t) => hasTerm(n, t)),
    requiresDegreeClass,
    keywords: [...required, ...desirable].slice(0, 15),
  };
}
