import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitCvText } from "./cvText";

describe("splitCvText", () => {
  it("reads the sample CV (role | employer | dates)", () => {
    const cv = splitCvText(readFileSync("public/templates/sample_cv.txt", "utf8"));
    expect(cv.personalStatement).toMatch(/^Motivated and hard-working Finance graduate/);
    expect(cv.experience).toHaveLength(3);
    expect(cv.experience[0]).toEqual({
      role: "Finance Intern",
      employer: "Harlow & Pike LLP",
      start: "Jun 2025",
      end: "Aug 2025",
      bullets: ["Assisted with monthly financial reporting.", "Supported the analysis team with ad hoc requests.", "Responsible for updating client spreadsheets."],
    });
    expect(cv.experience.map((e) => e.bullets.length)).toEqual([3, 3, 3]);
    expect(cv.skillsSection).toEqual(["Excel", "PowerPoint", "Bloomberg"]);
  });

  it("reads a PDF-style CV: role, employer and dates on separate lines, wrapped bullets", () => {
    const cv = splitCvText(
      [
        "Priya Sharma",
        "priya.sharma@example.com | +91 98765 43210 | linkedin.com/in/priya",
        "CAREER OBJECTIVE",
        "Computer science student looking for a software engineering role in security.",
        "INTERNSHIP EXPERIENCE",
        "Software Development Intern",
        "CyberSafe Labs, Pune",
        "June 2024 – August 2024",
        "• Worked with cryptography libraries and collaborated with the security team to review",
        "key management code across three services.",
        "• Built a test suite in Python that cut regression bugs by 40%.",
        "Research Assistant",
        "IIT Bombay",
        "Jan 2024 - May 2024",
        "• Implemented lattice-based encryption prototypes in Java.",
        "EDUCATION",
        "B.Tech Computer Science, 2021 - 2025",
        "TECHNICAL SKILLS",
        "Programming: Python, Java, JavaScript, SQL",
        "Web Technologies: HTML, CSS, React",
      ].join("\n"),
    );
    expect(cv.personalStatement).toBe("Computer science student looking for a software engineering role in security.");
    expect(cv.experience).toEqual([
      {
        role: "Software Development Intern",
        employer: "CyberSafe Labs",
        start: "June 2024",
        end: "August 2024",
        bullets: [
          "Worked with cryptography libraries and collaborated with the security team to review key management code across three services.",
          "Built a test suite in Python that cut regression bugs by 40%.",
        ],
      },
      { role: "Research Assistant", employer: "IIT Bombay", start: "Jan 2024", end: "May 2024", bullets: ["Implemented lattice-based encryption prototypes in Java."] },
    ]);
    expect(cv.skillsSection).toEqual(["Python", "Java", "JavaScript", "SQL", "HTML", "CSS", "React"]);
  });

  it("reads a CV whose bullet symbols were lost", () => {
    const cv = splitCvText(
      [
        "Experience",
        "Security Intern at CipherWorks Jul 2025 – Present",
        "Worked with cryptography libraries and collaborated with developers on secure key storage",
        "Reviewed 20 pull requests a week for common security mistakes.",
        "Teaching Assistant, University of Leeds (09/2024 - 06/2025)",
        "Ran weekly lab sessions for 30 first-year students.",
        "Skills",
        "Python, C++",
      ].join("\n"),
    );
    expect(cv.experience).toEqual([
      {
        role: "Security Intern",
        employer: "CipherWorks",
        start: "Jul 2025",
        end: "Present",
        bullets: ["Worked with cryptography libraries and collaborated with developers on secure key storage", "Reviewed 20 pull requests a week for common security mistakes."],
      },
      { role: "Teaching Assistant", employer: "University of Leeds", start: "09/2024", end: "06/2025", bullets: ["Ran weekly lab sessions for 30 first-year students."] },
    ]);
  });

  it("handles the employer before the role, capital-letter company names and PDF bullet characters", () => {
    const cv = splitCvText(
      [
        "PROFESSIONAL EXPERIENCE",
        "TATA CONSULTANCY SERVICES",
        "Graduate Trainee",
        "Sep 2023 to Current",
        " Automated weekly reports, saving 5 hours a week.",
        "•",
        "Trained 4 new joiners on the reporting tools.",
        "PROJECTS",
        "Secure Chat App (2024)",
        "- End-to-end encrypted messaging using the Signal protocol.",
      ].join("\n"),
    );
    expect(cv.experience[0]).toEqual({
      role: "Graduate Trainee",
      employer: "TATA CONSULTANCY SERVICES",
      start: "Sep 2023",
      end: "Current",
      bullets: ["Automated weekly reports, saving 5 hours a week.", "Trained 4 new joiners on the reporting tools."],
    });
    expect(cv.experience[1]).toMatchObject({ role: "Secure Chat App", start: "2024", bullets: ["End-to-end encrypted messaging using the Signal protocol."] });
  });

  it("keeps bullet points when no experience heading is recognised", () => {
    const cv = splitCvText("Alex Smith\nWhat I've done\n- Led a team of 5 on a market research project.\n- Wrote the final report.");
    expect(cv.experience).toEqual([{ role: "", employer: "", start: "", end: "", bullets: ["Led a team of 5 on a market research project.", "Wrote the final report."] }]);
    expect(cv.personalStatement).toBe("");
  });
});
