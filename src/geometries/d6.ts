import * as THREE from "three";
import { createDieBody } from "../physics/dice";
import { type DieFaces, createChamferedGeometry } from "./chamfer";
import type { Die } from "./dice";

export function createD6(size = 0.5, chamfer = 0.05): Die {
    const scale = size / 2;

    // Map out the 8 corners of the cube; each corner is a combination of half the
    // width (as measured edge to edge) from the center, which is the origin point.
    const vertices = [
        new THREE.Vector3(scale, scale, scale),
        new THREE.Vector3(scale, scale, -scale),
        new THREE.Vector3(scale, -scale, scale),
        new THREE.Vector3(scale, -scale, -scale),
        new THREE.Vector3(-scale, scale, scale),
        new THREE.Vector3(-scale, scale, -scale),
        new THREE.Vector3(-scale, -scale, scale),
        new THREE.Vector3(-scale, -scale, -scale),
    ];

    // Map out the six faces and which number is displayed on it. The
    // corners are from vertices, and must be listed anti-clockwise so
    // that the number is facing out when rendered.
    // Face arguments are (number on face, [vertex, vertex, vertex...]).
    const faces: DieFaces = [
        [1, [0, 2, 3, 1]],
        [6, [4, 5, 7, 6]],

        [2, [0, 1, 5, 4]],
        [5, [2, 6, 7, 3]],

        [3, [0, 4, 6, 2]],
        [4, [1, 3, 7, 5]],
    ];

    // Visual: chamfered geometry for rendering
    const geometry = createChamferedGeometry(vertices, faces, chamfer);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);

    // Physics
    const physics = createDieBody(vertices, faces);

    return { mesh, physics };
}
