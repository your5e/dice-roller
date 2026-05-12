import * as THREE from "three";
import { type PhysicsDie, createDieBody } from "../physics/dice";
import type { DieTexture } from "../textures/dice";
import { CHAMFER, type DieFaces, createChamferedGeometry } from "./chamfer";

export abstract class Die {
    constructor(
        public mesh: THREE.Mesh,
        public physics: PhysicsDie,
        protected texture: { get2DStartIndex(face: number): number },
    ) {}

    protected abstract faceVertices: Record<number, number[]>;
    protected abstract meshVertices: THREE.Vector3[];
    protected abstract faceStance: Record<number, number>;

    private computeFaceNormal(faceValue: number): THREE.Vector3 {
        const verts = this.faceVertices[faceValue];
        const a = this.meshVertices[verts[0]];
        const b = this.meshVertices[verts[1]];
        const c = this.meshVertices[verts[2]];

        const ab = new THREE.Vector3().subVectors(b, a);
        const ac = new THREE.Vector3().subVectors(c, a);
        return new THREE.Vector3().crossVectors(ab, ac).normalize();
    }

    abstract defaultOrientation(): THREE.Quaternion;

    orientToFace(faceValue: number): THREE.Quaternion {
        const normal = this.computeFaceNormal(faceValue);
        const up = new THREE.Vector3(0, 1, 0);
        const faceUpQuat = new THREE.Quaternion().setFromUnitVectors(normal, up);

        const stance2D = this.faceStance[faceValue];
        const verts = this.faceVertices[faceValue];
        const startIndex = this.texture.get2DStartIndex(faceValue);
        const stance3D = (stance2D - startIndex + verts.length) % verts.length;

        const v1 = this.meshVertices[verts[stance3D]]
            .clone()
            .applyQuaternion(faceUpQuat);
        const v2 = this.meshVertices[verts[(stance3D + 1) % verts.length]]
            .clone()
            .applyQuaternion(faceUpQuat);

        const midX = (v1.x + v2.x) / 2;
        const midZ = (v1.z + v2.z) / 2;
        const angle = Math.atan2(midX, midZ);

        const yRotation = new THREE.Quaternion().setFromAxisAngle(up, -angle);
        return yRotation.multiply(faceUpQuat);
    }
}

export async function createDie<T extends Die>(
    DieClass: new (mesh: THREE.Mesh, physics: PhysicsDie, texture: DieTexture) => T,
    dieScale: number,
    vertices: THREE.Vector3[],
    faces: DieFaces,
    texture: DieTexture,
    geometryCache: Map<number, THREE.BufferGeometry>,
    size: number,
    customTexture?: THREE.Texture,
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

    const physics = createDieBody(scaledVertices, faces);

    return new DieClass(mesh, physics, texture);
}
