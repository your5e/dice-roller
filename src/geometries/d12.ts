import * as THREE from "three";
import { FACES, VERTICES, createD12Body } from "../bodies/d12";
import { createChamferedGeometry } from "./chamfer";
import type { Die } from "./dice";

export function createD12(size = 0.5, chamfer = 0.05): Die {
    const scale = size / 2;
    const vertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));

    const geometry = createChamferedGeometry(vertices, FACES, chamfer);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createD12Body(scale);

    return { mesh, physics };
}
