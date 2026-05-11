import * as THREE from "three";
import {
    FACES,
    FACE_BOTTOM_EDGE,
    FACE_VERTICES,
    VERTICES,
    createD12Body,
} from "../bodies/d12";
import { D12Texture } from "../textures/d12";
import { createChamferedGeometry } from "./chamfer";
import { Die } from "./dice";

const d12Texture = new D12Texture();

export class D12 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceBottomEdge = FACE_BOTTOM_EDGE;

    protected getFaceRotation(): number {
        return 0;
    }

    defaultOrientation(): THREE.Quaternion {
        return this.orientToFace(1);
    }
}

export async function createD12(size = 0.5, texture?: THREE.Texture): Promise<D12> {
    const scale = size / 2;
    const vertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));

    const geometry = createChamferedGeometry(vertices, FACES, 0.05);
    const material = new THREE.MeshStandardMaterial({
        map: texture ?? (await d12Texture.createTexture()),
    });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createD12Body(scale);

    return new D12(mesh, physics);
}
