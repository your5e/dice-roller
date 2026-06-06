import * as THREE from "three";
import { CHAMFER, type DieFaces } from "../geometries/chamfer";
import {
    centroid,
    DEG_TO_RAD,
    edgeAngle,
    normalFromVertices,
    perpendicular,
} from "../geometry";
import { drawIcon } from "../icons";
import type { DieTexture, FaceData, Point } from "./dice";

export type UnfoldData = { centre: Point; rotation: number };

// biome-ignore lint/suspicious/noExplicitAny: mixin constructor pattern
export function Unfoldable<T extends abstract new (...args: any[]) => DieTexture>(
    Base: T,
) {
    // given the set of vertices and faces for a die polyhedron, unfold it to a 2D
    // shape for creating the canvas image that decorates the die
    abstract class UnfoldableMixin extends Base {
        faces!: DieFaces;
        vertices!: THREE.Vector3[];
        placeReverse = true;

        // the vertex the die "sits on" for latitude calculation
        get balanceVertex(): number {
            return this.vertices.length - 1;
        }

        // the vertex at the "top" -- if set, tilts the axis toward this vertex
        get oppositeVertex(): number | null {
            return null;
        }

        _latitudeAxis: THREE.Vector3 | null = null;
        _latitudeMin = 0;
        _latitudeMax = 1;

        get latitudeAxis(): THREE.Vector3 {
            if (!this._latitudeAxis) {
                this.computeLatitudeBounds();
            }
            if (!this._latitudeAxis) {
                throw new Error("latitudeAxis not computed");
            }
            return this._latitudeAxis;
        }

        get latitudeMin(): number {
            if (!this._latitudeAxis) {
                this.computeLatitudeBounds();
            }
            return this._latitudeMin;
        }

        get latitudeMax(): number {
            if (!this._latitudeAxis) {
                this.computeLatitudeBounds();
            }
            return this._latitudeMax;
        }

        computeLatitudeBounds(): void {
            const balancePos = this.vertices[this.balanceVertex];

            if (this.oppositeVertex !== null) {
                // axis points from balance vertex toward opposite vertex
                const oppositePos = this.vertices[this.oppositeVertex];
                this._latitudeAxis = oppositePos.clone().sub(balancePos).normalize();
            } else {
                // axis points away from the balance vertex (toward the "top")
                this._latitudeAxis = balancePos.clone().normalize().negate();
            }

            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            for (const v of this.vertices) {
                const projection = v.dot(this._latitudeAxis);
                min = Math.min(min, projection);
                max = Math.max(max, projection);
            }
            this._latitudeMin = min;
            this._latitudeMax = max;
        }

        latitude(pos: THREE.Vector3): number {
            const projection = pos.dot(this.latitudeAxis);
            return (
                (projection - this.latitudeMin) / (this.latitudeMax - this.latitudeMin)
            );
        }

        _faceShape: Point[] | null = null;
        get faceShape(): Point[] {
            if (!this._faceShape) {
                this._faceShape = this.derivefaceShape(
                    this.vertices,
                    this.faces[0].vertices,
                );
            }
            return this._faceShape;
        }

        derivefaceShape(vertices: THREE.Vector3[], faceVerts: number[]): Point[] {
            const pts3D = faceVerts.map((i) => vertices[i]);

            if (pts3D.length < 3) {
                throw new Error(`Face has ${pts3D.length} vertices, need at least 3`);
            }

            const normal = normalFromVertices(pts3D[0], pts3D[1], pts3D[2]);

            // rotate the face so it points up, projecting it onto the XZ plane
            const up = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(normal, up);
            const flat = pts3D.map((p) => p.clone().applyQuaternion(quat));

            // then convert to 2D points that wind around the centre of the face
            const centreX = flat.reduce((s, p) => s + p.x, 0) / flat.length;
            const centreZ = flat.reduce((s, p) => s + p.z, 0) / flat.length;
            const pts2D = flat.map((p) => ({ x: p.x - centreX, y: p.z - centreZ }));

            // and rotate so that the first edge is drawn horizontal
            const mid = {
                x: (pts2D[0].x + pts2D[1].x) / 2,
                y: (pts2D[0].y + pts2D[1].y) / 2,
            };
            const angle = edgeAngle({ x: 0, y: 0 }, mid) * DEG_TO_RAD;

            return pts2D.map((pt) => ({
                x:
                    pt.x * Math.cos(Math.PI / 2 - angle) -
                    pt.y * Math.sin(Math.PI / 2 - angle),
                y:
                    pt.x * Math.sin(Math.PI / 2 - angle) +
                    pt.y * Math.cos(Math.PI / 2 - angle),
            }));
        }

        getFaceHeight(): number {
            const yEdge = (this.faceShape[0].y + this.faceShape[1].y) / 2;
            return Math.max(...this.faceShape.map((p) => Math.abs(p.y - yEdge)));
        }

        get scale(): number {
            return this.pixelDensity;
        }

        faceLayout = new Map<number, UnfoldData>();

        get startRotation(): number {
            return 0;
        }

        getFacePoints(centre: Point, rotation: number): Point[] {
            const rad = rotation * DEG_TO_RAD;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            return this.faceShape.map((p) => ({
                x: centre.x + p.x * this.scale * cos - p.y * this.scale * sin,
                y: centre.y + p.x * this.scale * sin + p.y * this.scale * cos,
            }));
        }

        getScaledLocalVertex(idx: number): Point {
            const p = this.faceShape[idx];
            return { x: p.x * this.scale, y: p.y * this.scale };
        }

        get2DEdgeIndex(face: number, adjFace: number): number {
            const n = this.faces[0].vertices.length;
            const faceData = this.faces.find((f) => f.value === face);
            const adjData = this.faces.find((f) => f.value === adjFace);
            if (!faceData || !adjData) {
                throw new Error(`Unknown face ${face} or ${adjFace}`);
            }

            for (let i = 0; i < n; i++) {
                const v1 = faceData.vertices[i];
                const v2 = faceData.vertices[(i + 1) % n];
                if (adjData.vertices.includes(v1) && adjData.vertices.includes(v2)) {
                    return i;
                }
            }
            throw new Error(`Faces ${face} and ${adjFace} do not share an edge`);
        }

        placeAdjacent(baseFace: number, adjFace: number): void {
            const baseFaceLayout = this.faceLayout.get(baseFace);
            if (!baseFaceLayout) {
                throw new Error(`No layout for face ${baseFace}`);
            }

            // find the shared edge
            const sharedEdgeOnBase = this.get2DEdgeIndex(baseFace, adjFace);
            const sharedEdgeOnAdjacent = this.get2DEdgeIndex(adjFace, baseFace);

            // the adjacent face will be placed flipped 180 across the shared
            // edge...
            const adjacentFaceRotation =
                180 +
                baseFaceLayout.rotation +
                this.localEdgeAngle(sharedEdgeOnBase) -
                this.localEdgeAngle(sharedEdgeOnAdjacent);
            // ...and placed one stripWidth out from the current face
            const adjacentEdgeStartPoint = this.outwardPerpendicular(
                baseFaceLayout,
                sharedEdgeOnBase,
            );

            const adjacentFaceCentre = this.centreFromAnchor(
                sharedEdgeOnAdjacent,
                adjacentFaceRotation,
                adjacentEdgeStartPoint,
            );

            this.faceLayout.set(adjFace, {
                centre: adjacentFaceCentre,
                rotation: adjacentFaceRotation,
            });
        }

        localEdgeAngle(edgeIndex: number): number {
            const n = this.faces[0].vertices.length;
            return edgeAngle(
                this.faceShape[edgeIndex],
                this.faceShape[(edgeIndex + 1) % n],
            );
        }

        // step from the base edge perpendicularly outward by stripWidth
        outwardPerpendicular(layout: UnfoldData, hingeEdgeIndex: number): Point {
            const n = this.faces[0].vertices.length;
            const pts = this.getFacePoints(layout.centre, layout.rotation);
            const a = pts[hingeEdgeIndex];
            const b = pts[(hingeEdgeIndex + 1) % n];

            const edgeX = b.x - a.x;
            const edgeY = b.y - a.y;
            const perp = perpendicular(edgeX, edgeY);

            return {
                x: b.x + perp.x * this.stripWidth,
                y: b.y + perp.y * this.stripWidth,
            };
        }

        // find the centre of the new face from the anchor point between faces
        centreFromAnchor(vertexIndex: number, rotation: number, anchor: Point): Point {
            const rad = rotation * DEG_TO_RAD;
            const localPt = this.getScaledLocalVertex(vertexIndex);

            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const offsetX = localPt.x * cos - localPt.y * sin;
            const offsetY = localPt.x * sin + localPt.y * cos;

            return { x: anchor.x - offsetX, y: anchor.y - offsetY };
        }

        calculateFacePoints(face: number): Point[] {
            const layout = this.faceLayout.get(face);
            if (!layout) throw new Error(`Unknown face ${face}`);
            return this.getFacePoints(layout.centre, layout.rotation);
        }

        calculateCrownPoints(vertex: number): Point[] {
            // the first face drawn "owns" each attached crown and strip
            const facesWithVertex = this.faces.filter((f) =>
                f.vertices.includes(vertex),
            );
            const ownerFace = facesWithVertex[0].value;

            const ownerFaceData = this.faces.find((f) => f.value === ownerFace);
            if (!ownerFaceData) {
                throw new Error(`Unknown face ${ownerFace}`);
            }

            const layout = this.faceLayout.get(ownerFace);
            if (!layout) {
                throw new Error(`Unknown face ${ownerFace}`);
            }

            const pts = this.getFacePoints(layout.centre, layout.rotation);
            const corner = pts[ownerFaceData.vertices.indexOf(vertex)];
            const sides = facesWithVertex.length;
            const radius = this.stripWidth / (2 * Math.sin((180 / sides) * DEG_TO_RAD));

            // the centre of the crown sits on the line drawn from the centre of the
            // face through the vertex
            const dx = corner.x - layout.centre.x;
            const dy = corner.y - layout.centre.y;
            const dist = Math.hypot(dx, dy);
            const crownCentre = {
                x: corner.x + (dx / dist) * radius,
                y: corner.y + (dy / dist) * radius,
            };
            const rotation = edgeAngle(corner, layout.centre);

            return this.getPolygonOffsets(sides, rotation, radius).map((o) => ({
                x: crownCentre.x + o.dx,
                y: crownCentre.y + o.dy,
            }));
        }

        getTextRotation(
            face: number,
            pts: Point[],
            _centreX: number,
            _centreY: number,
        ): number {
            const faceData = this.faces.find((f) => f.value === face);
            const stance = faceData?.stance ?? 0;
            const n = pts.length;
            const edgeStart = pts[stance];
            const edgeEnd = pts[(stance + 1) % n];
            return edgeAngle(edgeStart, edgeEnd) * DEG_TO_RAD;
        }

        override drawFaceBackground(
            ctx: CanvasRenderingContext2D,
            _face: number,
            data: FaceData,
        ): void {
            ctx.fillStyle = this.faceColour ?? this.bgColour;
            ctx.beginPath();
            ctx.moveTo(data.points[0].x, data.points[0].y);
            for (let i = 1; i < data.points.length; i++) {
                ctx.lineTo(data.points[i].x, data.points[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }

        override drawFaceIcon(
            ctx: CanvasRenderingContext2D,
            face: number,
            data: FaceData,
        ): void {
            if (!this.icon) return;

            const pts = data.points;
            const centreX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centreY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            const textRotation = this.getTextRotation(face, pts, centreX, centreY);
            const faceH = this.getFaceHeight();
            const iconSize = faceH * this.scale * 0.8 * this.getIconScale();

            ctx.save();
            ctx.translate(centreX, centreY);
            ctx.rotate(textRotation);
            drawIcon(
                ctx,
                this.icon,
                0,
                0,
                iconSize,
                this.getIconColour(),
                this.getIconOutlineColour(),
            );
            ctx.restore();
        }

        override drawFaceNumeral(
            ctx: CanvasRenderingContext2D,
            face: number,
            data: FaceData,
        ): void {
            const pts = data.points;
            const centreX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centreY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            const textRotation = this.getTextRotation(face, pts, centreX, centreY);

            ctx.save();
            ctx.translate(centreX, centreY);
            ctx.rotate(textRotation);

            const faceH = this.getFaceHeight();

            // baseline: d6 square face, height = 2.0
            const fontScale = (faceH / 2.0) * this.getShapeFontScale();

            const fontPx = this.pixelDensity * this.fontSize * fontScale;
            this.drawNumeral(
                ctx,
                face,
                0,
                0,
                fontPx,
                this.fontFamily,
                this.numeralColour ?? this.fgColour,
                this.underlineColour ?? this.fgColour,
                this.numeralOutlineColour ??
                    this.fgOutlineColour ??
                    (this.icon && (this.faceColour ?? this.bgColour)),
            );
            ctx.restore();
        }

        buildFaceLayout(): void {
            const placed: number[] = [];

            // place the first face
            const firstFace = this.faces[0].value;
            this.faceLayout.set(firstFace, {
                centre: { x: 0, y: 0 },
                rotation: this.startRotation,
            });
            placed.push(firstFace);

            // all other faces connected to an already placed face, no disconects
            for (let i = 1; i < this.faces.length; i++) {
                const face = this.faces[i].value;
                const faceData = this.faces[i];

                // individual faces can explicitly define which face to place against
                if (faceData.adjacent !== undefined) {
                    const target = faceData.adjacent;
                    if (!placed.includes(target)) {
                        throw new Error(
                            `Face ${face} places adjacent to face ${target}, which has not been placed yet`,
                        );
                    }
                    this.placeAdjacent(target, face);
                } else {
                    // otherwise, place against either the most-recently
                    // placed or the least-recently placed
                    const adjacentFaces = this.getAdjacentFaces(face);
                    let baseFace: number | null = null;
                    const step = this.placeReverse ? -1 : 1;
                    const start = this.placeReverse ? placed.length - 1 : 0;
                    const end = this.placeReverse ? -1 : placed.length;
                    for (let j = start; j !== end; j += step) {
                        if (adjacentFaces.includes(placed[j])) {
                            baseFace = placed[j];
                            break;
                        }
                    }

                    if (baseFace === null) {
                        throw new Error(
                            `Face ${face} has no connection to placed faces`,
                        );
                    }

                    this.placeAdjacent(baseFace, face);
                }
                placed.push(face);
            }

            // once all faces placed, determine the size of the canvas
            let minX = Number.POSITIVE_INFINITY;
            let maxX = Number.NEGATIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;

            for (const layout of this.faceLayout.values()) {
                const pts = this.getFacePoints(layout.centre, layout.rotation);
                for (const pt of pts) {
                    minX = Math.min(minX, pt.x);
                    maxX = Math.max(maxX, pt.x);
                    minY = Math.min(minY, pt.y);
                    maxY = Math.max(maxY, pt.y);
                }
            }

            this.width = Math.ceil(maxX - minX + 2 * this.margin + this.stripWidth);
            this.height = Math.ceil(maxY - minY + 2 * this.margin + this.stripWidth);

            // shift the net over in order to trim the image tight
            const shiftX = this.margin + this.stripWidth / 2 - minX;
            const shiftY = this.margin + this.stripWidth / 2 - minY;
            for (const layout of this.faceLayout.values()) {
                layout.centre.x += shiftX;
                layout.centre.y += shiftY;
            }
        }

        buildFaceData(): void {
            for (const { value: face } of this.faces) {
                const layout = this.faceLayout.get(face);
                if (!layout) throw new Error(`No layout for face ${face}`);

                const points = this.calculateFacePoints(face);
                const verts = this.faceVertices[face];
                const faceCentroid = centroid(verts.map((vi) => this.vertices[vi]));
                for (let i = 0; i < points.length; i++) {
                    const pos = this.vertices[verts[i]]
                        .clone()
                        .lerp(faceCentroid, CHAMFER);
                    points[i].latitude = this.latitude(pos);
                }
                const uvs = points.map((p) => ({
                    u: p.x / this.width,
                    v: p.y / this.height,
                }));
                const rotation = layout.rotation;
                this.faceData.set(face, { points, uvs, rotation });
            }
        }

        buildStripData(): void {
            for (const { value: faceA } of this.faces) {
                for (const faceB of this.getAdjacentFaces(faceA)) {
                    if (faceB < faceA) continue;

                    const stripFace = this.getStripPriorityFace(faceA, faceB);
                    const otherFace = stripFace === faceA ? faceB : faceA;
                    const points = this.calculateStripPoints(faceA, faceB);

                    const edgeIdx = this.get2DEdgeIndex(stripFace, otherFace);
                    const stripVerts = this.faceVertices[stripFace];
                    const otherVerts = this.faceVertices[otherFace];
                    const n = stripVerts.length;
                    const v1 = stripVerts[edgeIdx];
                    const v2 = stripVerts[(edgeIdx + 1) % n];

                    // points: [inner1, inner2, outer2, outer1]
                    const stripCentroid = centroid(
                        stripVerts.map((vi) => this.vertices[vi]),
                    );
                    const otherCentroid = centroid(
                        otherVerts.map((vi) => this.vertices[vi]),
                    );
                    // inner edge chamfered toward stripFace centroid
                    points[0].latitude = this.latitude(
                        this.vertices[v1].clone().lerp(stripCentroid, CHAMFER),
                    );
                    points[1].latitude = this.latitude(
                        this.vertices[v2].clone().lerp(stripCentroid, CHAMFER),
                    );
                    // outer edge chamfered toward otherFace centroid
                    points[2].latitude = this.latitude(
                        this.vertices[v2].clone().lerp(otherCentroid, CHAMFER),
                    );
                    points[3].latitude = this.latitude(
                        this.vertices[v1].clone().lerp(otherCentroid, CHAMFER),
                    );

                    const uvs = this.calculateStripUVs(
                        points,
                        stripFace,
                        otherFace,
                        stripFace,
                    );
                    const rotation = edgeAngle(points[0], points[1]);

                    this.stripData.set(this.stripKey(faceA, faceB), {
                        points,
                        uvs,
                        rotation,
                    });
                }
            }
        }

        buildCrownData(): void {
            const vertexCount =
                Math.max(...Object.values(this.faceVertices).flat()) + 1;
            for (let vertex = 0; vertex < vertexCount; vertex++) {
                const hasVertex = this.faces.some(({ value: face }) =>
                    this.faceVertices[face].includes(vertex),
                );
                if (!hasVertex) continue;

                const points = this.calculateCrownPoints(vertex);
                const facesWithVertex = this.faces.filter((f) =>
                    f.vertices.includes(vertex),
                );

                // each crown point corresponds to a face's chamfered vertex
                for (let i = 0; i < points.length; i++) {
                    const face = facesWithVertex[i].value;
                    const faceVerts = this.faceVertices[face];
                    const faceCentroid = centroid(
                        faceVerts.map((vi) => this.vertices[vi]),
                    );
                    const pos = this.vertices[vertex]
                        .clone()
                        .lerp(faceCentroid, CHAMFER);
                    points[i].latitude = this.latitude(pos);
                }

                const uvs = points.map((pt) => ({
                    u: pt.x / this.width,
                    v: pt.y / this.height,
                }));
                const faceOrder = facesWithVertex.map((f) => f.value);
                const rotation =
                    points.length >= 2 ? edgeAngle(points[0], points[1]) : 0;

                this.crownData.set(vertex, { points, uvs, faceOrder, rotation });
            }
        }

        buildLayoutData(): void {
            this.buildFaceLayout();
            this.buildFaceData();
            this.buildStripData();
            this.buildCrownData();
            this.validateBounds();
        }

        validateBounds(): void {
            const epsilon = 0.01;
            const check = (pt: Point, label: string) => {
                if (
                    pt.x < -epsilon ||
                    pt.x > this.width + epsilon ||
                    pt.y < -epsilon ||
                    pt.y > this.height + epsilon
                ) {
                    throw new Error(
                        `${label} at (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) is outside canvas (${this.width}×${this.height})`,
                    );
                }
            };

            for (const [face, data] of this.faceData) {
                for (const [i, pt] of data.points.entries()) {
                    check(pt, `Face ${face} point ${i}`);
                }
            }
            for (const [key, data] of this.stripData) {
                for (const [i, pt] of data.points.entries()) {
                    check(pt, `Strip ${key} point ${i}`);
                }
            }
            for (const [vertex, data] of this.crownData) {
                for (const [i, pt] of data.points.entries()) {
                    check(pt, `Crown ${vertex} point ${i}`);
                }
            }
        }

        // biome-ignore lint/suspicious/noExplicitAny: mixin constructor pattern
        constructor(..._args: any[]) {
            super();
        }
    }

    return UnfoldableMixin as unknown as T;
}
