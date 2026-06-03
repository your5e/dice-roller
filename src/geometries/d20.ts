import type * as THREE from "three";
import { DIE_SCALE, FACE_STANCE, FACE_VERTICES, FACES, VERTICES } from "../bodies/d20";
import { D20Texture } from "../textures/d20";
import type { TextureOptions } from "../textures/dice";
import { createDie, Die } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const defaultTexture = new D20Texture();

export class D20 extends Die {
    faceVertices = FACE_VERTICES;
    meshVertices = VERTICES;
    faceStance = FACE_STANCE;

    async replaceTexture(options: TextureOptions): Promise<void> {
        const material = this.mesh.material as THREE.MeshPhysicalMaterial;
        material.map?.dispose();
        material.map = await new D20Texture(options).createTexture();
    }
}

export async function createD20(
    size = 1,
    texture: D20Texture = defaultTexture,
): Promise<D20> {
    return createDie(D20, DIE_SCALE, VERTICES, FACES, texture, geometryCache, size);
}
