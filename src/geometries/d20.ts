import * as THREE from "three";
import { DIE_SCALE, FACES, FACE_STANCE, FACE_VERTICES, VERTICES } from "../bodies/d20";
import { D20Texture } from "../textures/d20";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d20Texture = new D20Texture();

export class D20 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;

    defaultOrientation(): THREE.Quaternion {
        const northPole = VERTICES[0].clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        return new THREE.Quaternion().setFromUnitVectors(northPole, up);
    }
}

export async function createD20(size = 1, texture?: THREE.Texture): Promise<D20> {
    return createDie(
        D20,
        DIE_SCALE,
        VERTICES,
        FACES,
        d20Texture,
        geometryCache,
        size,
        texture,
    );
}
