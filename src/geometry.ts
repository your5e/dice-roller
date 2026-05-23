import * as THREE from "three";

export const PHI = (1 + Math.sqrt(5)) / 2;
export const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function normalFromVertices(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
): THREE.Vector3 {
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    return new THREE.Vector3().crossVectors(ab, ac).normalize();
}

export function centroid(vertices: THREE.Vector3[]): THREE.Vector3 {
    const centre = new THREE.Vector3();
    for (const vertex of vertices) {
        centre.add(vertex);
    }
    return centre.divideScalar(vertices.length);
}

export function perpendicular(dx: number, dy: number): { x: number; y: number } {
    const len = Math.hypot(dx, dy);
    return { x: -dy / len, y: dx / len };
}

export function edgeAngle(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * RAD_TO_DEG;
}
