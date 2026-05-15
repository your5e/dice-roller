import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";
import { edgeAngle, normalFromVertices, perpendicular } from "../geometry";
import { DEG_TO_RAD } from "../geometry";
import type { DieTexture, Point } from "./dice";

export type UnfoldData = { centre: Point; rotation: number };

// biome-ignore lint/suspicious/noExplicitAny: mixin constructor pattern
export function Unfoldable<T extends abstract new (...args: any[]) => DieTexture>(
    Base: T,
) {
    // given the set of vertices and faces for a die polyhedron, unfold it to a 2D
    // shape for creating the canvas image that decorates the die
    abstract class UnfoldableMixin extends Base {
        protected faces!: DieFaces;
        protected vertices!: THREE.Vector3[];

        private _faceShape: Point[] | null = null;
        protected get faceShape(): Point[] {
            if (!this._faceShape) {
                this._faceShape = this.derivefaceShape(
                    this.vertices,
                    this.faces[0].vertices,
                );
            }
            return this._faceShape;
        }

        private derivefaceShape(
            vertices: THREE.Vector3[],
            faceVerts: number[],
        ): Point[] {
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

        protected getFaceHeight(): number {
            const yEdge = (this.faceShape[0].y + this.faceShape[1].y) / 2;
            return Math.max(...this.faceShape.map((p) => Math.abs(p.y - yEdge)));
        }

        protected get scale(): number {
            return this.pixelDensity;
        }

        protected faceLayout = new Map<number, UnfoldData>();

        abstract get startRotation(): number;

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

        protected get2DEdgeIndex(face: number, adjFace: number): number {
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

        areAdjacent(faceA: number, faceB: number): boolean {
            const vertsA = this.faces.find((f) => f.value === faceA)?.vertices;
            const vertsB = this.faces.find((f) => f.value === faceB)?.vertices;
            if (!vertsA || !vertsB) return false;
            let shared = 0;
            for (const v of vertsA) {
                if (vertsB.includes(v)) shared++;
            }
            return shared === 2;
        }

        protected placeAdjacent(baseFace: number, adjFace: number): void {
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

        protected localEdgeAngle(edgeIndex: number): number {
            const n = this.faces[0].vertices.length;
            return edgeAngle(
                this.faceShape[edgeIndex],
                this.faceShape[(edgeIndex + 1) % n],
            );
        }

        // step from the base edge perpendicularly outward by stripWidth
        private outwardPerpendicular(
            layout: UnfoldData,
            hingeEdgeIndex: number,
        ): Point {
            const n = this.faces[0].vertices.length;
            const pts = this.getFacePoints(layout.centre, layout.rotation);
            const a = pts[hingeEdgeIndex];
            const b = pts[(hingeEdgeIndex + 1) % n];

            const edgeX = b.x - a.x;
            const edgeY = b.y - a.y;
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;

            const perp = perpendicular(edgeX, edgeY);

            return {
                x: b.x + perp.x * this.stripWidth,
                y: b.y + perp.y * this.stripWidth,
            };
        }

        // find the centre of the new face from the anchor point between faces
        private centreFromAnchor(
            vertexIndex: number,
            rotation: number,
            anchor: Point,
        ): Point {
            const rad = rotation * DEG_TO_RAD;
            const localPt = this.getScaledLocalVertex(vertexIndex);

            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const offsetX = localPt.x * cos - localPt.y * sin;
            const offsetY = localPt.x * sin + localPt.y * cos;

            return { x: anchor.x - offsetX, y: anchor.y - offsetY };
        }

        protected calculateFacePoints(face: number): Point[] {
            const layout = this.faceLayout.get(face);
            if (!layout) throw new Error(`Unknown face ${face}`);
            return this.getFacePoints(layout.centre, layout.rotation);
        }

        protected calculateCrownPoints(vertex: number): Point[] {
            const n = this.faces[0].vertices.length;

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

        protected getTextRotation(
            face: number,
            pts: Point[],
            centreX: number,
            centreY: number,
        ): number {
            const faceData = this.faces.find((f) => f.value === face);
            const stance = faceData?.stance ?? 0;
            const n = pts.length;
            const edgeStart = pts[stance];
            const edgeEnd = pts[(stance + 1) % n];
            return edgeAngle(edgeStart, edgeEnd) * DEG_TO_RAD;
        }

        protected drawFaces(ctx: CanvasRenderingContext2D): void {
            for (const [face, layout] of this.faceLayout) {
                const data = this.faceData.get(face);
                if (!data) continue;
                const pts = data.points;

                ctx.fillStyle = this.faceColour;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.closePath();
                ctx.fill();

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
                this.drawFaceNumber(
                    ctx,
                    face,
                    0,
                    0,
                    fontPx,
                    this.fontFamily,
                    this.numberColour,
                    this.underlineColour,
                );
                ctx.restore();
            }
        }

        protected buildFaceLayout(): void {
            const n = this.faces[0].vertices.length;
            const placed: number[] = [];

            // Place first face at origin
            const firstFace = this.faces[0].value;
            this.faceLayout.set(firstFace, {
                centre: { x: 0, y: 0 },
                rotation: this.startRotation,
            });
            placed.push(firstFace);

            // Place remaining faces by finding connections to already-placed faces
            for (let i = 1; i < this.faces.length; i++) {
                const face = this.faces[i].value;

                // Search placed faces in reverse (most recent first)
                const adjacentFaces = this.getAdjacentFaces(face);
                let baseFace: number | null = null;
                for (let j = placed.length - 1; j >= 0; j--) {
                    if (adjacentFaces.includes(placed[j])) {
                        baseFace = placed[j];
                        break;
                    }
                }

                if (baseFace === null) {
                    throw new Error(`Face ${face} has no connection to placed faces`);
                }

                this.placeAdjacent(baseFace, face);
                placed.push(face);
            }

            // Calculate canvas bounds
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

            // Shift all centres to fit in canvas
            const shiftX = this.margin + this.stripWidth / 2 - minX;
            const shiftY = this.margin + this.stripWidth / 2 - minY;
            for (const layout of this.faceLayout.values()) {
                layout.centre.x += shiftX;
                layout.centre.y += shiftY;
            }
        }

        // biome-ignore lint/suspicious/noExplicitAny: mixin constructor pattern
        constructor(..._args: any[]) {
            super();
        }
    }

    return UnfoldableMixin as unknown as T;
}
