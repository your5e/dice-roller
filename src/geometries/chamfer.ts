import * as THREE from "three";
import { normalFromPoints } from "../geometry";

export type DieFaces = [value: number, vertices: number[]][];

/**
 * Vertex-centric chamfering: split each vertex into N positions (one per
 * adjacent face), creating corner polygons. Then connect them with the
 * shrunken faces and edge strips.
 */
export function createChamferedGeometry(
    baseVertices: THREE.Vector3[],
    baseFaces: DieFaces,
    chamfer: number,
): THREE.BufferGeometry {
    // STEP ZERO -- what is needed to build the BufferGeometry arguments at the end
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    function addPolygon(verts: THREE.Vector3[]) {
        const startVertex = positions.length / 3;
        const normal = normalFromPoints(verts[0], verts[1], verts[2]);
        for (const v of verts) {
            positions.push(v.x, v.y, v.z);
            normals.push(normal.x, normal.y, normal.z);
        }
        for (let i = 1; i < verts.length - 1; i++) {
            indices.push(startVertex, startVertex + i, startVertex + i + 1);
        }
    }

    // STEP ONE -- split each vertex into its chamfered position
    const newFaces: THREE.Vector3[][] = baseFaces.map(() => []);

    for (let vertex = 0; vertex < baseVertices.length; vertex++) {
        // find faces touching this vertex
        const touchingFaces = baseFaces
            .map((_, i) => i)
            .filter((i) => baseFaces[i][1].includes(vertex));

        // order those faces so neighbours are grouped together
        // so the corner polygon comes out right
        const orderedFaces: number[] = [];
        const remaining = new Set(touchingFaces);
        let currentFace = touchingFaces[0];

        while (remaining.size > 0) {
            remaining.delete(currentFace);
            orderedFaces.push(currentFace);

            const faceVerts = baseFaces[currentFace][1];
            for (const face of remaining) {
                if (
                    faceVerts.some(
                        (v) => v !== vertex && baseFaces[face][1].includes(v),
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
            const faceVerts = baseFaces[face][1];
            const centre = centroid(faceVerts.map((v) => baseVertices[v]));
            const pos = baseVertices[vertex].clone().lerp(centre, chamfer);
            cornerVerts.push(pos);
            newFaces[face][faceVerts.indexOf(vertex)] = pos;
        }

        // create the corner polygon
        const normal = normalFromPoints(cornerVerts[0], cornerVerts[1], cornerVerts[2]);
        if (normal.dot(baseVertices[vertex]) < 0) {
            cornerVerts.reverse();
        }
        addPolygon(cornerVerts);
    }

    // STEP TWO -- add the now-shrunken faces
    for (const faceVerts of newFaces) {
        addPolygon(faceVerts);
    }

    // STEP THREE -- fill in the remaining strips between the adjacent faces
    for (let face = 0; face < baseFaces.length; face++) {
        for (let nextFace = face + 1; nextFace < baseFaces.length; nextFace++) {
            const [, vertices] = baseFaces[face];
            const [, nextVertices] = baseFaces[nextFace];

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

            addPolygon([
                newFaces[nextFace][nextVertices.indexOf(edgeStart)],
                newFaces[nextFace][nextVertices.indexOf(edgeEnd)],
                newFaces[face][vertices.indexOf(edgeEnd)],
                newFaces[face][vertices.indexOf(edgeStart)],
            ]);
        }
    }

    // STEP FOUR -- create the geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
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
