import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";

// the d6 is our reference die edge length (2), everything is relative to it
export const DIE_SCALE = 1.4;

// a sixteen-segment prism, two caps and a band of rim faces
const DEG = Math.PI / 180;
export const SEGMENTS = 16;
export const HALF_THICKNESS = 0.055;
export const VERTICES: THREE.Vector3[] = [HALF_THICKNESS, -HALF_THICKNESS].flatMap(
    (y) =>
        Array.from(
            { length: SEGMENTS },
            (_, segment) =>
                new THREE.Vector3(
                    Math.cos(segment * 22.5 * DEG),
                    y,
                    Math.sin(segment * 22.5 * DEG),
                ),
        ),
);

// heads and tails are the caps; the rim faces have no value so should be rerolled
export const FACES: DieFaces = [
    {
        value: 1,
        vertices: Array.from({ length: SEGMENTS }, (_, i) => (SEGMENTS - i) % SEGMENTS),
        stance: 0,
    },
    {
        value: 2,
        vertices: Array.from({ length: SEGMENTS }, (_, i) => SEGMENTS + i),
        stance: 0,
    },
    ...Array.from({ length: SEGMENTS }, (_, segment) => {
        const next = (segment + 1) % SEGMENTS;
        return {
            value: 0,
            vertices: [next, SEGMENTS + next, SEGMENTS + segment, segment],
            stance: 0,
        };
    }),
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.filter((face) => face.value > 0).map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.filter((face) => face.value > 0).map((face) => [face.value, face.stance]),
);
