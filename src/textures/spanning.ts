import { DEG_TO_RAD } from "../geometry";
import { clipToCrown, clipToFace, clipToStrip } from "./clip";
import type { DieTexture, Point } from "./dice";
import type { UnfoldableTexture, UnfoldData } from "./unfold";

export function adjacentFacePlacement(
    texture: UnfoldableTexture,
    baseFace: number,
    adjFace: number,
): UnfoldData {
    const baseFaceLayout = texture.faceLayout.get(baseFace);
    if (!baseFaceLayout) {
        throw new Error(`No layout for face ${baseFace}`);
    }

    const sharedEdgeOnBase = texture.get2DEdgeIndex(baseFace, adjFace);
    const sharedEdgeOnAdjacent = texture.get2DEdgeIndex(adjFace, baseFace);

    // the adjacent face is flipped 180 across the shared edge...
    const adjacentFaceRotation =
        180 +
        baseFaceLayout.rotation +
        texture.localEdgeAngle(sharedEdgeOnBase) -
        texture.localEdgeAngle(sharedEdgeOnAdjacent);

    // ...and placed the bevel's end vector out from the base face
    const adjacentEdgeStartPoint = texture.adjacentAnchor(baseFace, adjFace);
    const adjacentFaceCentre = texture.centreFromAnchor(
        sharedEdgeOnAdjacent,
        adjacentFaceRotation,
        adjacentEdgeStartPoint,
    );

    return {
        centre: adjacentFaceCentre,
        rotation: adjacentFaceRotation,
    };
}

// translate a point from one face's coordinate system to another's
export function translateFacePoint(
    texture: UnfoldableTexture,
    point: Point,
    fromFace: number,
    toFace: number,
): Point {
    const actualLayout = texture.faceLayout.get(fromFace);
    if (!actualLayout) {
        throw new Error(`No layout for face ${fromFace}`);
    }

    const placement = adjacentFacePlacement(texture, toFace, fromFace);

    // transform: actual -> origin -> virtual
    const dx = point.x - actualLayout.centre.x;
    const dy = point.y - actualLayout.centre.y;

    const deltaRotation = (placement.rotation - actualLayout.rotation) * DEG_TO_RAD;
    const cos = Math.cos(deltaRotation);
    const sin = Math.sin(deltaRotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    return {
        x: placement.centre.x + rx,
        y: placement.centre.y + ry,
    };
}

export function translateThroughFaces(
    texture: UnfoldableTexture & DieTexture,
    point: Point,
    fromFace: number,
    toFace: number,
): { point: Point; rotation: number } {
    if (fromFace === toFace) return { point, rotation: 0 };

    const faceData = texture.faceData.get(fromFace);
    if (!faceData) throw new Error(`No face data for face ${fromFace}`);

    const path = faceData.paths[toFace];
    if (!path) throw new Error(`No path from face ${fromFace} to face ${toFace}`);

    let current = point;
    let totalRotation = 0;

    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];

        const actualLayout = texture.faceLayout.get(from);
        if (!actualLayout) throw new Error(`No layout for face ${from}`);

        const placement = adjacentFacePlacement(texture, to, from);
        const deltaRotation = placement.rotation - actualLayout.rotation;
        totalRotation += deltaRotation;

        current = translateFacePoint(texture, current, from, to);
    }

    return { point: current, rotation: totalRotation };
}

export function drawAt(
    ctx: CanvasRenderingContext2D,
    texture: UnfoldableTexture & DieTexture,
    originFace: number,
    originPoint: Point,
    callback: (ctx: CanvasRenderingContext2D) => void,
): void {
    for (const [face] of texture.faceData) {
        clipToFace(ctx, texture, face, () => {
            const { point, rotation } = translateThroughFaces(
                texture,
                originPoint,
                originFace,
                face,
            );
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(rotation * DEG_TO_RAD);
            callback(ctx);
            ctx.restore();
        });
    }

    for (const [key, data] of texture.stripData) {
        clipToStrip(ctx, texture, key, () => {
            const { point, rotation } = translateThroughFaces(
                texture,
                originPoint,
                originFace,
                data.owner,
            );
            ctx.save();
            ctx.translate(point.x, point.y);
            ctx.rotate(rotation * DEG_TO_RAD);
            callback(ctx);
            ctx.restore();
        });
    }

    for (const [vertex, data] of texture.crownData) {
        if (!data.faceOrder || data.faceOrder.length === 0) continue;

        const faceOrder = data.faceOrder;
        const ownerFace = faceOrder[0];
        const n = faceOrder.length;

        const originIndex = faceOrder.indexOf(originFace);
        if (originIndex === -1) continue;

        clipToCrown(ctx, texture, vertex, () => {
            const { point, rotation } = translateThroughFaces(
                texture,
                originPoint,
                originFace,
                ownerFace,
            );

            // calculate each face's corner angle at the vertex
            const faceAngles3D: number[] = [];
            for (const face of faceOrder) {
                const verts = texture.faceVertices[face];
                const vi = verts.indexOf(vertex);
                const pv = verts[(vi - 1 + verts.length) % verts.length];
                const nv = verts[(vi + 1) % verts.length];
                const c = texture.vertices[vertex];
                const p = texture.vertices[pv];
                const nx = texture.vertices[nv];
                const e1 = { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z };
                const e2 = { x: nx.x - c.x, y: nx.y - c.y, z: nx.z - c.z };
                const d = e1.x * e2.x + e1.y * e2.y + e1.z * e2.z;
                const m1 = Math.hypot(e1.x, e1.y, e1.z);
                const m2 = Math.hypot(e2.x, e2.y, e2.z);
                faceAngles3D.push(Math.acos(d / (m1 * m2)) / DEG_TO_RAD);
            }

            // around the gap at each crown corner sits the face's corner
            // angle, the ends of its two strips, and the crown's own interior
            // angle; so whatever remains of 360° is the correction
            const vertexCorrections = faceAngles3D.map((a, i) => {
                const face = faceOrder[i];
                const prevFace = faceOrder[(i - 1 + n) % n];
                const nextFace = faceOrder[(i + 1) % n];
                return (
                    360 -
                    a -
                    data.angles[i] -
                    texture.bevelEndAngle(face, prevFace, vertex) -
                    texture.bevelEndAngle(face, nextFace, vertex)
                );
            });

            // determine direction based on face path
            const originData = texture.faceData.get(originFace);
            const pathToOwner = originData?.paths[ownerFace] ?? [];
            let forwards: boolean;
            if (pathToOwner.length >= 2) {
                const firstStep = pathToOwner[1];
                const firstStepIdx = faceOrder.indexOf(firstStep);
                const forwardNeighbour = (originIndex - 1 + n) % n;
                forwards = firstStepIdx === forwardNeighbour;
            } else {
                forwards = originIndex <= n - originIndex;
            }

            const steps = forwards ? originIndex : n - originIndex;
            const sign = forwards ? -1 : +1;
            let currentPoint = point;
            let totalCorrection = 0;

            for (let step = 0; step < steps; step++) {
                const fromIdx = forwards ? step : (n - step) % n;
                const toIdx = forwards ? step + 1 : (n - step - 1 + n) % n;

                // first pivot around the origin vertex:
                //  "flattens" the crown against the strip
                let correction = (sign * vertexCorrections[fromIdx] * DEG_TO_RAD) / 2;
                let pivot = data.points[fromIdx];
                let angle = Math.atan2(
                    currentPoint.y - pivot.y,
                    currentPoint.x - pivot.x,
                );
                let dist = Math.hypot(
                    currentPoint.x - pivot.x,
                    currentPoint.y - pivot.y,
                );

                currentPoint = {
                    x: pivot.x + dist * Math.cos(angle + correction),
                    y: pivot.y + dist * Math.sin(angle + correction),
                };

                // second pivot around the destination vertex:
                // "lifts" the crown back to being perpendicular
                correction = (sign * vertexCorrections[toIdx] * DEG_TO_RAD) / 2;
                pivot = data.points[toIdx];
                angle = Math.atan2(currentPoint.y - pivot.y, currentPoint.x - pivot.x);
                dist = Math.hypot(currentPoint.x - pivot.x, currentPoint.y - pivot.y);

                currentPoint = {
                    x: pivot.x + dist * Math.cos(angle + correction),
                    y: pivot.y + dist * Math.sin(angle + correction),
                };

                totalCorrection +=
                    (sign * (vertexCorrections[fromIdx] + vertexCorrections[toIdx])) /
                    2;
            }

            ctx.save();
            ctx.translate(currentPoint.x, currentPoint.y);
            ctx.rotate((rotation + totalCorrection) * DEG_TO_RAD);
            callback(ctx);
            ctx.restore();
        });
    }
}

export function shortestPathTree(
    texture: UnfoldableTexture & DieTexture,
    from: number,
): Map<number, number> {
    // build adjacency from strip keys
    const adjacency = new Map<number, Set<number>>();
    for (const key of texture.stripData.keys()) {
        const [a, b] = key.split(",").map(Number);
        const setA = adjacency.get(a) ?? new Set<number>();
        setA.add(b);
        adjacency.set(a, setA);
        const setB = adjacency.get(b) ?? new Set<number>();
        setB.add(a);
        adjacency.set(b, setB);
    }

    // breadth-first search
    const visited = new Set<number>([from]);
    const parent = new Map<number, number>();
    const queue = [from];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;

        for (const neighbour of adjacency.get(current) ?? []) {
            if (!visited.has(neighbour)) {
                visited.add(neighbour);
                parent.set(neighbour, current);
                queue.push(neighbour);
            }
        }
    }

    return parent;
}

export function reconstructPath(parent: Map<number, number>, to: number): number[] {
    const path: number[] = [];
    let current: number | undefined = to;
    while (current !== undefined) {
        path.unshift(current);
        current = parent.get(current);
    }

    return path;
}

export function pathBetweenFaces(
    texture: UnfoldableTexture & DieTexture,
    from: number,
    to: number,
): number[] {
    return reconstructPath(shortestPathTree(texture, from), to);
}
