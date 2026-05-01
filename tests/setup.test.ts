import { describe, expect, it } from "vitest";
import * as DiceRoller from "../src/index";

describe("DiceRoller", () => {
  it("exports tray as a function", () => {
    expect(typeof DiceRoller.tray).toBe("function");
  });

  it("exports bind as a function", () => {
    expect(typeof DiceRoller.bind).toBe("function");
  });
});
