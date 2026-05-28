import { describe, expect, it } from "vitest";
import { D4Texture } from "../../src/textures/d4";
import { D6Texture } from "../../src/textures/d6";
import { D8Texture } from "../../src/textures/d8";
import { D12Texture } from "../../src/textures/d12";
import { D20Texture } from "../../src/textures/d20";
import { type EdgeTarget, FIXED_T_VALUES } from "../../src/textures/dice";

class TestableD6Texture extends D6Texture {
    public seededRandom(): number {
        return super.seededRandom();
    }
    public findAllClosedLoops(): {
        loops: EdgeTarget[][];
        edgeConnections: Map<string, number[]>;
    } {
        return super.findAllClosedLoops();
    }
    public isEdgeReversed(face: number, otherFace: number): boolean {
        return super.isEdgeReversed(face, otherFace);
    }
    public edgeTargetToCanvas(target: EdgeTarget): { x: number; y: number } {
        return super.edgeTargetToCanvas(target);
    }
    public getAdjacentFaces(face: number): number[] {
        return super.getAdjacentFaces(face);
    }
}

class TestableD4Texture extends D4Texture {
    public findAllClosedLoops(): {
        loops: EdgeTarget[][];
        edgeConnections: Map<string, number[]>;
    } {
        return super.findAllClosedLoops();
    }
}

class TestableD8Texture extends D8Texture {
    public findAllClosedLoops(): {
        loops: EdgeTarget[][];
        edgeConnections: Map<string, number[]>;
    } {
        return super.findAllClosedLoops();
    }
}

class TestableD12Texture extends D12Texture {
    public findAllClosedLoops(): {
        loops: EdgeTarget[][];
        edgeConnections: Map<string, number[]>;
    } {
        return super.findAllClosedLoops();
    }
}

class TestableD20Texture extends D20Texture {
    public findAllClosedLoops(): {
        loops: EdgeTarget[][];
        edgeConnections: Map<string, number[]>;
    } {
        return super.findAllClosedLoops();
    }
}

function edgeToKey(edge: [number, number]): string {
    return `${Math.min(edge[0], edge[1])},${Math.max(edge[0], edge[1])}`;
}

describe("DieTexture", () => {
    describe("seededRandom", () => {
        it("produces the same sequence for the same seed", () => {
            const texture1 = new TestableD6Texture({ seed: 42 });
            const texture2 = new TestableD6Texture({ seed: 42 });

            const sequence1: number[] = [];
            const sequence2: number[] = [];
            for (let i = 0; i < 10; i++) {
                sequence1.push(texture1.seededRandom());
                sequence2.push(texture2.seededRandom());
            }

            expect(sequence1).toEqual(sequence2);
        });

        it("produces different numbers on each call", () => {
            const texture = new TestableD6Texture({ seed: 42 });

            const numbers: number[] = [];
            for (let i = 0; i < 100; i++) {
                numbers.push(texture.seededRandom());
            }

            const unique = new Set(numbers);
            expect(unique.size).toBe(100);
        });

        it("produces different sequences for different seeds", () => {
            const texture1 = new TestableD6Texture({ seed: 42 });
            const texture2 = new TestableD6Texture({ seed: 43 });

            const first1 = texture1.seededRandom();
            const first2 = texture2.seededRandom();

            expect(first1).not.toBe(first2);
        });
    });

    describe("findAllClosedLoops", () => {
        describe("determinism", () => {
            it("produces identical results for the same seed", () => {
                const texture1 = new TestableD6Texture({ seed: 12345 });
                const texture2 = new TestableD6Texture({ seed: 12345 });
                expect(texture1.findAllClosedLoops()).toEqual(
                    texture2.findAllClosedLoops(),
                );
            });

            it("produces different results for different numerical seeds", () => {
                const texture1 = new TestableD6Texture({ seed: 12345 });
                const texture2 = new TestableD6Texture({ seed: 67890 });
                expect(texture1.findAllClosedLoops()).not.toEqual(
                    texture2.findAllClosedLoops(),
                );
            });

            it("produces different results for different string seeds", () => {
                const texture1 = new TestableD6Texture({ seed: "norm" });
                const texture2 = new TestableD6Texture({ seed: "norman" });
                expect(texture1.findAllClosedLoops()).not.toEqual(
                    texture2.findAllClosedLoops(),
                );
            });
        });

        describe("loop structure", () => {
            it("no face is crossed more than twice", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    const faceCrossings = new Map<number, number>();
                    for (const loop of loops) {
                        const facesInLoop = new Set<number>();
                        for (const target of loop) {
                            facesInLoop.add(target.adjFace);
                        }
                        for (const face of facesInLoop) {
                            faceCrossings.set(
                                face,
                                (faceCrossings.get(face) ?? 0) + 1,
                            );
                        }
                    }

                    for (const [face, count] of faceCrossings) {
                        expect(
                            count,
                            `face ${face} crossed ${count} times (seed=${seed})`,
                        ).toBeLessThanOrEqual(2);
                    }
                }
            });

            it("no edge has more than two points used", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { edgeConnections } = texture.findAllClosedLoops();

                    for (const [edge, points] of edgeConnections) {
                        expect(
                            points.length,
                            `edge ${edge} has ${points.length} points (seed=${seed})`,
                        ).toBeLessThanOrEqual(2);
                    }
                }
            });

            it("generates at least one loop", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();
                    expect(
                        loops.length,
                        `should have at least 1 loop (seed=${seed})`,
                    ).toBeGreaterThanOrEqual(1);
                }
            });

            it("path choices are evenly distributed", () => {
                const transitionCounts = new Map<string, Map<number, number>>();

                for (let seed = 0; seed < 1000; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    for (const loop of loops) {
                        for (let i = 0; i < loop.length - 1; i++) {
                            const current = loop[i];
                            const next = loop[i + 1];
                            const key = `${current.face},${current.adjFace}`;
                            const nextFace = next.adjFace;

                            let counts = transitionCounts.get(key);
                            if (!counts) {
                                counts = new Map();
                                transitionCounts.set(key, counts);
                            }
                            counts.set(nextFace, (counts.get(nextFace) ?? 0) + 1);
                        }
                    }
                }

                for (const [key, counts] of transitionCounts) {
                    const values = [...counts.values()];
                    if (values.length < 2) continue;

                    const total = values.reduce((a, b) => a + b, 0);
                    if (total < 20) continue;

                    const expected = total / values.length;
                    for (const [nextFace, count] of counts) {
                        const deviation = Math.abs(count - expected) / expected;
                        expect(
                            deviation,
                            `transition ${key} -> ${nextFace}: ${count}/${total} deviates ${(deviation * 100).toFixed(0)}% from expected ${expected.toFixed(0)}`,
                        ).toBeLessThan(0.5);
                    }
                }
            });

            it("faces are evenly distributed across loops", () => {
                const faceCounts = new Map<number, number>();

                for (let seed = 0; seed < 1000; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    for (const loop of loops) {
                        for (const target of loop) {
                            faceCounts.set(
                                target.face,
                                (faceCounts.get(target.face) ?? 0) + 1,
                            );
                        }
                    }
                }

                const values = [...faceCounts.values()];
                const total = values.reduce((a, b) => a + b, 0);
                const expected = total / faceCounts.size;

                for (const [face, count] of faceCounts) {
                    const deviation = Math.abs(count - expected) / expected;
                    expect(
                        deviation,
                        `face ${face}: ${count}/${total} deviates ${(deviation * 100).toFixed(0)}% from expected ${expected.toFixed(0)}`,
                    ).toBeLessThan(0.2);
                }
            });

            it("each loop is closed (last target leads back to first face)", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    for (const [loopIdx, loop] of loops.entries()) {
                        const first = loop[0];
                        const last = loop[loop.length - 1];
                        expect(
                            last.adjFace,
                            `loop ${loopIdx} should close back to start face (seed=${seed})`,
                        ).toBe(first.face);
                    }
                }
            });

            it("no face is visited twice within a loop", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    for (const [loopIdx, loop] of loops.entries()) {
                        const visitedFaces = new Set<number>();
                        for (const target of loop) {
                            expect(
                                visitedFaces.has(target.face),
                                `face ${target.face} visited twice in loop ${loopIdx} (seed=${seed})`,
                            ).toBe(false);
                            visitedFaces.add(target.face);
                        }
                    }
                }
            });

            it("each loop has at least 3 segments", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    for (const [loopIdx, loop] of loops.entries()) {
                        expect(
                            loop.length,
                            `loop ${loopIdx} should have at least 3 segments (seed=${seed})`,
                        ).toBeGreaterThanOrEqual(3);
                    }
                }
            });

            it("uses only fixed t values (0.25, 0.5, 0.75)", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops } = texture.findAllClosedLoops();

                    for (const loop of loops) {
                        for (const target of loop) {
                            expect(
                                FIXED_T_VALUES as readonly number[],
                                `t=${target.t} is not a valid fixed position (seed=${seed})`,
                            ).toContain(target.t);
                        }
                    }
                }
            });
        });

        describe("edge connections", () => {
            it("edgeConnections contains all t values used in loops", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new TestableD6Texture({ seed });
                    const { loops, edgeConnections } = texture.findAllClosedLoops();

                    for (const loop of loops) {
                        for (const target of loop) {
                            const edgeKey = edgeToKey([target.face, target.adjFace]);
                            const points = edgeConnections.get(edgeKey);
                            expect(
                                points,
                                `edge ${edgeKey} should exist in edgeConnections (seed=${seed})`,
                            ).toBeDefined();
                            expect(
                                points,
                                `edge ${edgeKey} should contain t=${target.t} (seed=${seed})`,
                            ).toContain(target.t);
                        }
                    }
                }
            });
        });

        describe("across die types", () => {
            const testCases = [
                { Texture: TestableD4Texture, name: "d4" },
                { Texture: TestableD6Texture, name: "d6" },
                { Texture: TestableD8Texture, name: "d8" },
                { Texture: TestableD12Texture, name: "d12" },
                { Texture: TestableD20Texture, name: "d20" },
            ];

            for (const { Texture, name } of testCases) {
                it(`${name} generates valid loops`, () => {
                    for (let seed = 0; seed < 20; seed++) {
                        const texture = new Texture({ seed });
                        const { loops, edgeConnections } = texture.findAllClosedLoops();

                        // at least one loop
                        expect(
                            loops.length,
                            `${name} should have at least 1 loop (seed=${seed})`,
                        ).toBeGreaterThanOrEqual(1);

                        // no face crossed more than twice across ALL searches
                        const faceCrossings = new Map<number, number>();
                        for (const loop of loops) {
                            const facesInLoop = new Set<number>();
                            for (const target of loop) {
                                facesInLoop.add(target.adjFace);
                            }
                            for (const face of facesInLoop) {
                                faceCrossings.set(
                                    face,
                                    (faceCrossings.get(face) ?? 0) + 1,
                                );
                            }
                        }
                        for (const [face, count] of faceCrossings) {
                            expect(
                                count,
                                `${name} face ${face} crossed ${count} times (seed=${seed})`,
                            ).toBeLessThanOrEqual(2);
                        }

                        // no edge has more than 2 points used
                        for (const [edge, points] of edgeConnections) {
                            expect(
                                points.length,
                                `${name} edge ${edge} has ${points.length} points (seed=${seed})`,
                            ).toBeLessThanOrEqual(2);
                        }

                        // each loop must have closed structure
                        for (const loop of loops) {
                            expect(loop.length).toBeGreaterThanOrEqual(3);
                            const first = loop[0];
                            const last = loop[loop.length - 1];
                            expect(last.adjFace).toBe(first.face);
                        }
                    }
                });
            }
        });
    });

    describe("isEdgeReversed", () => {
        it("returns consistent results for the same pair of faces", () => {
            const texture = new TestableD6Texture({ seed: 12345 });
            const face = 1;
            const adjFaces = texture.getAdjacentFaces(face);

            for (const adjFace of adjFaces) {
                const result1 = texture.isEdgeReversed(face, adjFace);
                const result2 = texture.isEdgeReversed(face, adjFace);
                expect(result1).toBe(result2);
            }
        });

        it("returns opposite results when arguments are swapped", () => {
            const texture = new TestableD6Texture({ seed: 12345 });
            const face = 1;
            const adjFaces = texture.getAdjacentFaces(face);

            for (const adjFace of adjFaces) {
                const forward = texture.isEdgeReversed(face, adjFace);
                const backward = texture.isEdgeReversed(adjFace, face);
                expect(forward).toBe(backward);
            }
        });
    });

    describe("edgeTargetToCanvas", () => {
        it("returns a point for valid edge targets", () => {
            const texture = new TestableD6Texture({ seed: 12345 });
            const face = 1;
            const adjFaces = texture.getAdjacentFaces(face);

            for (const adjFace of adjFaces) {
                const point = texture.edgeTargetToCanvas({
                    face,
                    adjFace,
                    t: 0.5,
                });
                expect(point.x).toBeTypeOf("number");
                expect(point.y).toBeTypeOf("number");
                expect(Number.isFinite(point.x)).toBe(true);
                expect(Number.isFinite(point.y)).toBe(true);
            }
        });

        it("returns different points for different t values", () => {
            const texture = new TestableD6Texture({ seed: 12345 });
            const face = 1;
            const adjFace = texture.getAdjacentFaces(face)[0];

            const p1 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.25 });
            const p2 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.5 });
            const p3 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.75 });

            expect(p1.x !== p2.x || p1.y !== p2.y).toBe(true);
            expect(p2.x !== p3.x || p2.y !== p3.y).toBe(true);
        });

        it("t=0.5 returns midpoint between t=0.25 and t=0.75", () => {
            const texture = new TestableD6Texture({ seed: 12345 });
            const face = 1;
            const adjFace = texture.getAdjacentFaces(face)[0];

            const p1 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.25 });
            const p2 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.5 });
            const p3 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.75 });

            const midX = (p1.x + p3.x) / 2;
            const midY = (p1.y + p3.y) / 2;

            expect(p2.x).toBeCloseTo(midX, 5);
            expect(p2.y).toBeCloseTo(midY, 5);
        });
    });
});
