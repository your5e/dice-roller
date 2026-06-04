import { describe, expect, it } from "vitest";
import { D4Texture } from "../../src/textures/d4";
import { D6Texture } from "../../src/textures/d6";
import { D8Texture } from "../../src/textures/d8";
import { D12Texture } from "../../src/textures/d12";
import { D20Texture } from "../../src/textures/d20";
import { type DieTexture, FIXED_T_VALUES } from "../../src/textures/dice";

function edgeToKey(edge: [number, number]): string {
    return `${Math.min(edge[0], edge[1])},${Math.max(edge[0], edge[1])}`;
}

function getFacePoints(texture: DieTexture, face: number): { x: number; y: number }[] {
    const data = texture.faceData.get(face);
    if (!data) throw new Error(`No face data for face ${face}`);
    return data.points;
}

describe("DieTexture", () => {
    describe("seededRandom", () => {
        it("produces the same sequence for the same seed", () => {
            const texture1 = new D6Texture({ seed: 42 });
            const texture2 = new D6Texture({ seed: 42 });

            const sequence1: number[] = [];
            const sequence2: number[] = [];
            for (let i = 0; i < 10; i++) {
                sequence1.push(texture1.seededRandom());
                sequence2.push(texture2.seededRandom());
            }

            expect(sequence1).toEqual(sequence2);
        });

        it("produces different numbers on each call", () => {
            const texture = new D6Texture({ seed: 42 });

            const numbers: number[] = [];
            for (let i = 0; i < 100; i++) {
                numbers.push(texture.seededRandom());
            }

            const unique = new Set(numbers);
            expect(unique.size).toBe(100);
        });

        it("produces different sequences for different seeds", () => {
            const texture1 = new D6Texture({ seed: 42 });
            const texture2 = new D6Texture({ seed: 43 });

            const first1 = texture1.seededRandom();
            const first2 = texture2.seededRandom();

            expect(first1).not.toBe(first2);
        });
    });

    describe("findAllClosedLoops", () => {
        describe("determinism", () => {
            it("produces identical results for the same seed", () => {
                const texture1 = new D6Texture({ seed: 12345 });
                const texture2 = new D6Texture({ seed: 12345 });
                expect(texture1.findAllClosedLoops()).toEqual(
                    texture2.findAllClosedLoops(),
                );
            });

            it("produces different results for different numerical seeds", () => {
                const texture1 = new D6Texture({ seed: 12345 });
                const texture2 = new D6Texture({ seed: 67890 });
                expect(texture1.findAllClosedLoops()).not.toEqual(
                    texture2.findAllClosedLoops(),
                );
            });

            it("produces different results for different string seeds", () => {
                const texture1 = new D6Texture({ seed: "norm" });
                const texture2 = new D6Texture({ seed: "norman" });
                expect(texture1.findAllClosedLoops()).not.toEqual(
                    texture2.findAllClosedLoops(),
                );
            });
        });

        describe("loop structure", () => {
            it("no face is crossed more than twice", () => {
                for (let seed = 0; seed < 100; seed++) {
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                    const texture = new D6Texture({ seed });
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
                { Texture: D4Texture, name: "d4" },
                { Texture: D6Texture, name: "d6" },
                { Texture: D8Texture, name: "d8" },
                { Texture: D12Texture, name: "d12" },
                { Texture: D20Texture, name: "d20" },
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
            const texture = new D6Texture({ seed: 12345 });
            const face = 1;
            const adjFaces = texture.getAdjacentFaces(face);

            for (const adjFace of adjFaces) {
                const result1 = texture.isEdgeReversed(face, adjFace);
                const result2 = texture.isEdgeReversed(face, adjFace);
                expect(result1).toBe(result2);
            }
        });

        it("returns opposite results when arguments are swapped", () => {
            const texture = new D6Texture({ seed: 12345 });
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
            const texture = new D6Texture({ seed: 12345 });
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
            const texture = new D6Texture({ seed: 12345 });
            const face = 1;
            const adjFace = texture.getAdjacentFaces(face)[0];

            const p1 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.25 });
            const p2 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.5 });
            const p3 = texture.edgeTargetToCanvas({ face, adjFace, t: 0.75 });

            expect(p1.x !== p2.x || p1.y !== p2.y).toBe(true);
            expect(p2.x !== p3.x || p2.y !== p3.y).toBe(true);
        });

        it("t=0.5 returns midpoint between t=0.25 and t=0.75", () => {
            const texture = new D6Texture({ seed: 12345 });
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

    describe("latitude", () => {
        const d6 = new D6Texture();
        const d4 = new D4Texture();

        describe("axis", () => {
            // chamfered vertices are 5% toward face centroid, so values are
            // slightly offset from the unchamfered 0, 0.5, 1 positions
            it("d6 balance vertex is near 0", () => {
                const pts = getFacePoints(d6, 6);
                const idx = d6.faceVertices[6].indexOf(7);
                expect(pts[idx].latitude).toBeCloseTo(0, 1);
            });

            it("d6 opposite vertex is near 1", () => {
                const pts = getFacePoints(d6, 3);
                const idx = d6.faceVertices[3].indexOf(0);
                expect(pts[idx].latitude).toBeCloseTo(1, 1);
            });

            it("d6 intermediate vertices are between 0 and 1", () => {
                const pts = getFacePoints(d6, 1);
                const idx = d6.faceVertices[1].indexOf(1);
                expect(pts[idx].latitude).toBeCloseTo(2 / 3, 1);
            });

            // d4 has tilted axis toward opposite vertex
            it("d4 balance vertex is near 0", () => {
                const pts = getFacePoints(d4, 2);
                const idx = d4.faceVertices[2].indexOf(3);
                expect(pts[idx].latitude).toBeCloseTo(0, 1);
            });

            it("d4 opposite vertex is near 1", () => {
                const pts = getFacePoints(d4, 2);
                const idx = d4.faceVertices[2].indexOf(0);
                expect(pts[idx].latitude).toBeCloseTo(1, 1);
            });

            it("d4 equatorial vertices are near 0.5", () => {
                const pts2 = getFacePoints(d4, 2);
                const idx2 = d4.faceVertices[2].indexOf(1);
                expect(pts2[idx2].latitude).toBeCloseTo(0.5, 1);
                const pts1 = getFacePoints(d4, 1);
                const idx1 = d4.faceVertices[1].indexOf(2);
                expect(pts1[idx1].latitude).toBeCloseTo(0.5, 1);
            });
        });

        describe("faces", () => {
            it("all points have latitude in 0-1 range", () => {
                for (const [, data] of d6.faceData) {
                    for (const pt of data.points) {
                        expect(typeof pt.latitude).toBe("number");
                        expect(pt.latitude).toBeGreaterThanOrEqual(0);
                        expect(pt.latitude).toBeLessThanOrEqual(1);
                    }
                }
            });

            it("latitude varies across face points", () => {
                let foundVariation = false;
                for (const [, data] of d6.faceData) {
                    const latitudes = data.points.map((pt) => pt.latitude);
                    const min = Math.min(...latitudes);
                    const max = Math.max(...latitudes);
                    if (max - min > 0.01) {
                        foundVariation = true;
                        break;
                    }
                }
                expect(foundVariation).toBe(true);
            });

            it("d4 faces all have bands", () => {
                for (const face of [1, 2, 3, 4]) {
                    const pts = getFacePoints(d4, face);
                    const latitudes = pts.map((pt) => {
                        if (pt.latitude === undefined) {
                            throw new Error("Point missing latitude");
                        }
                        return pt.latitude;
                    });
                    const minV = Math.min(...latitudes);
                    const maxV = Math.max(...latitudes);
                    expect(maxV - minV, `face ${face}`).toBeGreaterThan(0.4);
                }
            });
        });

        describe("strips", () => {
            it("all points have latitude in 0-1 range", () => {
                for (const [, data] of d6.stripData) {
                    for (const pt of data.points) {
                        expect(typeof pt.latitude).toBe("number");
                        expect(pt.latitude).toBeGreaterThanOrEqual(0);
                        expect(pt.latitude).toBeLessThanOrEqual(1);
                    }
                }
            });

            it("inner and outer edges have different latitudes", () => {
                let foundDifference = false;
                for (const [, data] of d6.stripData) {
                    // points: [inner1, inner2, outer2, outer1]
                    const lat0 = data.points[0].latitude ?? 0;
                    const lat1 = data.points[1].latitude ?? 0;
                    const lat2 = data.points[2].latitude ?? 0;
                    const lat3 = data.points[3].latitude ?? 0;
                    if (Math.abs(lat0 - lat3) > 0.001 || Math.abs(lat1 - lat2) > 0.001) {
                        foundDifference = true;
                        break;
                    }
                }
                expect(foundDifference).toBe(true);
            });
        });

        describe("crowns", () => {
            it("all points have latitude in 0-1 range", () => {
                for (const [, data] of d6.crownData) {
                    for (const pt of data.points) {
                        expect(typeof pt.latitude).toBe("number");
                        expect(pt.latitude).toBeGreaterThanOrEqual(0);
                        expect(pt.latitude).toBeLessThanOrEqual(1);
                    }
                }
            });

            it("non-pole crowns have varying latitudes", () => {
                let foundVariation = false;
                for (const [vertex, data] of d6.crownData) {
                    if (vertex === 0 || vertex === 7) continue;
                    const latitudes = data.points.map((pt) => pt.latitude ?? 0);
                    const min = Math.min(...latitudes);
                    const max = Math.max(...latitudes);
                    if (max - min > 0.001) {
                        foundVariation = true;
                        break;
                    }
                }
                expect(foundVariation).toBe(true);
            });
        });
    });
});
