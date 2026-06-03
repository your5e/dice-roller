import type * as THREE from "three";
import {
    DIE_SCALE,
    FACE_STANCE,
    FACE_VERTICES,
    FACES,
    PERCENTILE_FACE_STANCE,
    PERCENTILE_FACE_VERTICES,
    PERCENTILE_FACES,
    VERTICES,
} from "../bodies/d10";
import { D10Texture, DPercentileTexture } from "../textures/d10";
import type { TextureOptions } from "../textures/dice";
import { createDie, Die } from "./dice";

const d10GeometryCache = new Map<number, THREE.BufferGeometry>();
const percentileGeometryCache = new Map<number, THREE.BufferGeometry>();
const defaultD10Texture = new D10Texture();
const defaultPercentileTexture = new DPercentileTexture();

export class D10 extends Die {
    faceVertices = FACE_VERTICES;
    meshVertices = VERTICES;
    faceStance = FACE_STANCE;

    override getFaceLabel(value: number): string {
        return String(value % 10);
    }

    // d10 numbers always point to apex, they don't "sit" on any edge
    override computeUprightAngle(
        faceValue: number,
        faceUpQuat: THREE.Quaternion,
    ): number {
        const verts = this.faceVertices[faceValue];
        const apex = this.meshVertices[verts[0]].clone().applyQuaternion(faceUpQuat);
        return Math.atan2(apex.x, apex.z) + Math.PI;
    }

    async replaceTexture(options: TextureOptions): Promise<void> {
        const material = this.mesh.material as THREE.MeshPhysicalMaterial;
        material.map?.dispose();
        material.map = await new D10Texture(options).createTexture();
    }
}

export class DPercentile extends Die {
    faceVertices = PERCENTILE_FACE_VERTICES;
    meshVertices = VERTICES;
    faceStance = PERCENTILE_FACE_STANCE;

    override getFaceLabel(value: number): string {
        return String(value % 100).padStart(2, "0");
    }

    override defaultOrientation(): THREE.Quaternion {
        return this.orientToFace(10);
    }

    override computeUprightAngle(
        faceValue: number,
        faceUpQuat: THREE.Quaternion,
    ): number {
        const verts = this.faceVertices[faceValue];
        const apex = this.meshVertices[verts[0]].clone().applyQuaternion(faceUpQuat);
        return Math.atan2(apex.x, apex.z) + Math.PI;
    }

    async replaceTexture(options: TextureOptions): Promise<void> {
        const material = this.mesh.material as THREE.MeshPhysicalMaterial;
        material.map?.dispose();
        material.map = await new DPercentileTexture(options).createTexture();
    }
}

export async function createD10(
    size = 1,
    texture: D10Texture = defaultD10Texture,
): Promise<D10> {
    return createDie(D10, DIE_SCALE, VERTICES, FACES, texture, d10GeometryCache, size);
}

export async function createPercentile(
    size = 1,
    texture: DPercentileTexture = defaultPercentileTexture,
): Promise<DPercentile> {
    return createDie(
        DPercentile,
        DIE_SCALE,
        VERTICES,
        PERCENTILE_FACES,
        texture,
        percentileGeometryCache,
        size,
    );
}

export async function createD100(
    size = 1,
    d10Texture: D10Texture = defaultD10Texture,
    percentileTexture: DPercentileTexture = defaultPercentileTexture,
) {
    const tens = await createPercentile(size, percentileTexture);
    const ones = await createD10(size, d10Texture);
    return {
        dice: [tens, ones],
        readResult() {
            const t = tens.physics.readFace() % 100;
            const o = ones.physics.readFace() % 10;
            return t + o || 100;
        },
    };
}
