import type * as THREE from "three";
import { DIE_SCALE, FACES, FACE_STANCE, FACE_VERTICES, VERTICES } from "../bodies/d10";
import { D10Texture } from "../textures/d10";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d10Texture = new D10Texture();

export class D10 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;

    // d10 numbers always point to apex, they don't "sit" on any edge
    protected override computeUprightAngle(
        faceValue: number,
        faceUpQuat: THREE.Quaternion,
    ): number {
        const verts = this.faceVertices[faceValue];
        const apex = this.meshVertices[verts[0]].clone().applyQuaternion(faceUpQuat);
        return Math.atan2(apex.x, apex.z) + Math.PI;
    }
}

export async function createD10(size = 1, texture?: THREE.Texture): Promise<D10> {
    return createDie(
        D10,
        DIE_SCALE,
        VERTICES,
        FACES,
        d10Texture,
        geometryCache,
        size,
        texture,
    );
}
