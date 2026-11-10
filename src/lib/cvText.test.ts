import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyseCv } from "@/engine";
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

  it("handles the employer before the role, capital-letter company names and PDF bullet characters, and keeps projects apart", () => {
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
    expect(cv.experience).toHaveLength(1);
    expect(cv.projects).toEqual([{ name: "Secure Chat App", bullets: ["End-to-end encrypted messaging using the Signal protocol."] }]);
  });

  it("keeps bullet points when no experience heading is recognised", () => {
    const cv = splitCvText("Alex Smith\nWhat I've done\n- Led a team of 5 on a market research project.\n- Wrote the final report.");
    expect(cv.experience).toEqual([{ role: "", employer: "", start: "", end: "", bullets: ["Led a team of 5 on a market research project.", "Wrote the final report."] }]);
    expect(cv.personalStatement).toBe("");
  });
  it("keeps project descriptions under Projects instead of making them job roles", () => {
    const cv = splitCvText(
      [
        "WORK EXPERIENCE",
        "Cyber Security Intern | SecureNet Solutions | May 2024 – Jul 2024",
        "• Ran vulnerability scans on 15 internal web apps and logged 40+ issues.",
        "• Wrote incident reports for the security team.",
        "ACADEMIC PROJECTS",
        "Encrypted File Sharing System",
        "A web app that encrypts files with AES-256 before upload",
        "Tech stack: Python, Flask, React",
        "Phishing URL Detector | Jan 2024",
        "Machine learning model that flags phishing links",
        "Trained on 10,000 URLs with 94% accuracy",
        "EDUCATION",
        "B.Tech Computer Engineering",
        "University of Mumbai 2021 – 2025",
        "CERTIFICATIONS",
        "• Google Cybersecurity Certificate",
        "• CompTIA Security+ (2024)",
        "SKILLS",
        "Python, Flask, Wireshark",
      ].join("\n"),
    );
    expect(cv.experience).toEqual([
      {
        role: "Cyber Security Intern",
        employer: "SecureNet Solutions",
        start: "May 2024",
        end: "Jul 2024",
        bullets: ["Ran vulnerability scans on 15 internal web apps and logged 40+ issues.", "Wrote incident reports for the security team."],
      },
    ]);
    expect(cv.projects).toEqual([
      { name: "Encrypted File Sharing System", bullets: ["A web app that encrypts files with AES-256 before upload", "Tech stack: Python, Flask, React"] },
      { name: "Phishing URL Detector", bullets: ["Machine learning model that flags phishing links", "Trained on 10,000 URLs with 94% accuracy"] },
    ]);
    expect(cv.skillsSection).toEqual(["Python", "Flask", "Wireshark"]);
  });

  it("does not turn description lines after a role's bullets into new roles", () => {
    const cv = splitCvText(
      [
        "Experience",
        "Software Intern, Acme Ltd, Jun 2024 - Aug 2024",
        "• Built an internal dashboard used by 50 staff.",
        "Worked with the Security Team on code reviews",
        "Payments API Migration",
        "Data Analyst Intern",
        "Brightside Ltd",
        "Jan 2024 - Mar 2024",
        "• Cleaned survey data for 3 projects.",
      ].join("\n"),
    );
    expect(cv.experience.map((e) => e.role)).toEqual(["Software Intern", "Data Analyst Intern"]);
    expect(cv.experience[0].bullets).toEqual([
      "Built an internal dashboard used by 50 staff.",
      "Worked with the Security Team on code reviews",
      "Payments API Migration",
    ]);
    expect(cv.experience[1]).toMatchObject({ employer: "Brightside Ltd", start: "Jan 2024", end: "Mar 2024" });
  });

  it("counts projects as skills evidence only, not as experience bullets in the diagnostics", () => {
    const cv = splitCvText("EXPERIENCE\nAnalyst | Firm | 2024 - 2025\n- Reduced costs by 10%.\nPROJECTS\nChurn model\n- Built a churn model in Python with SQL data.");
    const analysis = analyseCv(cv);
    expect(analysis.bulletCount).toBe(1);
    expect(analysis.bullets.map((b) => b.text)).toEqual(["Reduced costs by 10%."]);
    expect(analysis.mentionedSkills).toEqual(expect.arrayContaining(["python", "sql"]));
  });
});
