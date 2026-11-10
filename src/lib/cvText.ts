import type { CvExperience } from "@/data/types";

// Basic text splitting for pasted or extracted CV text. The user checks
// and corrects the result in the structured form before saving.
//
// Real CVs vary a lot, especially once a PDF or Word file has been turned into text:
// bullet symbols may be lost or odd characters, long bullets wrap onto several lines,
// and the role, employer and dates may sit on one line or on separate lines.

type Section = "statement" | "experience" | "skills" | "other";

// Words that make up section headings ("Work Experience", "Technical Skills", "Projects"…).
const HEADING_WORDS = new Set(
  (
    "work professional relevant industry internship internships experience experiences employment history career projects project academic " +
    "personal key technical core skills skill summary profile objective statement about me education qualifications qualification certifications " +
    "certification certificates achievements accomplishments awards interests hobbies references languages publications activities extracurricular " +
    "extra-curricular volunteering volunteer leadership positions position of responsibility responsibilities and contact details information courses " +
    "coursework training tools technologies competencies strengths highlights honours honors declaration research"
  ).split(" "),
);

function headingType(line: string): Section | null {
  if (line.length > 50 || /\d|[.,;]$|@/.test(line)) return null;
  const words = line
    .toLowerCase()
    .replace(/^[#*\s]+|[:#*\s]+$/g, "")
    .replace(/[&/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 5 || !words.every((w) => HEADING_WORDS.has(w))) return null;
  const has = (re: RegExp) => words.some((w) => re.test(w));
  if (has(/^(experiences?|employment|internships?|projects?|work|volunteer(ing)?|leadership|positions?|responsibilit(y|ies)|research)$/) && !has(/^(skills?|education|qualifications?)$/)) return "experience";
  if (has(/^(skills?|competencies|tools|technologies|strengths)$/)) return "skills";
  if (has(/^(summary|profile|objective|statement|about)$/)) return "statement";
  // A lone word such as "Personal" or "Key" is not a heading.
  if (words.length === 1 && !has(/^(education|qualifications|certifications|certificates|achievements|accomplishments|awards|interests|hobbies|references|languages|publications|activities|extracurricular|extra-curricular|coursework|courses|training|honours|honors|declaration|highlights|contact)$/)) return null;
  return "other";
}

// Bullet symbols, including the private-use characters PDFs use for Symbol/Wingdings bullets.
const BULLET = /^\s*(?:[•●▪◦‣⁃∙·○■□➢➤►▶▸✓✔❖➔→-]\s*|[-*–—]\s+|\(?\d{1,2}[.)]\s+)/;
const LONE_BULLET = /^\s*(?:[•●▪◦‣⁃∙·○■□➢➤►▶▸✓✔❖➔→-*–—-])\s*$/;

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const SEASON = "(?:spring|summer|autumn|fall|winter)";
const POINT = `(?:(?:${MONTH}|${SEASON})[\\s,]*(?:\\d{4}|['’]\\d{2})|\\d{1,2}[/.]\\d{4}|\\d{1,2}/\\d{2}|(?:19|20)\\d{2})`;
const END = `(?:${POINT}|present|current(?:ly)?|now|ongoing|till date|to date|date)`;
const DATE_RANGE = new RegExp(`\\(?\\s*(${POINT})\\s*(?:-|–|—|to|until|till|~)\\s*(${END})\\s*\\)?`, "i");
const SINGLE_DATE = new RegExp(`^\\(?\\s*(${POINT})\\s*\\)?$`, "i");

// Job-title words, used to tell the role from the employer when they are on separate lines.
const ROLE_WORD =
  /\b(intern(ship)?|engineer|developer|analyst|assistant|manager|officer|associate|consultant|lead|trainee|apprentice|volunteer|researcher|executive|coordinator|specialist|designer|scientist|technician|administrator|representative|adviser|advisor|tutor|teacher|accountant|architect|programmer|head|director|supervisor|ambassador|president|secretary|treasurer|member|fellow|placement|student|worker|clerk|operator|auditor|editor|writer)\b/i;

const ACTION_START =
  /^(worked|developed|built|led|managed|created|designed|implemented|assisted|collaborated|conducted|analy[sz]ed|improved|reduced|increased|supported|prepared|responsible|helped|delivered|organi[sz]ed|coordinated|wrote|researched|tested|automated|maintained|launched|trained|mentored|handled|performed|participated|contributed|achieved|completed|established|generated|optimi[sz]ed|streamlined|presented|produced|integrated|deployed|engineered|programmed|monitored|identified|resolved|processed|reviewed|drafted|updated|used|utili[sz]ed|gained|learned|learnt|served|ran|set up|spearheaded|oversaw|negotiated|secured|evaluated|investigated|migrated|refactored|configured)\b/i;

const CONTACT = /@|https?:\/\/|www\.|linkedin|github\.com|\+?\d[\d\s()-]{8,}\d/i;

function capitalise(s: string) {
  return s.replace(/^\w/, (c) => c.toUpperCase());
}

/** Role/employer text and dates from one header line, e.g. "Data Intern | Acme Ltd | Jun 2024 – Present". */
function readHeader(line: string) {
  const range = line.match(DATE_RANGE);
  const single = range ? null : line.match(new RegExp(`(?:^|[\\s|,(–—-])(${POINT})\\s*\\)?\\s*$`, "i"));
  const start = range?.[1] ?? single?.[1] ?? "";
  const end = range ? capitalise(range[2]) : "";
  const rest = (range ? line.replace(range[0], " ") : single ? line.slice(0, single.index) : line)
    .replace(/\(\s*\)/g, " ")
    .replace(/^[\s|,–—-]+|[\s|,–—:-]+$/g, "");
  const parts = rest
    .split(/\s*[|•·]\s*|\s+[—–-]\s+|\s+at\s+|\s+@\s+|,\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { parts, start: start.trim(), end: end.trim() };
}

function isHeaderLike(line: string) {
  if (DATE_RANGE.test(line) || SINGLE_DATE.test(line)) return true;
  if (/^[a-z]/.test(line)) return false;
  if (line.length > 90 || /[.;!?]$/.test(line)) return false;
  if (ACTION_START.test(line) && line.split(/\s+/).length > 4) return false;
  return line.split(/\s+/).length <= 12;
}

export interface SplitCv {
  personalStatement: string;
  experience: CvExperience[];
  skillsSection: string[];
}

function skillItems(line: string) {
  return line
    .replace(BULLET, "")
    .split(/[,;|•·]/)
    .map((s) => (s.includes(":") ? s.slice(s.lastIndexOf(":") + 1) : s).replace(/^[\s-]+|[\s.]+$/g, ""))
    .filter((s) => s && s.length <= 60);
}

export function splitCvText(text: string): SplitCv {
  const out: SplitCv = { personalStatement: "", experience: [], skillsSection: [] };
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const usesMarkers = lines.some((l) => BULLET.test(l) || LONE_BULLET.test(l));

  let section: Section | "preamble" = "preamble";
  // Held in an object so the helper functions below can update it.
  const st: { current: CvExperience | null } = { current: null };
  let headerLines = 0;
  // The last line was a bullet, or part of one.
  let inBullet = false;
  let pendingBullet = false;
  const preamble: string[] = [];
  const statement: string[] = [];
  const looseBullets: string[] = [];

  const newEntry = () => {
    const entry: CvExperience = { role: "", employer: "", start: "", end: "", bullets: [] };
    out.experience.push(entry);
    st.current = entry;
    headerLines = 0;
    return entry;
  };

  const addHeader = (line: string) => {
    const { parts, start, end } = readHeader(line);
    // Keep adding to an entry until its bullets start, unless this line brings a second set of dates.
    const open = st.current && !st.current.bullets.length && headerLines < 4 && !(start && st.current.start) ? st.current : null;
    const entry = open ?? newEntry();
    if (start && !entry.start) {
      entry.start = start;
      entry.end = end;
    }
    for (const part of parts) {
      if (!entry.role) entry.role = part;
      else if (!entry.employer) entry.employer = part;
    }
    // "Acme Ltd" then "Data Intern": put the job title in the role.
    if (entry.employer && ROLE_WORD.test(entry.employer) && !ROLE_WORD.test(entry.role)) [entry.role, entry.employer] = [entry.employer, entry.role];
    headerLines++;
    inBullet = false;
  };

  const addBullet = (textLine: string) => {
    const entry = st.current ?? newEntry();
    entry.bullets.push(textLine);
    inBullet = true;
  };

  const continueBullet = (textLine: string) => {
    const entry = st.current!;
    entry.bullets[entry.bullets.length - 1] = `${entry.bullets[entry.bullets.length - 1]} ${textLine}`;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (LONE_BULLET.test(line)) {
      pendingBullet = true;
      continue;
    }
    const h = headingType(line);
    if (h) {
      section = h;
      st.current = null;
      inBullet = false;
      pendingBullet = false;
      continue;
    }
    const marked = pendingBullet || BULLET.test(line);
    pendingBullet = false;
    const body = line.replace(BULLET, "").trim();
    if (!body) continue;

    if (section === "preamble") {
      if (marked) looseBullets.push(body);
      else preamble.push(line);
    } else if (section === "statement") statement.push(body);
    else if (section === "skills") out.skillsSection.push(...skillItems(line));
    else if (section === "other") {
      if (marked) looseBullets.push(body);
    } else if (marked) addBullet(body);
    else {
      const last = st.current?.bullets.at(-1) ?? "";
      const wrapped = inBullet && (/^[a-z(&]/.test(line) || (usesMarkers && last.length >= 50 && !/[.!?]$/.test(last) && !DATE_RANGE.test(line)));
      if (wrapped) continueBullet(body);
      else if (isHeaderLike(line)) addHeader(line);
      else if (usesMarkers && inBullet && !/[.!?]$/.test(last)) continueBullet(body);
      else addBullet(body);
    }
  }

  // The statement: its own section if there is one, otherwise sentences at the top
  // (leaving out the name and contact details).
  out.personalStatement = (statement.length ? statement : preamble.filter((l) => !CONTACT.test(l) && l.length >= 40)).join(" ");
  out.skillsSection = [...new Set(out.skillsSection)];
  out.experience = out.experience.filter((e) => e.role || e.bullets.length);
  // No experience heading was recognised: keep any bullet points found elsewhere.
  if (!out.experience.length && looseBullets.length) out.experience.push({ role: "", employer: "", start: "", end: "", bullets: looseBullets });
  return out;
}
