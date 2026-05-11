import * as THREE from "three";
import { normalFromPoints } from "../geometry";

export const CHAMFER = 0.05;

export type DieFaces = {
    value: number;
    vertices: number[];
    bottomEdge: number;
}[];

export type UV = { u: number; v: number };
export type FaceUVMapper = (faceValue: number) => UV[];
export type EdgeUVMapper = (faceA: number, faceB: number) => UV[];
export type CornerUVMapper = (faces: number[]) => UV[];

/**
 * Vertex-centric chamfering: split each vertex into N positions (one per
 * adjacent face), creating corner polygons. Then connect them with the
 * shrunken faces and edge strips.
 */
export function createChamferedGeometry(
    baseVertices: THREE.Vector3[],
    baseFaces: DieFaces,
    chamfer: number,
    getFaceUV?: FaceUVMapper,
    getEdgeUV?: EdgeUVMapper,
    getCornerUV?: CornerUVMapper,
): THREE.BufferGeometry {
    // STEP ZERO -- what is needed to build the BufferGeometry arguments at the end
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    function addPolygon(verts: THREE.Vector3[], polyUVs?: UV[]) {
        const startVertex = positions.length / 3;
        const normal = normalFromPoints(verts[0], verts[1], verts[2]);
        for (let i = 0; i < verts.length; i++) {
            const v = verts[i];
            positions.push(v.x, v.y, v.z);
            normals.push(normal.x, normal.y, normal.z);
            if (polyUVs) {
                uvs.push(polyUVs[i].u, polyUVs[i].v);
            }
        }
        for (let i = 1; i < verts.length - 1; i++) {
            indices.push(startVertex, startVertex + i, startVertex + i + 1);
        }
    }

    // STEP ONE -- split each vertex into its chamfered position
    const newFaces: THREE.Vector3[][] = baseFaces.map(() => []);
    const orderedFacesPerVertex: number[][] = [];

    for (let vertex = 0; vertex < baseVertices.length; vertex++) {
        // find faces touching this vertex
        const touchingFaces = baseFaces
            .map((_, i) => i)
            .filter((i) => baseFaces[i].vertices.includes(vertex));

        // order those faces so neighbours are grouped together
        // so the corner polygon comes out right
        const orderedFaces: number[] = [];
        const remaining = new Set(touchingFaces);
        let currentFace = touchingFaces[0];

        while (remaining.size > 0) {
            remaining.delete(currentFace);
            orderedFaces.push(currentFace);

            const faceVerts = baseFaces[currentFace].vertices;
            for (const face of remaining) {
                if (
                    faceVerts.some(
                        (v) => v !== vertex && baseFaces[face].vertices.includes(v),
                    )
                ) {
                    currentFace = face;
                    break;
                }
            }
        }

        // split the vertex
        const cornerVerts: THREE.Vector3[] = [];

        for (const face of orderedFaces) {
            const faceVerts = baseFaces[face].vertices;
            const centre = centroid(faceVerts.map((v) => baseVertices[v]));
            const pos = baseVertices[vertex].clone().lerp(centre, chamfer);
            cornerVerts.push(pos);
            newFaces[face][faceVerts.indexOf(vertex)] = pos;
        }

        // create the corner polygon
        const normal = normalFromPoints(cornerVerts[0], cornerVerts[1], cornerVerts[2]);
        if (normal.dot(baseVertices[vertex]) < 0) {
            cornerVerts.reverse();
            orderedFaces.reverse();
        }

        orderedFacesPerVertex.push(orderedFaces);

        const faceValues = orderedFaces.map((f) => baseFaces[f].value);
        const cornerUVs = getCornerUV?.(faceValues);
        addPolygon(cornerVerts, cornerUVs);
    }

    // STEP TWO -- add the now-shrunken faces
    for (let faceIndex = 0; faceIndex < newFaces.length; faceIndex++) {
        const faceVerts = newFaces[faceIndex];
        const faceValue = baseFaces[faceIndex].value;
        const faceUVs = getFaceUV?.(faceValue);
        addPolygon(faceVerts, faceUVs);
    }

    // STEP THREE -- fill in the remaining strips between the adjacent faces
    for (let face = 0; face < baseFaces.length; face++) {
        for (let nextFace = face + 1; nextFace < baseFaces.length; nextFace++) {
            const vertices = baseFaces[face].vertices;
            const nextVertices = baseFaces[nextFace].vertices;
            const faceValue = baseFaces[face].value;
            const nextFaceValue = baseFaces[nextFace].value;

            // only adjacent faces need a strip between them
            const shared = vertices.filter((v) => nextVertices.includes(v));
            if (shared.length !== 2) {
                continue;
            }

            // order edge vertices so the strip faces outward
            const [first, second] = shared;
            const firstIndex = vertices.indexOf(first);
            const secondIndex = vertices.indexOf(second);
            const nextIndex = (firstIndex + 1) % vertices.length;
            let edgeStart: number;
            let edgeEnd: number;
            if (nextIndex === secondIndex) {
                edgeStart = first;
                edgeEnd = second;
            } else {
                edgeStart = second;
                edgeEnd = first;
            }

            const edgeVerts = [
                newFaces[nextFace][nextVertices.indexOf(edgeStart)],
                newFaces[nextFace][nextVertices.indexOf(edgeEnd)],
                newFaces[face][vertices.indexOf(edgeEnd)],
                newFaces[face][vertices.indexOf(edgeStart)],
            ];

            const edgeUVs = getEdgeUV?.(faceValue, nextFaceValue);
            addPolygon(edgeVerts, edgeUVs);
        }
    }

    // STEP FOUR -- create the geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    if (uvs.length > 0) {
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    }
    geometry.setIndex(indices);
    return geometry;
}

function centroid(points: THREE.Vector3[]): THREE.Vector3 {
    const centre = new THREE.Vector3();
    for (const point of points) {
        centre.add(point);
    }
    return centre.divideScalar(points.length);
}
