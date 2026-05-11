import * as THREE from "three";
import {
    FACES,
    FACE_BOTTOM_EDGE,
    FACE_VERTICES,
    VERTICES,
    createD6Body,
} from "../bodies/d6";
import { D6Texture } from "../textures/d6";
import { createChamferedGeometry } from "./chamfer";
import { Die } from "./dice";

const d6Texture = new D6Texture();

export class D6 extends Die {
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

export async function createD6(size = 0.5, texture?: THREE.Texture): Promise<D6> {
    const scale = size / 2;
    const vertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));

    const geometry = createChamferedGeometry(vertices, FACES, 0.05);
    const material = new THREE.MeshStandardMaterial({
        map: texture ?? (await d6Texture.createTexture()),
    });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createD6Body(scale);

    return new D6(mesh, physics);
}
