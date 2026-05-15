import type * as THREE from "three";
import { DIE_SCALE, FACES, FACE_STANCE, FACE_VERTICES, VERTICES } from "../bodies/d6";
import { D6Texture } from "../textures/d6";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d6Texture = new D6Texture();

export class D6 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;
}

export async function createD6(size = 1, texture?: THREE.Texture): Promise<D6> {
    return createDie(
        D6,
        DIE_SCALE,
        VERTICES,
        FACES,
        d6Texture,
        geometryCache,
        size,
        texture,
    );
}
