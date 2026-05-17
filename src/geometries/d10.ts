import type * as THREE from "three";
import {
    DIE_SCALE,
    FACES,
    FACE_STANCE,
    FACE_VERTICES,
    PERCENTILE_FACES,
    PERCENTILE_FACE_STANCE,
    PERCENTILE_FACE_VERTICES,
    VERTICES,
} from "../bodies/d10";
import { D10Texture, DPercentileTexture } from "../textures/d10";
import { Die, createDie } from "./dice";

const d10GeometryCache = new Map<number, THREE.BufferGeometry>();
const percentileGeometryCache = new Map<number, THREE.BufferGeometry>();
const d10Texture = new D10Texture();
const percentileTexture = new DPercentileTexture();

export class D10 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;

    override getFaceLabel(value: number): string {
        return String(value % 10);
    }

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

export class DPercentile extends Die {
    protected faceVertices = PERCENTILE_FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = PERCENTILE_FACE_STANCE;

    override getFaceLabel(value: number): string {
        return String(value % 100).padStart(2, "0");
    }

    override defaultOrientation(): THREE.Quaternion {
        return this.orientToFace(10);
    }

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
        d10GeometryCache,
        size,
        texture,
    );
}

export async function createPercentile(
    size = 1,
    texture?: THREE.Texture,
): Promise<DPercentile> {
    return createDie(
        DPercentile,
        DIE_SCALE,
        VERTICES,
        PERCENTILE_FACES,
        percentileTexture,
        percentileGeometryCache,
        size,
        texture,
    );
}

export async function createD100(
    size = 1,
    tensTexture?: THREE.Texture,
    onesTexture?: THREE.Texture,
) {
    const tens = await createPercentile(size, tensTexture);
    const ones = await createD10(size, onesTexture);
    return {
        dice: [tens, ones],
        readResult() {
            const t = tens.physics.readFace() % 100;
            const o = ones.physics.readFace() % 10;
            return t + o || 100;
        },
    };
}
