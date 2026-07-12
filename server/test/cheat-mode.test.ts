import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractCheatDirective,
  findCheatDirectiveInMessages,
  isCheatModeEnabled,
  isCheatModeMessage,
} from "../config/cheat-mode.ts";

describe("cheat-mode config", () => {
  const original = process.env.CHEAT_MODE;

  afterEach(() => {
    if (original === undefined) delete process.env.CHEAT_MODE;
    else process.env.CHEAT_MODE = original;
  });

  beforeEach(() => {
    delete process.env.CHEAT_MODE;
  });

  it("isCheatModeEnabled returns false when unset", () => {
    expect(isCheatModeEnabled()).toBe(false);
  });

  it("isCheatModeEnabled accepts truthy values", () => {
    for (const val of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.CHEAT_MODE = val;
      expect(isCheatModeEnabled()).toBe(true);
    }
  });

  it("extractCheatDirective parses directive from learner message", () => {
    expect(
      extractCheatDirective("CHEAT MODE: 81% Silver tier, passed with strong empathy"),
    ).toBe("81% Silver tier, passed with strong empathy");
  });

  it("isCheatModeMessage detects cheat prefix", () => {
    expect(isCheatModeMessage("CHEAT MODE: score 70%")).toBe(true);
    expect(isCheatModeMessage("Hello there")).toBe(false);
  });

  it("findCheatDirectiveInMessages reads learner messages only", () => {
    expect(
      findCheatDirectiveInMessages([
        { role: "persona", content: "CHEAT MODE: ignored" },
        { role: "learner", content: "CHEAT MODE: 75% Bronze" },
      ]),
    ).toBe("75% Bronze");
  });
});
