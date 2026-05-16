import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";
import { PHI } from "../geometry";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 0.5;

// a cube with three rectangles slotted through its centre -
// all 20 corners together form twelve pentagons
const PHI_SQ = PHI * PHI;
export const VERTICES: THREE.Vector3[] = [
    ...[1, -1].flatMap((x) =>
        [1, -1].flatMap((y) =>
            [1, -1].map((z) => new THREE.Vector3(x * PHI, y * PHI, z * PHI)),
        ),
    ),
    ...[1, -1].flatMap((a) => [1, -1].map((b) => new THREE.Vector3(0, a * PHI_SQ, b))),
    ...[1, -1].flatMap((a) => [1, -1].map((b) => new THREE.Vector3(a, 0, b * PHI_SQ))),
    ...[1, -1].flatMap((a) => [1, -1].map((b) => new THREE.Vector3(a * PHI_SQ, b, 0))),
];

export const FACES: DieFaces = [
    // two-flower layout, first join the opposite centres
    { value: 1, vertices: [12, 2, 17, 16, 0], stance: 0 },
    { value: 8, vertices: [16, 17, 3, 13, 1], stance: 2 },
    { value: 2, vertices: [13, 3, 11, 7, 15], stance: 0 },
    { value: 12, vertices: [15, 7, 19, 18, 5], stance: 0 },

    // petals of the first flower
    { value: 11, vertices: [12, 0, 8, 4, 14], stance: 1, adjacent: 1 },
    { value: 7, vertices: [17, 2, 10, 11, 3], stance: 3, adjacent: 1 },
    { value: 3, vertices: [0, 16, 1, 9, 8], stance: 4, adjacent: 1 },
    { value: 9, vertices: [10, 2, 12, 14, 6], stance: 0, adjacent: 1 },

    // remaining petals of the second flower
    { value: 5, vertices: [19, 6, 14, 4, 18], stance: 0, adjacent: 12 },
    { value: 10, vertices: [11, 10, 6, 19, 7], stance: 3, adjacent: 12 },
    { value: 4, vertices: [1, 13, 15, 5, 9], stance: 4, adjacent: 12 },
    { value: 6, vertices: [18, 4, 8, 9, 5], stance: 1, adjacent: 12 },
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
