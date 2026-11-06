// SAMPLE COURSE CATALOGUE — fictional providers and courses, shown with a "Sample course"
// label. Each course teaches one skill from the engine's lexicon (engine/config.ts SKILLS)
// or one qualification (QUALIFICATIONS). Replace with a real catalogue once approved.

export interface Course {
  id: string;
  title: string;
  provider: string;
  /** Canonical skill or qualification it builds. */
  skill: string;
  format: "Online, self-paced" | "Online, tutor-led" | "Classroom" | "Blended";
  duration: string;
  cost: "Free" | "Under £100" | "£100–£500" | "Over £500";
  level: "Beginner" | "Intermediate" | "Advanced";
}

export const COURSE_CATALOGUE: Course[] = [
  { id: "c-excel-1", title: "Excel for Analysis: Formulas, PivotTables and Lookups", provider: "OpenSkills Academy (sample)", skill: "excel", format: "Online, self-paced", duration: "12 hours", cost: "Free", level: "Beginner" },
  { id: "c-sql-1", title: "SQL Foundations for Analysts", provider: "Northbridge Learning (sample)", skill: "sql", format: "Online, self-paced", duration: "15 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-py-1", title: "Python for Data Work", provider: "OpenSkills Academy (sample)", skill: "python", format: "Online, tutor-led", duration: "6 weeks", cost: "£100–£500", level: "Beginner" },
  { id: "c-pbi-1", title: "Power BI Dashboards in a Week", provider: "Northbridge Learning (sample)", skill: "power bi", format: "Online, self-paced", duration: "10 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-tab-1", title: "Tableau Essentials", provider: "Vista Data School (sample)", skill: "tableau", format: "Online, self-paced", duration: "8 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-da-1", title: "Practical Data Analysis", provider: "Vista Data School (sample)", skill: "data analysis", format: "Blended", duration: "8 weeks", cost: "£100–£500", level: "Intermediate" },
  { id: "c-viz-1", title: "Telling Stories with Data Visualisation", provider: "OpenSkills Academy (sample)", skill: "data visualisation", format: "Online, self-paced", duration: "6 hours", cost: "Free", level: "Beginner" },
  { id: "c-stake-1", title: "Stakeholder Management Essentials", provider: "Meridian Professional (sample)", skill: "stakeholder management", format: "Online, tutor-led", duration: "2 days", cost: "£100–£500", level: "Intermediate" },
  { id: "c-req-1", title: "Requirements Gathering and User Stories", provider: "Meridian Professional (sample)", skill: "requirements gathering", format: "Online, tutor-led", duration: "3 days", cost: "£100–£500", level: "Beginner" },
  { id: "c-proc-1", title: "Process Mapping with BPMN", provider: "Northbridge Learning (sample)", skill: "process mapping", format: "Online, self-paced", duration: "5 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-pm-1", title: "Introduction to Project Management", provider: "Meridian Professional (sample)", skill: "project management", format: "Online, self-paced", duration: "20 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-agile-1", title: "Agile and Scrum Fundamentals", provider: "OpenSkills Academy (sample)", skill: "agile", format: "Online, self-paced", duration: "6 hours", cost: "Free", level: "Beginner" },
  { id: "c-jira-1", title: "Jira for Project Teams", provider: "Northbridge Learning (sample)", skill: "jira", format: "Online, self-paced", duration: "3 hours", cost: "Free", level: "Beginner" },
  { id: "c-fm-1", title: "Financial Modelling in Excel", provider: "Ledger & Line Training (sample)", skill: "financial modelling", format: "Online, tutor-led", duration: "4 weeks", cost: "£100–£500", level: "Intermediate" },
  { id: "c-val-1", title: "Company Valuation and DCF", provider: "Ledger & Line Training (sample)", skill: "valuation", format: "Online, self-paced", duration: "14 hours", cost: "£100–£500", level: "Intermediate" },
  { id: "c-fcst-1", title: "Forecasting and Budgeting for Business Partners", provider: "Ledger & Line Training (sample)", skill: "forecasting", format: "Online, self-paced", duration: "8 hours", cost: "Under £100", level: "Intermediate" },
  { id: "c-bud-1", title: "Budgeting Basics", provider: "OpenSkills Academy (sample)", skill: "budgeting", format: "Online, self-paced", duration: "4 hours", cost: "Free", level: "Beginner" },
  { id: "c-frep-1", title: "Management Accounts and Month-End", provider: "Ledger & Line Training (sample)", skill: "financial reporting", format: "Online, tutor-led", duration: "3 weeks", cost: "£100–£500", level: "Beginner" },
  { id: "c-var-1", title: "Variance Analysis that Managers Read", provider: "Ledger & Line Training (sample)", skill: "variance analysis", format: "Online, self-paced", duration: "5 hours", cost: "Under £100", level: "Intermediate" },
  { id: "c-bbg-1", title: "Market Data Terminals: Getting Started", provider: "Corrie Street Learning (sample)", skill: "bloomberg", format: "Online, self-paced", duration: "8 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-crm-1", title: "CRM Fundamentals", provider: "Northbridge Learning (sample)", skill: "crm", format: "Online, self-paced", duration: "6 hours", cost: "Free", level: "Beginner" },
  { id: "c-seo-1", title: "SEO for Marketers", provider: "Brightpath Digital (sample)", skill: "seo", format: "Online, self-paced", duration: "10 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-ga-1", title: "Web Analytics with GA4", provider: "Brightpath Digital (sample)", skill: "google analytics", format: "Online, self-paced", duration: "6 hours", cost: "Free", level: "Beginner" },
  { id: "c-sm-1", title: "Social Media Campaign Planning", provider: "Brightpath Digital (sample)", skill: "social media", format: "Online, tutor-led", duration: "4 weeks", cost: "£100–£500", level: "Beginner" },
  { id: "c-cc-1", title: "Copywriting and Content Creation", provider: "Brightpath Digital (sample)", skill: "content creation", format: "Online, self-paced", duration: "8 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-pres-1", title: "Presenting with Confidence", provider: "Meridian Professional (sample)", skill: "presentation skills", format: "Classroom", duration: "1 day", cost: "£100–£500", level: "Beginner" },
  { id: "c-neg-1", title: "Negotiation Skills", provider: "Meridian Professional (sample)", skill: "negotiation", format: "Classroom", duration: "1 day", cost: "£100–£500", level: "Intermediate" },
  { id: "c-cs-1", title: "Customer Service Excellence", provider: "OpenSkills Academy (sample)", skill: "customer service", format: "Online, self-paced", duration: "4 hours", cost: "Free", level: "Beginner" },
  { id: "c-rec-1", title: "Recruitment and Selection Practice", provider: "Peoplecraft Institute (sample)", skill: "recruitment", format: "Online, tutor-led", duration: "3 weeks", cost: "£100–£500", level: "Beginner" },
  { id: "c-pay-1", title: "Payroll Essentials", provider: "Peoplecraft Institute (sample)", skill: "payroll", format: "Online, self-paced", duration: "10 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-er-1", title: "Employee Relations Foundations", provider: "Peoplecraft Institute (sample)", skill: "employee relations", format: "Online, tutor-led", duration: "2 weeks", cost: "£100–£500", level: "Beginner" },
  { id: "c-comp-1", title: "Regulatory Compliance Essentials", provider: "Meridian Professional (sample)", skill: "compliance", format: "Online, self-paced", duration: "8 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-risk-1", title: "Risk Management Fundamentals", provider: "Meridian Professional (sample)", skill: "risk management", format: "Online, self-paced", duration: "8 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-pol-1", title: "Policy Analysis Methods", provider: "Civic Futures College (sample)", skill: "policy analysis", format: "Online, tutor-led", duration: "5 weeks", cost: "£100–£500", level: "Intermediate" },
  { id: "c-js-1", title: "Modern JavaScript and TypeScript", provider: "Lumen Code School (sample)", skill: "javascript", format: "Online, self-paced", duration: "30 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-react-1", title: "Building Apps with React", provider: "Lumen Code School (sample)", skill: "react", format: "Online, self-paced", duration: "25 hours", cost: "Under £100", level: "Intermediate" },
  { id: "c-test-1", title: "Unit Testing and Test Automation", provider: "Lumen Code School (sample)", skill: "testing", format: "Online, self-paced", duration: "12 hours", cost: "Under £100", level: "Intermediate" },
  { id: "c-cloud-1", title: "Cloud Platform Fundamentals", provider: "Lumen Code School (sample)", skill: "cloud platforms", format: "Online, self-paced", duration: "15 hours", cost: "Free", level: "Beginner" },
  { id: "c-sc-1", title: "Supply Chain Management Basics", provider: "Pennant Logistics Institute (sample)", skill: "supply chain", format: "Online, self-paced", duration: "12 hours", cost: "Under £100", level: "Beginner" },
  { id: "c-lean-1", title: "Lean Six Sigma Yellow Belt", provider: "Pennant Logistics Institute (sample)", skill: "lean / six sigma", format: "Blended", duration: "3 days", cost: "£100–£500", level: "Beginner" },
  { id: "c-rep-1", title: "Business Reporting that Gets Read", provider: "OpenSkills Academy (sample)", skill: "reporting", format: "Online, self-paced", duration: "4 hours", cost: "Free", level: "Beginner" },
  // Qualifications (study routes; providers are illustrative).
  { id: "q-acca", title: "ACCA Applied Knowledge (first exams)", provider: "Ledger & Line Training (sample)", skill: "ACCA", format: "Blended", duration: "6–12 months", cost: "Over £500", level: "Beginner" },
  { id: "q-cima", title: "CIMA Certificate in Business Accounting", provider: "Ledger & Line Training (sample)", skill: "CIMA", format: "Online, tutor-led", duration: "6–12 months", cost: "Over £500", level: "Beginner" },
  { id: "q-aat", title: "AAT Level 3 Diploma in Accounting", provider: "Ledger & Line Training (sample)", skill: "AAT", format: "Online, tutor-led", duration: "9–12 months", cost: "Over £500", level: "Beginner" },
  { id: "q-cfa", title: "CFA Level I Preparation", provider: "Corrie Street Learning (sample)", skill: "CFA", format: "Online, self-paced", duration: "6 months", cost: "Over £500", level: "Advanced" },
  { id: "q-prince2", title: "PRINCE2 Foundation", provider: "Meridian Professional (sample)", skill: "PRINCE2", format: "Online, tutor-led", duration: "3 days", cost: "£100–£500", level: "Beginner" },
  { id: "q-apm", title: "APM Project Fundamentals Qualification", provider: "Meridian Professional (sample)", skill: "APM", format: "Online, tutor-led", duration: "3 days", cost: "£100–£500", level: "Beginner" },
  { id: "q-cipd", title: "CIPD Level 3 Foundation in People Practice", provider: "Peoplecraft Institute (sample)", skill: "CIPD", format: "Online, tutor-led", duration: "6–9 months", cost: "Over £500", level: "Beginner" },
];
