import * as THREE from "three";
import { FACES, FACE_BOTTOM_EDGE, FACE_VERTICES, VERTICES } from "../bodies/d20";
import { createDieBody } from "../physics/dice";
import { D20Texture } from "../textures/d20";
import { createChamferedGeometry } from "./chamfer";
import { Die } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const d20Texture = new D20Texture();

export class D20 extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceBottomEdge = FACE_BOTTOM_EDGE;

    protected getFaceRotation(faceValue: number): number {
        return d20Texture.getFaceRotation(faceValue);
    }

    defaultOrientation(): THREE.Quaternion {
        const northPole = VERTICES[0].clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        return new THREE.Quaternion().setFromUnitVectors(northPole, up);
    }
}

export async function createD20(size = 0.5, texture?: THREE.Texture): Promise<D20> {
    const scale = size / 2;
    const chamfer = 0.05;
    const vertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));

    let geometry = geometryCache.get(size);
    if (!geometry) {
        geometry = createChamferedGeometry(
            vertices,
            FACES,
            chamfer,
            (face) => d20Texture.getFaceUV(face),
            (a, b) => d20Texture.getEdgeUV(a, b),
            (faces) => d20Texture.getCornerUV(faces),
        );
        geometryCache.set(size, geometry);
    }

    const material = new THREE.MeshPhysicalMaterial({
        map: texture ?? (await d20Texture.createTexture()),
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createDieBody(vertices, FACES);

    return new D20(mesh, physics);
}
