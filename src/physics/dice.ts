import * as CANNON from "cannon-es";
import type { DieFaces } from "../geometries/chamfer";

export type PhysicsDie = {
    body: CANNON.Body;
    faces: DieFaces;
    readFace: () => number;
};

export function createDieBody(
    vertices: { x: number; y: number; z: number }[],
    faces: DieFaces,
): PhysicsDie {
    const cannonVerts = vertices.map((v) => new CANNON.Vec3(v.x, v.y, v.z));
    const cannonFaces = faces.map(([, indices]) => indices);

    const shape = new CANNON.ConvexPolyhedron({
        vertices: cannonVerts,
        faces: cannonFaces,
    });

    const body = new CANNON.Body({
        mass: 1,
        shape,
    });

    return {
        body,
        faces,
        readFace: () => readFaceUp(body, vertices, faces),
    };
}

function readFaceUp(
    body: CANNON.Body,
    vertices: { x: number; y: number; z: number }[],
    faces: DieFaces,
): number {
    const up = new CANNON.Vec3(0, 1, 0);
    let bestValue = faces[0][0];
    let bestDot = Number.NEGATIVE_INFINITY;

    for (const [value, indices] of faces) {
        const normal = computeFaceNormal(vertices, indices);
        const worldNormal = body.quaternion.vmult(normal);
        const dot = worldNormal.dot(up);
        if (dot > bestDot) {
            bestDot = dot;
            bestValue = value;
        }
    }

    return bestValue;
}

function computeFaceNormal(
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
