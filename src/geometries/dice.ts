import * as THREE from "three";
import { normalFromVertices } from "../geometry";
import { type PhysicsDie, createDieBody } from "../physics/dice";
import type { DieTexture } from "../textures/dice";
import { CHAMFER, type DieFaces, createChamferedGeometry } from "./chamfer";

export abstract class Die {
    constructor(
        public mesh: THREE.Mesh,
        public physics: PhysicsDie,
    ) {}

    protected abstract faceVertices: Record<number, number[]>;
    protected abstract meshVertices: THREE.Vector3[];
    protected abstract faceStance: Record<number, number>;

    defaultOrientation(): THREE.Quaternion {
        return this.orientToFace(1);
    }

    orientToFace(faceValue: number): THREE.Quaternion {
        const verts = this.faceVertices[faceValue];
        const normal = normalFromVertices(
            this.meshVertices[verts[0]],
            this.meshVertices[verts[1]],
            this.meshVertices[verts[2]],
        );
        const up = new THREE.Vector3(0, 1, 0);
        const faceUpQuat = new THREE.Quaternion().setFromUnitVectors(normal, up);

        const angle = this.computeUprightAngle(faceValue, faceUpQuat);
        const yRotation = new THREE.Quaternion().setFromAxisAngle(up, -angle);
        return yRotation.multiply(faceUpQuat);
    }

    protected computeUprightAngle(
        faceValue: number,
        faceUpQuat: THREE.Quaternion,
    ): number {
        const stance = this.faceStance[faceValue];
        const verts = this.faceVertices[faceValue];

        const v1 = this.meshVertices[verts[stance]].clone().applyQuaternion(faceUpQuat);
        const v2 = this.meshVertices[verts[(stance + 1) % verts.length]]
            .clone()
            .applyQuaternion(faceUpQuat);

        const midX = (v1.x + v2.x) / 2;
        const midZ = (v1.z + v2.z) / 2;
        return Math.atan2(midX, midZ);
    }
}

export async function createDie<T extends Die>(
    DieClass: new (mesh: THREE.Mesh, physics: PhysicsDie) => T,
    dieScale: number,
    vertices: THREE.Vector3[],
    faces: DieFaces,
    texture: DieTexture,
    geometryCache: Map<number, THREE.BufferGeometry>,
    size: number,
    customTexture?: THREE.Texture,
    mass?: number,
    readDown = false,
): Promise<T> {
    const scale = size * dieScale;
    const scaledVertices = vertices.map((v) => v.clone().multiplyScalar(scale));

    let geometry = geometryCache.get(size);
    if (!geometry) {
        geometry = createChamferedGeometry(
            scaledVertices,
            faces,
            CHAMFER,
            (face) => texture.getFaceUV(face),
            (a, b) => texture.getStripUV(a, b),
            (crownFaces) => texture.getCrownUV(crownFaces),
        );
        geometryCache.set(size, geometry);
    }

    const material = new THREE.MeshPhysicalMaterial({
        map: customTexture ?? (await texture.createTexture()),
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createDieBody(scaledVertices, faces, mass, readDown);

    return new DieClass(mesh, physics);
}
