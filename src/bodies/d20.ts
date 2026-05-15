import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";
import { PHI } from "../geometry";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 0.8;

// three rectangles slotted together at right angles -
// their twelve corners form twenty triangles
export const VERTICES: THREE.Vector3[] = [
    ...[1, -1].flatMap((y) => [1, -1].map((z) => new THREE.Vector3(0, y, z * PHI))),
    ...[1, -1].flatMap((x) => [1, -1].map((y) => new THREE.Vector3(x, y * PHI, 0))),
    ...[1, -1].flatMap((x) => [1, -1].map((z) => new THREE.Vector3(x * PHI, 0, z))),
];

// a "fair die" layout clusters some high numbers around 1, and low around 20,
// to offset any possible bias in the physical weight of the die
export const FACES: DieFaces = [
    // draw each sawtooth between the north and south poles
    { value: 1, vertices: [0, 10, 2], stance: 0 },
    { value: 19, vertices: [0, 6, 10], stance: 0 },
    { value: 11, vertices: [6, 11, 10], stance: 0 },
    { value: 5, vertices: [1, 11, 6], stance: 0 },

    { value: 15, vertices: [7, 10, 11], stance: 0 },
    { value: 17, vertices: [2, 10, 7], stance: 0 },
    { value: 9, vertices: [3, 7, 11], stance: 0 },
    { value: 13, vertices: [1, 3, 11], stance: 0 },

    { value: 7, vertices: [3, 5, 7], stance: 0 },
    { value: 18, vertices: [2, 7, 5], stance: 0 },
    { value: 2, vertices: [3, 9, 5], stance: 0 },
    { value: 20, vertices: [1, 9, 3], stance: 0 },

    { value: 10, vertices: [5, 9, 8], stance: 0 },
    { value: 16, vertices: [2, 5, 8], stance: 0 },
    { value: 6, vertices: [4, 8, 9], stance: 0 },
    { value: 4, vertices: [1, 4, 9], stance: 0 },

    { value: 12, vertices: [0, 8, 4], stance: 0 },
    { value: 14, vertices: [0, 4, 6], stance: 0 },
    { value: 8, vertices: [0, 2, 8], stance: 0 },
    { value: 3, vertices: [1, 6, 4], stance: 0 },
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
