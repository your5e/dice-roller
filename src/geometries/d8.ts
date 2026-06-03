import type * as THREE from "three";
import { DIE_SCALE, FACE_STANCE, FACE_VERTICES, FACES, VERTICES } from "../bodies/d8";
import { D8Texture } from "../textures/d8";
import type { TextureOptions } from "../textures/dice";
import { createDie, Die } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const defaultTexture = new D8Texture();

export class D8 extends Die {
    faceVertices = FACE_VERTICES;
    meshVertices = VERTICES;
    faceStance = FACE_STANCE;

    async replaceTexture(options: TextureOptions): Promise<void> {
        const material = this.mesh.material as THREE.MeshPhysicalMaterial;
        material.map?.dispose();
        material.map = await new D8Texture(options).createTexture();
    }
}

export async function createD8(
    size = 1,
    texture: D8Texture = defaultTexture,
): Promise<D8> {
    return createDie(D8, DIE_SCALE, VERTICES, FACES, texture, geometryCache, size);
}
