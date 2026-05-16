import type * as THREE from "three";
import { DIE_SCALE, FACES, FACE_STANCE, FACE_VERTICES, VERTICES } from "../bodies/d8";
import { D8Texture } from "../textures/d8";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d8Texture = new D8Texture();

export class D8 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;
}

export async function createD8(size = 1, texture?: THREE.Texture): Promise<D8> {
    return createDie(
        D8,
        DIE_SCALE,
        VERTICES,
        FACES,
        d8Texture,
        geometryCache,
        size,
        texture,
    );
}
