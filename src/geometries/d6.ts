import type * as THREE from "three";
import { DIE_SCALE, FACE_STANCE, FACE_VERTICES, FACES, VERTICES } from "../bodies/d6";
import { D6Texture } from "../textures/d6";
import { createDie, Die } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const defaultTexture = new D6Texture();

export class D6 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;
}

export async function createD6(
    size = 1,
    texture: D6Texture = defaultTexture,
): Promise<D6> {
    return createDie(D6, DIE_SCALE, VERTICES, FACES, texture, geometryCache, size);
}
