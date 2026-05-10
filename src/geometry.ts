import * as CANNON from "cannon-es";
import * as THREE from "three";

export const PHI = (1 + Math.sqrt(5)) / 2;

export function normalFromPoints(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
): THREE.Vector3 {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    return new THREE.Vector3().crossVectors(ab, ac).normalize();
}

export function normalFromFace(
    vertices: { x: number; y: number; z: number }[],
    indices: number[],
): CANNON.Vec3 {
    const a = vertices[indices[0]];
    const b = vertices[indices[1]];
    const c = vertices[indices[2]];

    const ab = new CANNON.Vec3(b.x - a.x, b.y - a.y, b.z - a.z);
    const ac = new CANNON.Vec3(c.x - a.x, c.y - a.y, c.z - a.z);

    const normal = new CANNON.Vec3();
    ab.cross(ac, normal);
    normal.normalize();

    return normal;
}
