import type * as THREE from "three";
import { DIE_SCALE, FACE_STANCE, FACE_VERTICES, FACES, VERTICES } from "../bodies/d12";
import { D12Texture } from "../textures/d12";
import { createDie, Die } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const defaultTexture = new D12Texture();

export class D12 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;
}

export async function createD12(
    size = 1,
    texture: D12Texture = defaultTexture,
): Promise<D12> {
    return createDie(D12, DIE_SCALE, VERTICES, FACES, texture, geometryCache, size);
}
