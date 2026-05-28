import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { describe, expect, it } from "vitest";

const expectedGlobals = [
    "DiceRoller",
    "__THREE__", // THREE.js instance tracker
];

describe("bundle", () => {
    it("only adds expected globals", () => {
        const before = new Set(Object.keys(globalThis));

        const bundle = readFileSync("dist/dice-roller.js", "utf-8");
        runInThisContext(bundle);

        const added = Object.keys(globalThis).filter((k) => !before.has(k));
        expect(added.sort()).toEqual(expectedGlobals.sort());
    });
});
