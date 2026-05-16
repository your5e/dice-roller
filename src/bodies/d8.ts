import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 1.2;

// place a point at arm's length in each direction from centre,
// and you get two square pyramids joined at their bases
const S = Math.SQRT2; // scale edges to unit length

export const VERTICES: THREE.Vector3[] = [
    new THREE.Vector3(0, S, 0),
    new THREE.Vector3(0, 0, S),
    new THREE.Vector3(S, 0, 0),
    new THREE.Vector3(0, 0, -S),
    new THREE.Vector3(-S, 0, 0),
    new THREE.Vector3(0, -S, 0),
];

export const FACES: DieFaces = [
    { value: 1, vertices: [0, 1, 2], stance: 0 },
    { value: 6, vertices: [5, 2, 1], stance: 0 },
    { value: 5, vertices: [5, 3, 2], stance: 0 },
    { value: 2, vertices: [0, 2, 3], stance: 0 },
    { value: 4, vertices: [0, 4, 1], stance: 0 },
    { value: 7, vertices: [5, 1, 4], stance: 0 },
    { value: 8, vertices: [5, 4, 3], stance: 0 },
    { value: 3, vertices: [0, 3, 4], stance: 0 },
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
