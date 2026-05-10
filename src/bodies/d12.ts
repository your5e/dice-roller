import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";
import { PHI } from "../geometry";
import { type PhysicsDie, createDieBody } from "../physics/dice";

const INV_PHI = 1 / PHI;

// A cube and three mutually perpendicular golden rectangles define the 20
// vertices of a dodecahedron.
export const VERTICES: THREE.Vector3[] = [
    ...[1, -1].flatMap((x) =>
        [1, -1].flatMap((y) => [1, -1].map((z) => new THREE.Vector3(x, y, z))),
    ),
    ...[1, -1].flatMap((a) =>
        [1, -1].map((b) => new THREE.Vector3(0, a * PHI, b * INV_PHI)),
    ),
    ...[1, -1].flatMap((a) =>
        [1, -1].map((b) => new THREE.Vector3(a * INV_PHI, 0, b * PHI)),
    ),
    ...[1, -1].flatMap((a) =>
        [1, -1].map((b) => new THREE.Vector3(a * PHI, b * INV_PHI, 0)),
    ),
];

// Twelve pentagonal faces, vertices listed anti-clockwise. Opposite faces sum to 13.
// The dodecahedron sits with face 1 toward +Y (top) and face 12 toward -Y (bottom).
export const FACES: DieFaces = [
    { value: 1, vertices: [12, 2, 17, 16, 0], bottomEdge: 0 },
    { value: 12, vertices: [15, 7, 19, 18, 5], bottomEdge: 0 },
    { value: 2, vertices: [12, 0, 8, 4, 14], bottomEdge: 0 },
    { value: 11, vertices: [13, 3, 11, 7, 15], bottomEdge: 0 },
    { value: 3, vertices: [0, 16, 1, 9, 8], bottomEdge: 0 },
    { value: 10, vertices: [11, 10, 6, 19, 7], bottomEdge: 0 },
    { value: 4, vertices: [1, 13, 15, 5, 9], bottomEdge: 0 },
    { value: 9, vertices: [10, 2, 12, 14, 6], bottomEdge: 0 },
    { value: 5, vertices: [16, 17, 3, 13, 1], bottomEdge: 0 },
    { value: 8, vertices: [19, 6, 14, 4, 18], bottomEdge: 0 },
    { value: 6, vertices: [17, 2, 10, 11, 3], bottomEdge: 0 },
    { value: 7, vertices: [18, 4, 8, 9, 5], bottomEdge: 0 },
];

export function createD12Body(scale: number): PhysicsDie {
    const vertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));
    return createDieBody(vertices, FACES);
}
