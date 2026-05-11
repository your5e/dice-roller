import * as THREE from "three";
import type { PhysicsDie } from "../physics/dice";

export abstract class Die {
    constructor(
        public mesh: THREE.Mesh,
        public physics: PhysicsDie,
    ) {}

    protected abstract faceVertices: Record<number, number[]>;
    protected abstract meshVertices: THREE.Vector3[];
    protected abstract faceBottomEdge: Record<number, number>;

    protected abstract getFaceRotation(faceValue: number): number;

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

        const bottomEdge2D = this.faceBottomEdge[faceValue];
        const verts = this.faceVertices[faceValue];
        const rotation = this.getFaceRotation(faceValue);
        const bottomEdge3D = (bottomEdge2D - rotation + verts.length) % verts.length;

        const v1 = this.meshVertices[verts[bottomEdge3D]]
            .clone()
            .applyQuaternion(faceUpQuat);
        const v2 = this.meshVertices[verts[(bottomEdge3D + 1) % verts.length]]
            .clone()
            .applyQuaternion(faceUpQuat);

        const midX = (v1.x + v2.x) / 2;
        const midZ = (v1.z + v2.z) / 2;
        const angle = Math.atan2(midX, midZ);

        const yRotation = new THREE.Quaternion().setFromAxisAngle(up, -angle);
        return yRotation.multiply(faceUpQuat);
    }
}
