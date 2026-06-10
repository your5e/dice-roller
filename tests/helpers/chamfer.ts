import * as THREE from "three";
import {
    CHAMFER,
    createChamferedGeometry,
    type DieFaces,
} from "../../src/geometries/chamfer";
import { DEG_TO_RAD } from "../../src/geometry";

// Extract real surface pieces from the generated chamfered geometry, for
// tests that assert facts about what is actually built. Each piece's corners
// are labelled through the UV channel as the geometry is generated, then
// read back out of the buffer -- nothing is re-derived.

export type StripQuad = { faceA: number; faceB: number; corners: THREE.Vector3[] };
export type CrownCap = { vertex: number; faceOrder: number[]; corners: THREE.Vector3[] };

function faceSizer(faces: DieFaces) {
    return (value: number) => {
        const face = faces.find((f) => f.value === value);
        if (!face) throw new Error(`Unknown face ${value}`);
        return face.vertices.length;
    };
}

function readLabelled(geometry: THREE.BufferGeometry, corners: THREE.Vector3[][]) {
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
        const piece = uv.getX(i);
        if (piece < 0) continue;
        corners[piece][uv.getY(i)] = new THREE.Vector3(
            position.getX(i),
            position.getY(i),
            position.getZ(i),
        );
    }
}

export function generatedStrips(
    vertices: THREE.Vector3[],
    faces: DieFaces,
): StripQuad[] {
    const strips: StripQuad[] = [];
    const faceSize = faceSizer(faces);

    const geometry = createChamferedGeometry(
        vertices,
        faces,
        CHAMFER,
        (value) =>
            Array.from({ length: faceSize(value) }, () => ({ u: -1, v: -1 })),
        (faceA, faceB) => {
            const strip = strips.length;
            strips.push({ faceA, faceB, corners: [] });
            return [0, 1, 2, 3].map((corner) => ({ u: strip, v: corner }));
        },
        (faceValues) => faceValues.map(() => ({ u: -1, v: -1 })),
    );

    readLabelled(
        geometry,
        strips.map((s) => s.corners),
    );
    return strips;
}

export function generatedCrowns(
    vertices: THREE.Vector3[],
    faces: DieFaces,
): CrownCap[] {
    const crowns: CrownCap[] = [];
    const faceSize = faceSizer(faces);

    const geometry = createChamferedGeometry(
        vertices,
        faces,
        CHAMFER,
        (value) =>
            Array.from({ length: faceSize(value) }, () => ({ u: -1, v: -1 })),
        () => [0, 1, 2, 3].map(() => ({ u: -1, v: -1 })),
        (faceValues) => {
            const crown = crowns.length;
            crowns.push({ vertex: crown, faceOrder: faceValues, corners: [] });
            return faceValues.map((_, corner) => ({ u: crown, v: corner }));
        },
    );

    readLabelled(
        geometry,
        crowns.map((c) => c.corners),
    );
    return crowns;
}

// interior angle at each corner of a polygon, in degrees
export function cornerAngles(corners: THREE.Vector3[]): number[] {
    const n = corners.length;
    return corners.map((corner, i) => {
        const prev = corners[(i + n - 1) % n].clone().sub(corner);
        const next = corners[(i + 1) % n].clone().sub(corner);
        const cos = prev.dot(next) / (prev.length() * next.length());
        return Math.acos(cos) / DEG_TO_RAD;
    });
}
