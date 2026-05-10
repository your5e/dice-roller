import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";
import { type PhysicsDie, createDieBody } from "../physics/dice";

// A cube has 8 vertices at unit distance from centre.
export const VERTICES: THREE.Vector3[] = [1, -1].flatMap((x) =>
    [1, -1].flatMap((y) => [1, -1].map((z) => new THREE.Vector3(x, y, z))),
);

// Six square faces, vertices listed anti-clockwise. Opposite faces sum to 7.
// The cube sits with face 1 toward +X, face 2 toward +Y, face 3 toward +Z.
export const FACES: DieFaces = [
    { value: 1, vertices: [0, 2, 3, 1], bottomEdge: 0 },
    { value: 6, vertices: [4, 5, 7, 6], bottomEdge: 0 },
    { value: 2, vertices: [0, 1, 5, 4], bottomEdge: 0 },
    { value: 5, vertices: [2, 6, 7, 3], bottomEdge: 0 },
    { value: 3, vertices: [0, 4, 6, 2], bottomEdge: 0 },
    { value: 4, vertices: [1, 3, 7, 5], bottomEdge: 0 },
];

export function createD6Body(scale: number): PhysicsDie {
    const vertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));
    return createDieBody(vertices, FACES);
}
