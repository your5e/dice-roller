import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 1.3;

// a cube has two sets of four corners where no two share an
// edge, and either set forms a pyramid
const S = 1 / Math.sqrt(2); // scale edges to unit length
export const DIE_MASS = 1000;
export const VERTICES: THREE.Vector3[] = [
    new THREE.Vector3(S, S, S),
    new THREE.Vector3(S, -S, -S),
    new THREE.Vector3(-S, S, -S),
    new THREE.Vector3(-S, -S, S),
];

export const FACES: DieFaces = [
    { value: 1, vertices: [0, 1, 2], stance: 0 },
    { value: 2, vertices: [0, 3, 1], stance: 0 },
    { value: 4, vertices: [1, 3, 2], stance: 0, adjacent: 2 },
    { value: 3, vertices: [0, 2, 3], stance: 0, adjacent: 2 },
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
