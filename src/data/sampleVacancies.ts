import type { RoleFamily, Seniority } from "@/data/types";

// SAMPLE VACANCIES — fictional employers and adverts, shown with a "Sample vacancy" label
// until a live job-data integration is approved. They are not real openings.

export interface SampleVacancy {
  id: string;
  title: string;
  employer: string;
  location: string;
  roleFamily: RoleFamily;
  seniority: Seniority;
  isGraduateScheme: boolean;
  salary: string;
  contract: string;
  description: string;
}

export const SAMPLE_VACANCIES: SampleVacancy[] = [
  {
    id: "sv-fin-01",
    title: "Graduate Financial Analyst",
    employer: "Halden & Rowe (sample)",
    location: "Leeds",
    roleFamily: "Finance and Accounting",
    seniority: "Entry / Graduate",
    isGraduateScheme: true,
    salary: "£28,000–£31,000",
    contract: "Permanent, hybrid",
    description:
      "Join our FP&A team supporting monthly reporting and forecasting. You will need strong Excel, experience of financial reporting and variance analysis, and a 2:1 degree. You will build financial models and present findings to budget holders. Desirable: Power BI and working towards ACCA or CIMA.",
  },
  {
    id: "sv-fin-02",
    title: "Junior Management Accountant",
    employer: "Brackwell Foods (sample)",
    location: "Manchester",
    roleFamily: "Finance and Accounting",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£30,000–£34,000",
    contract: "Permanent, office-based",
    description:
      "You will prepare management accounts, run month-end close and support budgeting. You will need Excel, financial reporting and budgeting experience, and AAT or part-qualified ACCA/CIMA. Minimum 1 year of finance experience. Evidence of measurable impact on reporting accuracy is required.",
  },
  {
    id: "sv-fin-03",
    title: "Investment Analyst",
    employer: "Corrie Street Capital (sample)",
    location: "London",
    roleFamily: "Finance and Accounting",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£40,000–£45,000",
    contract: "Permanent",
    description:
      "Support portfolio managers with research and valuation. You will need financial modelling, valuation (DCF), Excel and Bloomberg. You must have 2 years of relevant experience and a proven track record of quantified results. Desirable: CFA Level I and Python.",
  },
  {
    id: "sv-data-01",
    title: "Data Analyst",
    employer: "Northgate Health Trust (sample)",
    location: "Birmingham",
    roleFamily: "Data Analysis",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£29,000–£33,000",
    contract: "Permanent, hybrid",
    description:
      "Turn operational data into insight for clinical teams. You will need SQL, Excel and data visualisation with Power BI or Tableau. You will build dashboards and present to stakeholders. Desirable: Python and experience of stakeholder management.",
  },
  {
    id: "sv-data-02",
    title: "Graduate Insight Analyst",
    employer: "Kestrel Retail Group (sample)",
    location: "Nottingham",
    roleFamily: "Data Analysis",
    seniority: "Entry / Graduate",
    isGraduateScheme: true,
    salary: "£27,000",
    contract: "Graduate scheme, 2 years",
    description:
      "Rotate across trading, marketing and supply chain analytics. You will need data analysis, Excel and strong presentation skills. Desirable: SQL, Python and Google Analytics. We look for evidence of impact from projects or placements.",
  },
  {
    id: "sv-ba-01",
    title: "Junior Business Analyst",
    employer: "Ferrow Logistics (sample)",
    location: "Bristol",
    roleFamily: "Business Analysis",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£30,000–£35,000",
    contract: "Permanent, hybrid",
    description:
      "Work with operations teams to improve processes. You will need requirements gathering, process mapping and stakeholder management, plus strong Excel. You will write user stories in Jira within an Agile team. Desirable: SQL and lean / six sigma awareness.",
  },
  {
    id: "sv-ba-02",
    title: "Business Analyst",
    employer: "Calder Insurance (sample)",
    location: "Edinburgh",
    roleFamily: "Business Analysis",
    seniority: "Mid",
    isGraduateScheme: false,
    salary: "£40,000–£46,000",
    contract: "Permanent",
    description:
      "Lead requirements gathering for regulatory change. You will need at least 3 years as a business analyst, stakeholder management, process mapping and compliance knowledge. Desirable: Agile delivery and data analysis.",
  },
  {
    id: "sv-mkt-01",
    title: "Digital Marketing Executive",
    employer: "Brightwater Travel (sample)",
    location: "Brighton",
    roleFamily: "Marketing",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£26,000–£29,000",
    contract: "Permanent, hybrid",
    description:
      "Plan and run campaigns across search and social. You will need SEO, Google Analytics, social media and content creation. You will report on campaign results to stakeholders. Desirable: CRM experience (HubSpot).",
  },
  {
    id: "sv-pm-01",
    title: "Assistant Project Manager",
    employer: "Arden Build (sample)",
    location: "Coventry",
    roleFamily: "Project Management",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£32,000–£36,000",
    contract: "Permanent",
    description:
      "Support delivery of construction projects. You will need project management, risk management, budgeting and stakeholder management. PRINCE2 or APM qualification required. Desirable: Agile and reporting experience.",
  },
  {
    id: "sv-se-01",
    title: "Graduate Software Engineer",
    employer: "Lumen Systems (sample)",
    location: "Cambridge",
    roleFamily: "Software Engineering",
    seniority: "Entry / Graduate",
    isGraduateScheme: true,
    salary: "£35,000",
    contract: "Graduate programme",
    description:
      "Build web products in a cross-functional team. You will need JavaScript or TypeScript, React and unit testing. You will work in Agile sprints. Desirable: Python, SQL and cloud platforms (AWS).",
  },
  {
    id: "sv-hr-01",
    title: "HR Assistant",
    employer: "Whitmore Housing (sample)",
    location: "Sheffield",
    roleFamily: "HR",
    seniority: "Entry / Graduate",
    isGraduateScheme: false,
    salary: "£24,000–£26,000",
    contract: "Permanent",
    description:
      "Support recruitment, payroll and employee relations. You will need Excel, customer service and recruitment administration. Working towards CIPD Level 3 is desirable.",
  },
  {
    id: "sv-ops-01",
    title: "Operations Analyst",
    employer: "Pennant Distribution (sample)",
    location: "Milton Keynes",
    roleFamily: "Operations",
    seniority: "Junior",
    isGraduateScheme: false,
    salary: "£28,000–£32,000",
    contract: "Permanent",
    description:
      "Improve warehouse performance. You will need supply chain knowledge, Excel, data analysis and process improvement. Lean / six sigma awareness and reporting to stakeholders are required.",
  },
];
