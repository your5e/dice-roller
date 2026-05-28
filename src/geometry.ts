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

export function pointInPolygon(
    point: { x: number; y: number },
    polygon: { x: number; y: number }[],
): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        if (
            yi > point.y !== yj > point.y &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
        ) {
            inside = !inside;
        }
    }
    return inside;
}

export function findSharedVertex<T>(
    vertices: T[],
    edgeIdx1: number,
    edgeIdx2: number,
): T | null {
    const n = vertices.length;
    const verts1 = [edgeIdx1, (edgeIdx1 + 1) % n];
    const verts2 = [edgeIdx2, (edgeIdx2 + 1) % n];
    for (const v of verts1) {
        if (verts2.includes(v)) {
            return vertices[v];
        }
    }
    return null;
}
