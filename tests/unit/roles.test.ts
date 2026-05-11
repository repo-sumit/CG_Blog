import { describe, it, expect } from "vitest";
import { canAuthor, isManager, isValidDomain } from "@/lib/auth/roles";

describe("roles", () => {
  it("isValidDomain accepts case-insensitive", () => {
    expect(isValidDomain("Foo@ConveGenius.AI", "convegenius.ai")).toBe(true);
    expect(isValidDomain("foo@convegenius.ai", "convegenius.ai")).toBe(true);
  });
  it("isValidDomain rejects mismatches", () => {
    expect(isValidDomain("foo@gmail.com", "convegenius.ai")).toBe(false);
    expect(isValidDomain("foo@convegenius.com", "convegenius.ai")).toBe(false);
    expect(isValidDomain("", "convegenius.ai")).toBe(false);
    expect(isValidDomain("foo@", "convegenius.ai")).toBe(false);
  });
  it("canAuthor", () => {
    expect(canAuthor("viewer")).toBe(false);
    expect(canAuthor("author")).toBe(true);
    expect(canAuthor("manager")).toBe(true);
    expect(canAuthor(null)).toBe(false);
  });
  it("isManager", () => {
    expect(isManager("manager")).toBe(true);
    expect(isManager("author")).toBe(false);
  });
});
