import { describe, expect, it } from "vitest";
import { guessRoleFamily, guessSeniority, looksLikeGraduateScheme } from "./jobGuess";

describe("job advert guesses", () => {
  it("picks a role family from the title, then the description", () => {
    expect(guessRoleFamily("Graduate Financial Analyst")).toBe("Finance and Accounting");
    expect(guessRoleFamily("Junior Business Analyst")).toBe("Business Analysis");
    expect(guessRoleFamily("Data Analyst")).toBe("Data Analysis");
    expect(guessRoleFamily("Graduate Software Engineer")).toBe("Software Engineering");
    expect(guessRoleFamily("Associate", "You will run digital marketing campaigns")).toBe("Marketing");
    expect(guessRoleFamily("Team Member")).toBe("Other");
  });

  it("picks a seniority from the title", () => {
    expect(guessSeniority("Graduate Insight Analyst")).toBe("Entry / Graduate");
    expect(guessSeniority("Junior Management Accountant")).toBe("Junior");
    expect(guessSeniority("Senior Data Analyst")).toBe("Senior");
    expect(guessSeniority("Head of Finance")).toBe("Lead / Manager");
    expect(guessSeniority("Business Analyst")).toBe("Mid");
  });

  it("spots graduate schemes", () => {
    expect(looksLikeGraduateScheme("Finance Graduate Programme 2027")).toBe(true);
    expect(looksLikeGraduateScheme("Data Analyst", "Two-year graduate scheme with rotations")).toBe(true);
    expect(looksLikeGraduateScheme("Data Analyst", "Graduates welcome")).toBe(false);
  });
});
