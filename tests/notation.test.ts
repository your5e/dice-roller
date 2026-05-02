import { describe, expect, it } from "vitest";
import { parse } from "../src/notation";

describe("parse", () => {
    describe("dice", () => {
        it("parses", () => {
            expect(parse("1d4")).toEqual([
                {
                    count: 1,
                    sides: 4,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("4d6")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("2d8")).toEqual([
                {
                    count: 2,
                    sides: 8,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("1d10")).toEqual([
                {
                    count: 1,
                    sides: 10,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("1d12")).toEqual([
                {
                    count: 1,
                    sides: 12,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("1D20")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("1d100")).toEqual([
                {
                    count: 1,
                    sides: 100,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("09d20")).toEqual([
                {
                    count: 9,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("1d020")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("d20")).toEqual([null]);
            expect(parse("d20+5")).toEqual([null]);
            expect(parse("1d")).toEqual([null]);
            expect(parse("2dbananas")).toEqual([null]);
            expect(parse("1d*")).toEqual([null]);
            expect(parse("ad20")).toEqual([null]);
            expect(parse("*d20")).toEqual([null]);
            expect(parse("0d20")).toEqual([null]);
            expect(parse("1.5d20")).toEqual([null]);
            expect(parse("1d20.5")).toEqual([null]);
            expect(parse("-1d20")).toEqual([null]);
        });

        it("rejects invalid dice", () => {
            expect(parse("1d0")).toEqual([null]);
            expect(parse("1d3")).toEqual([null]);
            expect(parse("1d7")).toEqual([null]);
            expect(parse("1d50")).toEqual([null]);
        });
    });

    describe("keep highest", () => {
        it("parses", () => {
            expect(parse("4d6kh3")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [{ type: "kh", value: 3 }],
                    bonus: 0,
                },
            ]);

            expect(parse("4d6kh01")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [{ type: "kh", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("4D6KH3KH2")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [
                        { type: "kh", value: 3 },
                        { type: "kh", value: 2 },
                    ],
                    bonus: 0,
                },
            ]);

            expect(parse("4d6kh4")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [{ type: "kh", value: 4 }],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("4d6kh")).toEqual([null]);
            expect(parse("4d6kh-1")).toEqual([null]);
            expect(parse("2d20khbanana")).toEqual([null]);
        });

        it("rejects invalid dice counts", () => {
            expect(parse("4d6kh0")).toEqual([null]);
            expect(parse("4d6kh5")).toEqual([null]);
        });
    });

    describe("keep lowest", () => {
        it("parses", () => {
            expect(parse("8d4kl3")).toEqual([
                {
                    count: 8,
                    sides: 4,
                    modifiers: [{ type: "kl", value: 3 }],
                    bonus: 0,
                },
            ]);

            expect(parse("8d4kl01")).toEqual([
                {
                    count: 8,
                    sides: 4,
                    modifiers: [{ type: "kl", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("8D4KL6KL3")).toEqual([
                {
                    count: 8,
                    sides: 4,
                    modifiers: [
                        { type: "kl", value: 6 },
                        { type: "kl", value: 3 },
                    ],
                    bonus: 0,
                },
            ]);

            expect(parse("8d4kl8")).toEqual([
                {
                    count: 8,
                    sides: 4,
                    modifiers: [{ type: "kl", value: 8 }],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("4d6kl")).toEqual([null]);
            expect(parse("4d6kl-1")).toEqual([null]);
            expect(parse("2d20klbanana")).toEqual([null]);
        });

        it("rejects invalid dice counts", () => {
            expect(parse("4d6kl0")).toEqual([null]);
            expect(parse("4d6kl5")).toEqual([null]);
        });
    });

    describe("drop lowest", () => {
        it("parses", () => {
            expect(parse("4d6dl1")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [{ type: "dl", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("4d6dl01")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [{ type: "dl", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("4D6DL2DL1")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [
                        { type: "dl", value: 2 },
                        { type: "dl", value: 1 },
                    ],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("4d6dl")).toEqual([null]);
            expect(parse("4d6dl-1")).toEqual([null]);
            expect(parse("4d6dlx")).toEqual([null]);
        });

        it("rejects invalid dice counts", () => {
            expect(parse("4d6dl0")).toEqual([null]);
            expect(parse("4d6dl4")).toEqual([null]);
            expect(parse("4d6dl5")).toEqual([null]);
        });
    });

    describe("drop highest", () => {
        it("parses", () => {
            expect(parse("6d8dh1")).toEqual([
                {
                    count: 6,
                    sides: 8,
                    modifiers: [{ type: "dh", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("6d8dh01")).toEqual([
                {
                    count: 6,
                    sides: 8,
                    modifiers: [{ type: "dh", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("6D8DH3DH2")).toEqual([
                {
                    count: 6,
                    sides: 8,
                    modifiers: [
                        { type: "dh", value: 3 },
                        { type: "dh", value: 2 },
                    ],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("4d6dh")).toEqual([null]);
            expect(parse("4d6dh-1")).toEqual([null]);
            expect(parse("4d6dhx")).toEqual([null]);
        });

        it("rejects invalid dice counts", () => {
            expect(parse("4d6dh0")).toEqual([null]);
            expect(parse("4d6dh4")).toEqual([null]);
            expect(parse("4d6dh5")).toEqual([null]);
        });
    });

    describe("reroll once when below", () => {
        it("parses", () => {
            expect(parse("1d20rb2")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [{ type: "rb", value: 2 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1d20rb02")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [{ type: "rb", value: 2 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1D20RB2RB3")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [
                        { type: "rb", value: 2 },
                        { type: "rb", value: 3 },
                    ],
                    bonus: 0,
                },
            ]);

            expect(parse("1d6rb6")).toEqual([
                {
                    count: 1,
                    sides: 6,
                    modifiers: [{ type: "rb", value: 6 }],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("1d20rb")).toEqual([null]);
            expect(parse("1d20rb-1")).toEqual([null]);
            expect(parse("10d6rb!")).toEqual([null]);
        });

        it("rejects invalid thresholds", () => {
            expect(parse("1d20rb0")).toEqual([null]);
            expect(parse("1d6rb7")).toEqual([null]);
        });
    });

    describe("reroll until at least", () => {
        it("parses", () => {
            expect(parse("1d20rm2")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [{ type: "rm", value: 2 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1d20rm02")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [{ type: "rm", value: 2 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1D20RM2RM3")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [
                        { type: "rm", value: 2 },
                        { type: "rm", value: 3 },
                    ],
                    bonus: 0,
                },
            ]);

            expect(parse("1d6rm6")).toEqual([
                {
                    count: 1,
                    sides: 6,
                    modifiers: [{ type: "rm", value: 6 }],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("1d20rm")).toEqual([null]);
            expect(parse("1d20rm-1")).toEqual([null]);
            expect(parse("10d6rm!")).toEqual([null]);
        });

        it("rejects invalid thresholds", () => {
            expect(parse("1d20rm0")).toEqual([null]);
            expect(parse("1d6rm7")).toEqual([null]);
        });
    });

    describe("minimum", () => {
        it("parses", () => {
            expect(parse("1d20m10")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [{ type: "m", value: 10 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1d20m05")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [{ type: "m", value: 5 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1D20M5M10")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [
                        { type: "m", value: 5 },
                        { type: "m", value: 10 },
                    ],
                    bonus: 0,
                },
            ]);

            expect(parse("1d6m6")).toEqual([
                {
                    count: 1,
                    sides: 6,
                    modifiers: [{ type: "m", value: 6 }],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("1d20m")).toEqual([null]);
            expect(parse("1d20m-1")).toEqual([null]);
            expect(parse("1d20m!")).toEqual([null]);
        });

        it("rejects invalid thresholds", () => {
            expect(parse("1d20m0")).toEqual([null]);
            expect(parse("1d6m7")).toEqual([null]);
        });
    });

    describe("bonus", () => {
        it("parses", () => {
            expect(parse("1d20+5")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 5,
                },
            ]);

            expect(parse("2d8-2")).toEqual([
                {
                    count: 2,
                    sides: 8,
                    modifiers: [],
                    bonus: -2,
                },
            ]);

            expect(parse("1d20+09")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 9,
                },
            ]);

            expect(parse("1D20+5+3")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 8,
                },
            ]);

            expect(parse("1d20+5-2")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 3,
                },
            ]);
        });

        it("rejects invalid", () => {
            expect(parse("1d10+ennui")).toEqual([null]);
            expect(parse("2d6-x")).toEqual([null]);
            expect(parse("1d20+5.5")).toEqual([null]);
        });
    });

    describe("expressions", () => {
        it("parses", () => {
            expect(parse("")).toEqual([]);
            expect(parse("   ")).toEqual([]);

            expect(parse("4d6dl1kh3+2")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [
                        { type: "dl", value: 1 },
                        { type: "kh", value: 3 },
                    ],
                    bonus: 2,
                },
            ]);

            expect(parse("4d6kh3dl1kh2")).toEqual([
                {
                    count: 4,
                    sides: 6,
                    modifiers: [
                        { type: "kh", value: 3 },
                        { type: "dl", value: 1 },
                        { type: "kh", value: 2 },
                    ],
                    bonus: 0,
                },
            ]);

            expect(parse("1d20 2d6")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
                {
                    count: 2,
                    sides: 6,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("2d20kh1 4d6dl1")).toEqual([
                {
                    count: 2,
                    sides: 20,
                    modifiers: [{ type: "kh", value: 1 }],
                    bonus: 0,
                },
                {
                    count: 4,
                    sides: 6,
                    modifiers: [{ type: "dl", value: 1 }],
                    bonus: 0,
                },
            ]);

            expect(parse("1d20 2d6 1d8")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
                {
                    count: 2,
                    sides: 6,
                    modifiers: [],
                    bonus: 0,
                },
                {
                    count: 1,
                    sides: 8,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse(" 1d20\n2d6 ")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
                {
                    count: 2,
                    sides: 6,
                    modifiers: [],
                    bonus: 0,
                },
            ]);

            expect(parse("1d20 + 5")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
                null,
                null,
            ]);

            expect(parse("1d20 damage 2d6")).toEqual([
                {
                    count: 1,
                    sides: 20,
                    modifiers: [],
                    bonus: 0,
                },
                null,
                {
                    count: 2,
                    sides: 6,
                    modifiers: [],
                    bonus: 0,
                },
            ]);
        });

        it("rejects invalid expressions", () => {
            expect(parse("4d6k1")).toEqual([null]);
            expect(parse("1d20r2")).toEqual([null]);
            expect(parse("4d6x2")).toEqual([null]);
            expect(parse("1d20zz5")).toEqual([null]);
            expect(parse("4d6kh1.5")).toEqual([null]);
            expect(parse("hello world")).toEqual([null, null]);
        });

        it("rejects modifications without any dice", () => {
            expect(parse("+5")).toEqual([null]);
            expect(parse("kh1")).toEqual([null]);
        });

        it("rejects chained modifiers that leave zero dice", () => {
            expect(parse("4d6kh2dl2")).toEqual([null]);
            expect(parse("4d6kl2dh2")).toEqual([null]);
            expect(parse("2d6dl1dl1")).toEqual([null]);
            expect(parse("4d8kh1dl1m5")).toEqual([null]);
            expect(parse("8d6kh2dl2+5")).toEqual([null]);
            expect(parse("1d20rb5dl1")).toEqual([null]);
        });

        it("rejects chained modifiers that exceed remaining dice", () => {
            expect(parse("4d6kh2kh3")).toEqual([null]);
            expect(parse("4d6kl2kl3")).toEqual([null]);
            expect(parse("4d6dl2dl3")).toEqual([null]);
            expect(parse("4d6dh2dh3")).toEqual([null]);
        });

        it("rejects bonus before modifier", () => {
            expect(parse("4d6+2kh3")).toEqual([null]);
            expect(parse("1d20-1kh1")).toEqual([null]);
        });
    });
});
