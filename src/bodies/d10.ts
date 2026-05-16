import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 1.1;

// two points with a twisted band of ten kite shapes between them
const DEG = Math.PI / 180;
const S = 2 / Math.sqrt(0.9 ** 2 + (1.0 - 0.106) ** 2);
export const APEX_HEIGHT = 1.0 * S;
export const RING_HEIGHT = 0.106 * S;
export const RING_RADIUS = 0.9 * S;

export const VERTICES: THREE.Vector3[] = [
    // 0: top apex
    new THREE.Vector3(0, APEX_HEIGHT, 0),
    // 1: bottom apex
    new THREE.Vector3(0, -APEX_HEIGHT, 0),
    // 2-6: upper ring at +RING_HEIGHT, angles 0°, 72°, 144°, 216°, 288°
    ...[0, 1, 2, 3, 4].map(
        (i) =>
            new THREE.Vector3(
                RING_RADIUS * Math.cos(i * 72 * DEG),
                RING_HEIGHT,
                RING_RADIUS * Math.sin(i * 72 * DEG),
            ),
    ),
    // 7-11: lower ring at -RING_HEIGHT, angles 36°, 108°, 180°, 252°, 324°
    ...[0, 1, 2, 3, 4].map(
        (i) =>
            new THREE.Vector3(
                RING_RADIUS * Math.cos((i * 72 + 36) * DEG),
                -RING_HEIGHT,
                RING_RADIUS * Math.sin((i * 72 + 36) * DEG),
            ),
    ),
];

// evens around one apex, odds around the other, opposite faces sum to 11
export const FACES: DieFaces = [
    // top fan
    { value: 2, vertices: [0, 3, 7, 2], stance: 0 },
    { value: 4, vertices: [0, 4, 8, 3], stance: 0 },
    { value: 6, vertices: [0, 5, 9, 4], stance: 0 },
    { value: 8, vertices: [0, 6, 10, 5], stance: 0 },
    { value: 10, vertices: [0, 2, 11, 6], stance: 0 },

    // bottom fan
    { value: 1, vertices: [1, 11, 2, 7], stance: 0, adjacent: 2 },
    { value: 9, vertices: [1, 7, 3, 8], stance: 0 },
    { value: 7, vertices: [1, 8, 4, 9], stance: 0 },
    { value: 5, vertices: [1, 9, 5, 10], stance: 0 },
    { value: 3, vertices: [1, 10, 6, 11], stance: 0 },
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
