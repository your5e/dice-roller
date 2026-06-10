import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { FACES as D4_FACES, VERTICES as D4_VERTICES } from "../../src/bodies/d4";
import { FACES as D6_FACES, VERTICES as D6_VERTICES } from "../../src/bodies/d6";
import { FACES as D8_FACES, VERTICES as D8_VERTICES } from "../../src/bodies/d8";
import { FACES as D10_FACES, VERTICES as D10_VERTICES } from "../../src/bodies/d10";
import { FACES as D12_FACES, VERTICES as D12_VERTICES } from "../../src/bodies/d12";
import { FACES as D20_FACES, VERTICES as D20_VERTICES } from "../../src/bodies/d20";
import { D4Texture } from "../../src/textures/d4";
import { D6Texture } from "../../src/textures/d6";
import { D8Texture } from "../../src/textures/d8";
import { D10Texture } from "../../src/textures/d10";
import { D12Texture } from "../../src/textures/d12";
import { D20Texture } from "../../src/textures/d20";
import type { Point } from "../../src/textures/dice";
import { cornerAngles, generatedCrowns, generatedStrips } from "../helpers/chamfer";

type NetTexture = {
    pixelDensity: number;
    faceData: Map<number, { points: Point[] }>;
    faceLayout: Map<number, { parent?: number }>;
    stripData: Map<string, { points: Point[] }>;
    crownData: Map<number, { points: Point[]; faceOrder: number[] }>;
    faceVertices: Record<number, number[]>;
};

const DICE: {
    name: string;
    texture: NetTexture;
    vertices: THREE.Vector3[];
    faces: typeof D4_FACES;
}[] = [
    { name: "d4", texture: new D4Texture(), vertices: D4_VERTICES, faces: D4_FACES },
    { name: "d6", texture: new D6Texture(), vertices: D6_VERTICES, faces: D6_FACES },
    { name: "d8", texture: new D8Texture(), vertices: D8_VERTICES, faces: D8_FACES },
    { name: "d10", texture: new D10Texture(), vertices: D10_VERTICES, faces: D10_FACES },
    { name: "d12", texture: new D12Texture(), vertices: D12_VERTICES, faces: D12_FACES },
    { name: "d20", texture: new D20Texture(), vertices: D20_VERTICES, faces: D20_FACES },
];

function toVector(point: Point): THREE.Vector3 {
    return new THREE.Vector3(point.x, point.y, 0);
}

function drawnCorner(
    texture: NetTexture,
    face: number,
    vertexId: number,
): THREE.Vector3 {
    const data = texture.faceData.get(face);
    if (!data) throw new Error(`no face data for face ${face}`);
    const index = texture.faceVertices[face].indexOf(vertexId);
    if (index === -1) throw new Error(`face ${face} has no vertex ${vertexId}`);
    return toVector(data.points[index]);
}

function edgeComponents(
    offset: THREE.Vector3,
    edge: THREE.Vector3,
): { along: number; across: number } {
    const direction = edge.clone().normalize();
    const along = offset.dot(direction);
    const across = offset
        .clone()
        .sub(direction.multiplyScalar(along))
        .length();
    return { along, across };
}

// sign of the polygon's 2D signed area: which way its corners wind
function windingZ(corners: THREE.Vector3[]): number {
    let area = 0;
    const n = corners.length;
    for (let i = 0; i < n; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % n];
        area += a.x * b.y - b.x * a.y;
    }
    return Math.sign(area);
}

// sign of the planar polygon's winding as seen from outside the die: the
// Newell normal of its corners dotted with the outward (centroid) direction
function windingOutward(corners: THREE.Vector3[]): number {
    const normal = new THREE.Vector3();
    const centroid = new THREE.Vector3();
    const n = corners.length;
    for (let i = 0; i < n; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % n];
        normal.x += (a.y - b.y) * (a.z + b.z);
        normal.y += (a.z - b.z) * (a.x + b.x);
        normal.z += (a.x - b.x) * (a.y + b.y);
        centroid.add(a);
    }
    return Math.sign(normal.dot(centroid));
}

describe("the net is a development of the chamfered solid", () => {
    for (const { name, texture, vertices, faces } of DICE) {
        describe(name, () => {
            const bevels = new Map(
                generatedStrips(vertices, faces).map((strip) => [
                    `${Math.min(strip.faceA, strip.faceB)},${Math.max(strip.faceA, strip.faceB)}`,
                    strip.corners,
                ]),
            );

            it("drawn strips have the corner angles of the real bevels", () => {
                expect(texture.stripData.size).toBe(bevels.size);
                for (const [key, strip] of texture.stripData) {
                    const bevel = bevels.get(key);
                    if (!bevel) throw new Error(`no bevel for strip ${key}`);

                    const drawn = cornerAngles(strip.points.map(toVector)).sort(
                        (a, b) => a - b,
                    );
                    const real = cornerAngles(bevel).sort((a, b) => a - b);
                    for (let i = 0; i < 4; i++) {
                        expect(drawn[i], `strip ${key}`).toBeCloseTo(real[i], 2);
                    }
                }
            });

            it("placed faces sit where unfolding the bevel puts them", () => {
                let placements = 0;
                for (const [faceB, layout] of texture.faceLayout) {
                    if (layout.parent === undefined) continue;
                    placements++;
                    const faceA = layout.parent;
                    const key = `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
                    const bevel = bevels.get(key);
                    if (!bevel) throw new Error(`no bevel for strip ${key}`);

                    const shared = texture.faceVertices[faceA].filter((v) =>
                        texture.faceVertices[faceB].includes(v),
                    );
                    expect(shared, `strip ${key}`).toHaveLength(2);
                    const [v, w] = shared;

                    // bevel corners are [B@start, B@end, A@end, A@start];
                    // identify which shared vertex the start corners sit at
                    const startsAtV =
                        bevel[0].distanceTo(vertices[v]) <
                        bevel[0].distanceTo(vertices[w]);
                    const [aV, aW, bV] = startsAtV
                        ? [bevel[3], bevel[2], bevel[0]]
                        : [bevel[2], bevel[3], bevel[1]];

                    // the gap between the drawn faces must be the bevel's end
                    // vector -- measured against the shared edge, the same
                    // distance across and the same slide along
                    const real = edgeComponents(
                        bV.clone().sub(aV),
                        aW.clone().sub(aV),
                    );

                    const cornerAV = drawnCorner(texture, faceA, v);
                    const cornerAW = drawnCorner(texture, faceA, w);
                    const cornerBV = drawnCorner(texture, faceB, v);
                    const net = edgeComponents(
                        cornerBV.sub(cornerAV).divideScalar(texture.pixelDensity),
                        cornerAW.sub(cornerAV),
                    );

                    expect(net.along, `strip ${key} slide along edge`).toBeCloseTo(
                        real.along,
                        5,
                    );
                    expect(net.across, `strip ${key} gap across edge`).toBeCloseTo(
                        real.across,
                        5,
                    );
                }
                expect(placements).toBe(texture.faceData.size - 1);
            });

            it("drawn crowns are congruent to the real caps", () => {
                const caps = generatedCrowns(vertices, faces);
                expect(texture.crownData.size).toBe(caps.length);
                for (const [vertex, crown] of texture.crownData) {
                    const cap = caps[vertex];
                    const order = crown.faceOrder;

                    // pair each drawn corner with the real corner at the same
                    // face, so the two polygons are compared in correspondence
                    // rather than as an unordered bag of distances
                    const drawn = crown.points.map(toVector);
                    const real = order.map((face) => {
                        const j = cap.faceOrder.indexOf(face);
                        if (j === -1) {
                            throw new Error(`cap ${vertex} has no face ${face}`);
                        }
                        return cap.corners[j];
                    });

                    // every labelled distance equal => the corner sets are
                    // congruent up to a reflection
                    for (let i = 0; i < order.length; i++) {
                        for (let j = i + 1; j < order.length; j++) {
                            const drawnDist =
                                drawn[i].distanceTo(drawn[j]) / texture.pixelDensity;
                            const realDist = real[i].distanceTo(real[j]);
                            expect(
                                drawnDist,
                                `crown ${vertex} faces ${order[i]}-${order[j]}`,
                            ).toBeCloseTo(realDist, 5);
                        }
                    }

                    // and matching handedness rules out the reflection: the
                    // drawn winding is the opposite of the cap's winding seen
                    // from outside the die, because the net's y-axis runs down
                    // the canvas while the outward view has it running up
                    expect(
                        windingZ(drawn) * windingOutward(real),
                        `crown ${vertex} handedness`,
                    ).toBe(-1);
                }
            });
        });
    }
});
