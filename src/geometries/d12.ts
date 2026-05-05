import * as THREE from "three";
import { createDieBody } from "../physics/dice";
import { type DieFaces, createChamferedGeometry } from "./chamfer";
import type { Die } from "./dice";

export function createD12(size = 0.5, chamfer = 0.05): Die {
    const scale = size / 2;
    const phi = (1 + Math.sqrt(5)) / 2;
    const invPhi = 1 / phi;

    // Map out the 20 corners of a dodecahedron. The positions are derived from the
    // golden ratio (phi), which defines the proportions of a regular dodecahedron.
    const vertices = [
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(1, 1, -1),
        new THREE.Vector3(1, -1, 1),
        new THREE.Vector3(1, -1, -1),
        new THREE.Vector3(-1, 1, 1),
        new THREE.Vector3(-1, 1, -1),
        new THREE.Vector3(-1, -1, 1),
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(0, phi, invPhi),
        new THREE.Vector3(0, phi, -invPhi),
        new THREE.Vector3(0, -phi, invPhi),
        new THREE.Vector3(0, -phi, -invPhi),
        new THREE.Vector3(invPhi, 0, phi),
        new THREE.Vector3(invPhi, 0, -phi),
        new THREE.Vector3(-invPhi, 0, phi),
        new THREE.Vector3(-invPhi, 0, -phi),
        new THREE.Vector3(phi, invPhi, 0),
        new THREE.Vector3(phi, -invPhi, 0),
        new THREE.Vector3(-phi, invPhi, 0),
        new THREE.Vector3(-phi, -invPhi, 0),
    ].map((v) => v.multiplyScalar(scale));

    // Map out the 12 faces and which number is displayed on it. The corners are
    // from vertices, and must be listed anti-clockwise so that the number is facing
    // out when rendered. Opposite faces sum to 13.
    // Face arguments are (number on face, [vertex, vertex, vertex...]).
    const faces: DieFaces = [
        [1, [12, 2, 17, 16, 0]],
        [12, [15, 7, 19, 18, 5]],

        [2, [12, 0, 8, 4, 14]],
        [11, [13, 3, 11, 7, 15]],

        [3, [0, 16, 1, 9, 8]],
        [10, [11, 10, 6, 19, 7]],

        [4, [1, 13, 15, 5, 9]],
        [9, [10, 2, 12, 14, 6]],

        [5, [16, 17, 3, 13, 1]],
        [8, [19, 6, 14, 4, 18]],

        [6, [17, 2, 10, 11, 3]],
        [7, [18, 4, 8, 9, 5]],
    ];

    const geometry = createChamferedGeometry(vertices, faces, chamfer);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createDieBody(vertices, faces);

    return { mesh, physics };
}
