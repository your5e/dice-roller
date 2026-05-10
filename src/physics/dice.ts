import * as CANNON from "cannon-es";
import type { DieFaces } from "../geometries/chamfer";
import { normalFromFace } from "../geometry";
import { diceMaterial } from "./tray";

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
    const cannonFaces = faces.map((face) => face.vertices);

    const shape = new CANNON.ConvexPolyhedron({
        vertices: cannonVerts,
        faces: cannonFaces,
    });

    const body = new CANNON.Body({
        mass: 1,
        shape,
        material: diceMaterial,
        linearDamping: 0.3, // scale: 0 = vacuum, 0.3 = air, 1.0 = honey
        angularDamping: 0.3,
        allowSleep: true,
        sleepSpeedLimit: 0.05,
        sleepTimeLimit: 0.1,
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
    let bestValue = faces[0].value;
    let bestDot = Number.NEGATIVE_INFINITY;

    for (const face of faces) {
        const normal = normalFromFace(vertices, face.vertices);
        const worldNormal = body.quaternion.vmult(normal);
        const dot = worldNormal.dot(up);
        if (dot > bestDot) {
            bestDot = dot;
            bestValue = face.value;
        }
    }

    return bestValue;
}
