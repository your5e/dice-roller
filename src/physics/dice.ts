import * as CANNON from "cannon-es";
import type * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";
import { normalFromVertices } from "../geometry";
import { diceMaterial } from "./tray";

export type DiceConfig = {
    mass: number;
    linearDamping: number;
    angularDamping: number;
    sleepSpeedLimit: number;
    sleepTimeLimit: number;
};

export const DEFAULT_DICE_CONFIG: DiceConfig = {
    mass: 10,

    // stop the rolling without making it feel like glue
    linearDamping: 0.5,
    angularDamping: 0.9,

    // do not jiggle endlessly when landing on or against something
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 0.05,
};

export type PhysicsDie = {
    body: CANNON.Body;
    faces: DieFaces;
    readFace: () => number;
    isCocked: (threshold: number) => boolean;
    liftProgress: number;
};

export function createDieBody(
    vertices: THREE.Vector3[],
    faces: DieFaces,
    config: DiceConfig = DEFAULT_DICE_CONFIG,
    readDown = false,
): PhysicsDie {
    const cannonVerts = vertices.map((v) => new CANNON.Vec3(v.x, v.y, v.z));
    const cannonFaces = faces.map((face) => face.vertices);

    const shape = new CANNON.ConvexPolyhedron({
        vertices: cannonVerts,
        faces: cannonFaces,
    });

    const body = new CANNON.Body({
        mass: config.mass,
        shape,
        material: diceMaterial,
        linearDamping: config.linearDamping,
        angularDamping: config.angularDamping,
        allowSleep: true,
        sleepSpeedLimit: config.sleepSpeedLimit,
        sleepTimeLimit: config.sleepTimeLimit,
    });

    return {
        body,
        faces,
        readFace: () => findTopFace(body, vertices, faces, readDown).value,
        isCocked: (threshold: number) =>
            findTopFace(body, vertices, faces, readDown).dot < threshold,
        liftProgress: 0,
    };
}

function findTopFace(
    body: CANNON.Body,
    vertices: THREE.Vector3[],
    faces: DieFaces,
    readDown = false,
): { value: number; dot: number } {
    const up = new CANNON.Vec3(0, readDown ? -1 : 1, 0);
    let bestValue = faces[0].value;
    let bestDot = Number.NEGATIVE_INFINITY;

    for (const face of faces) {
        const verts = face.vertices;
        const threeNormal = normalFromVertices(
            vertices[verts[0]],
            vertices[verts[1]],
            vertices[verts[2]],
        );
        const normal = new CANNON.Vec3(threeNormal.x, threeNormal.y, threeNormal.z);
        const worldNormal = body.quaternion.vmult(normal);
        const dot = worldNormal.dot(up);
        if (dot > bestDot) {
            bestDot = dot;
            bestValue = face.value;
        }
    }

    return { value: bestValue, dot: bestDot };
}
