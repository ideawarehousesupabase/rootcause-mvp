import { describe, expect, it } from "vitest";
import { emailKey, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("never stores the password and verifies only the right one", async () => {
    const stored = await hashPassword("Testpass123", 1000);
    expect(stored.passwordHash).not.toContain("Testpass123");
    expect(stored.passwordHash).toHaveLength(64);
    expect(await verifyPassword("Testpass123", stored)).toBe(true);
    expect(await verifyPassword("testpass123", stored)).toBe(false);
  });

  it("salts each hash differently", async () => {
    const a = await hashPassword("Testpass123", 1000);
    const b = await hashPassword("Testpass123", 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it("keys accounts by the normalised email", async () => {
    expect(await emailKey("  Casey@Example.COM ")).toBe(await emailKey("casey@example.com"));
    expect(await emailKey("casey@example.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
