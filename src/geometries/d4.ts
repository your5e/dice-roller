import * as THREE from "three";
import {
    DIE_MASS,
    DIE_SCALE,
    FACES,
    FACE_STANCE,
    FACE_VERTICES,
    VERTICES,
} from "../bodies/d4";
import { D4Texture } from "../textures/d4";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d4Texture = new D4Texture();

export class D4 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;

    // d4 number is the face pointing down, not up
    orientToFace(faceValue: number): THREE.Quaternion {
        const base = super.orientToFace(faceValue);
        return new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
            .multiply(base);
    }
}

export async function createD4(size = 1, texture?: THREE.Texture): Promise<D4> {
    return createDie(
        D4,
        DIE_SCALE,
        VERTICES,
        FACES,
        d4Texture,
        geometryCache,
        size,
        texture,
        DIE_MASS,
        true,
    );
}
