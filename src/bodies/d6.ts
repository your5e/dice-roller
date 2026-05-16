import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 1;

// a cube has 8 corners and twelve edges all of the same unit length
export const VERTICES: THREE.Vector3[] = [1, -1].flatMap((x) =>
    [1, -1].flatMap((y) => [1, -1].map((z) => new THREE.Vector3(x, y, z))),
);

// most common d6 layout is 1,2,3 share a vertex, 4,5,6 lie opposite
export const FACES: DieFaces = [
    // the equator
    { value: 3, vertices: [0, 4, 6, 2], stance: 0 },
    { value: 1, vertices: [0, 2, 3, 1], stance: 0 },
    { value: 4, vertices: [1, 3, 7, 5], stance: 2 },
    { value: 6, vertices: [4, 5, 7, 6], stance: 0 },

    // the poles
    { value: 5, vertices: [2, 6, 7, 3], stance: 0, adjacent: 4 },
    { value: 2, vertices: [0, 1, 5, 4], stance: 3, adjacent: 4 },
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
