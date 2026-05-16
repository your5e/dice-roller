import type * as THREE from "three";
import { DIE_SCALE, FACES, FACE_STANCE, FACE_VERTICES, VERTICES } from "../bodies/d12";
import { D12Texture } from "../textures/d12";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d12Texture = new D12Texture();

export class D12 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;
}

export async function createD12(size = 1, texture?: THREE.Texture): Promise<D12> {
    return createDie(
        D12,
        DIE_SCALE,
        VERTICES,
        FACES,
        d12Texture,
        geometryCache,
        size,
        texture,
    );
}
