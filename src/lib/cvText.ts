import type { CvExperience, CvProject } from "@/data/types";

// Basic text splitting for pasted or extracted CV text. The user checks
// and corrects the result in the structured form before saving.
//
// Real CVs vary a lot, especially once a PDF or Word file has been turned into text:
// bullet symbols may be lost or odd characters, long bullets wrap onto several lines,
// and the role, employer and dates may sit on one line or on separate lines.
// Roles are read only from experience sections; projects are kept apart, and
// education, certifications and other sections are left out.

type Section = "statement" | "experience" | "projects" | "skills" | "other";

// Words that make up section headings ("Work Experience", "Technical Skills", "Academic Projects"…).
const HEADING_WORDS = new Set(
  (
    "work professional relevant industry internship internships experience experiences employment history career projects project academic " +
    "personal key technical core skills skill summary profile objective statement about me education qualifications qualification certifications " +
    "certification certificates achievements accomplishments awards interests hobbies references languages publications activities extracurricular " +
    "extra-curricular volunteering volunteer leadership positions position of responsibility responsibilities and contact details information courses " +
    "coursework training tools technologies competencies strengths highlights honours honors declaration research university college selected " +
    "major minor side portfolio"
  ).split(" "),
);

const OTHER_ALONE = /^(education|qualifications?|certifications?|certificates|achievements|accomplishments|awards|interests|hobbies|references|languages|publications|activities|extracurricular|extra-curricular|coursework|courses|training|honours|honors|declaration|highlights|contact|portfolio)$/;

export function headingType(line: string): Section | null {
  if (line.length > 50 || /\d|[.,;]$|@/.test(line)) return null;
  const words = line
    .toLowerCase()
    .replace(/^[#*\s]+|[:#*\s]+$/g, "")
    .replace(/[&/()–—-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 5 || !words.every((w) => HEADING_WORDS.has(w))) return null;
  const has = (re: RegExp) => words.some((w) => re.test(w));
  const experienceWord = has(/^(experiences?|employment|internships?|volunteer(ing)?|leadership|positions?|responsibilit(y|ies))$/);
  if (has(/^projects?$/) && !experienceWord) return "projects";
  // "Career objective", "Professional summary": the statement, not experience.
  if (has(/^(summary|profile|objective|statement|about)$/) && !experienceWord) return "statement";
  if ((experienceWord || has(/^(work|history|career|research)$/)) && !has(/^(skills?|education|qualifications?)$/)) return "experience";
  if (has(/^(skills?|competencies|tools|technologies|strengths)$/)) return "skills";
  if (has(/^(summary|profile|objective|statement|about)$/)) return "statement";
  // A lone word such as "Personal" or "Key" is not a heading.
  if (words.length === 1 && !OTHER_ALONE.test(words[0])) return null;
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
const hasDate = (line: string) => DATE_RANGE.test(line) || SINGLE_DATE.test(line);

// Job-title words, used to tell a role line from a description line and the role from the employer.
const ROLE_WORD =
  /\b(intern(ship)?|engineer|developer|analyst|assistant|manager|officer|associate|consultant|lead|trainee|apprentice|volunteer|researcher|executive|coordinator|specialist|designer|scientist|technician|administrator|representative|adviser|advisor|tutor|teacher|accountant|architect|programmer|head|director|supervisor|ambassador|president|secretary|treasurer|fellow|placement|clerk|operator|auditor|editor|writer)\b/i;

const ACTION_START =
  /^(worked|developed|built|led|managed|created|designed|implemented|assisted|collaborated|conducted|analy[sz]ed|improved|reduced|increased|supported|prepared|responsible|helped|delivered|organi[sz]ed|coordinated|wrote|researched|tested|automated|maintained|launched|trained|mentored|handled|performed|participated|contributed|achieved|completed|established|generated|optimi[sz]ed|streamlined|presented|produced|integrated|deployed|engineered|programmed|monitored|identified|resolved|processed|reviewed|drafted|updated|used|using|utili[sz]ed|gained|learned|learnt|served|ran|set up|spearheaded|oversaw|negotiated|secured|evaluated|investigated|migrated|refactored|configured|applied|explored|enabled|allowed|allows|provides|provided|features|includes|this|my|our|we)\b/i;

// "Tech stack: React, Firebase" and similar detail lines belong to the entry above them.
const LABEL_LINE = /^[A-Za-z][\w &/+.-]{1,30}:\s+\S/;

const CONTACT = /@|https?:\/\/|www\.|linkedin|github\.com|\+?\d[\d\s()-]{8,}\d/i;

function capitalise(s: string) {
  return s.replace(/^\w/, (c) => c.toUpperCase());
}

/** Text and dates from one header line, e.g. "Data Intern | Acme Ltd | Jun 2024 – Present". */
function readHeader(line: string) {
  const range = line.match(DATE_RANGE);
  const single = range ? null : line.match(new RegExp(`(?:^|[\\s|,(–—-])(${POINT})\\s*\\)?\\s*$`, "i"));
  const start = range?.[1] ?? single?.[1] ?? "";
  const end = range ? capitalise(range[2]) : "";
  const rest = (range ? line.replace(range[0], " ") : single ? line.slice(0, single.index) : line)
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s|,–—-]+|[\s|,–—:-]+$/g, "");
  const parts = rest
    .split(/\s*[|•·]\s*|\s+[—–-]\s+|\s+at\s+|\s+@\s+|,\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { rest, parts, start: start.trim(), end: end.trim() };
}

/** Short title-like lines: a role, employer, date or project name rather than a description. */
function isHeaderLike(line: string) {
  if (hasDate(line)) return true;
  if (/^[a-z(]/.test(line) || LABEL_LINE.test(line) || ACTION_START.test(line)) return false;
  if (line.length > 90 || /[.;!?]$/.test(line)) return false;
  return line.split(/\s+/).length <= 10;
}

export interface SplitCv {
  personalStatement: string;
  experience: CvExperience[];
  projects: CvProject[];
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
  const out: SplitCv = { personalStatement: "", experience: [], projects: [], skillsSection: [] };
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let section: Section | "preamble" = "preamble";
  // The role or project being filled in. Held in an object so the helpers below can update it.
  const st: { role: CvExperience | null; project: CvProject | null } = { role: null, project: null };
  let headerLines = 0;
  // The last line was a bullet, or part of one, and whether that bullet began with a bullet symbol.
  let inBullet = false;
  let lastMarked = false;
  let pendingBullet = false;
  const preamble: string[] = [];
  const statement: string[] = [];
  const looseBullets: string[] = [];

  const newRole = () => {
    const entry: CvExperience = { role: "", employer: "", start: "", end: "", bullets: [] };
    out.experience.push(entry);
    st.role = entry;
    headerLines = 0;
    return entry;
  };
  const newProject = (name = "") => {
    const project: CvProject = { name, bullets: [] };
    out.projects.push(project);
    st.project = project;
    return project;
  };
  const currentBullets = () => (section === "projects" ? st.project?.bullets : st.role?.bullets) ?? [];

  const addRoleHeader = (line: string) => {
    const { parts, start, end } = readHeader(line);
    // Keep adding to a role until its bullets start, unless this line brings a second set of dates.
    const open = st.role && !st.role.bullets.length && headerLines < 4 && !(start && st.role.start) ? st.role : null;
    const entry = open ?? newRole();
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

  const addBullet = (body: string, marked: boolean) => {
    if (section === "projects") (st.project ?? newProject()).bullets.push(body);
    else (st.role ?? newRole()).bullets.push(body);
    inBullet = true;
    lastMarked = marked;
  };

  const continueBullet = (body: string) => {
    const bullets = currentBullets();
    bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${body}`;
  };

  // After a role's bullets, a title-like line starts a new role only if it looks like one:
  // it has dates or a job title, or dates follow within the next two lines. Otherwise it is
  // part of the description.
  const startsNewRole = (i: number) => {
    const line = lines[i];
    const next = lines[i + 1] ?? "";
    if (hasDate(line) || ROLE_WORD.test(line)) return true;
    if (BULLET.test(next) || headingType(next)) return false;
    return hasDate(next) || (isHeaderLike(next) && hasDate(lines[i + 2] ?? ""));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (LONE_BULLET.test(line)) {
      pendingBullet = true;
      continue;
    }
    const h = headingType(line);
    if (h) {
      section = h;
      st.role = null;
      st.project = null;
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
      continue;
    }
    if (section === "statement") {
      statement.push(body);
      continue;
    }
    if (section === "skills") {
      out.skillsSection.push(...skillItems(line));
      continue;
    }
    // Education, certifications, awards and similar sections are not read.
    if (section === "other") continue;
    if (marked) {
      addBullet(body, true);
      continue;
    }

    const last = currentBullets().at(-1) ?? "";
    // A long bullet that runs onto the next line: the next line starts in lower case, or the
    // bullet began with a symbol and stopped mid-sentence.
    const wrapped = inBullet && (/^[a-z(&]/.test(line) || (lastMarked && last.length >= 50 && !/[.!?]$/.test(last) && !hasDate(line)));
    if (wrapped) continueBullet(body);
    else if (section === "projects") {
      const project = st.project;
      if (isHeaderLike(line) && (!project || project.bullets.length || !project.name)) {
        const { rest, start } = readHeader(line);
        if (project && !project.name && !project.bullets.length) project.name = rest || start;
        else newProject(rest || line);
        inBullet = false;
      } else if (project && !project.bullets.length && hasDate(line) && readHeader(line).rest === "") {
        // A date line under the project name: not needed.
      } else addBullet(body, false);
    } else if (isHeaderLike(line) && (!st.role?.bullets.length || startsNewRole(i))) addRoleHeader(line);
    else addBullet(body, false);
  }

  // The statement: its own section if there is one, otherwise sentences at the top
  // (leaving out the name and contact details).
  out.personalStatement = (statement.length ? statement : preamble.filter((l) => !CONTACT.test(l) && l.length >= 40)).join(" ");
  out.skillsSection = [...new Set(out.skillsSection)];
  out.experience = out.experience.filter((e) => e.role || e.bullets.length);
  out.projects = out.projects.filter((p) => p.name || p.bullets.length);
  // No section headings at all: keep any bullet points found at the top.
  if (!out.experience.length && !out.projects.length && looseBullets.length) out.experience.push({ role: "", employer: "", start: "", end: "", bullets: looseBullets });
  return out;
}
