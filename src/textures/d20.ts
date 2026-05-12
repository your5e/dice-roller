import { FACES, FACE_STANCE, FACE_VERTICES } from "../bodies/d20";
import { DEG_TO_RAD, PHI } from "../geometry";
import { DebugMixin, DieTexture, type Point, TemplateMixin, type UV } from "./dice";

type GridPos = { row: number; col: number };

export class D20Texture extends DieTexture {
    protected faceVertices = FACE_VERTICES;
    protected faces = FACES;
    protected faceColour = "#e07000";
    protected stripColour = "#e07000";
    protected crownColour = "#e07000";

    constructor() {
        super();
        this.buildLayoutData();
    }

    // canvas
    protected get colGap(): number {
        return PHI * this.stripWidth;
    }
    protected get equatorialShift(): number {
        return this.edgeLength / 2 + (this.stripWidth * Math.sqrt(3)) / 2;
    }
    protected get edgeLength(): number {
        return this.circumradius * Math.sqrt(3);
    }
    protected get crownDiameter(): number {
        return 2 * (this.stripWidth / (2 * Math.sin(36 * DEG_TO_RAD)));
    }
    get width(): number {
        // crown, face, column gap (two strips meeting at an angle),
        // face, col, face, col, face, col, face, shift where the bottom
        // two rows are half over to line up the "teeth"
        return Math.ceil(
            this.crownDiameter +
                5 * this.edgeLength +
                4 * this.colGap +
                this.equatorialShift,
        );
    }
    get height(): number {
        // crown, face, strip, face, strip, face, crown
        return Math.ceil(
            2 * this.crownDiameter + 4.5 * this.circumradius + 2 * this.colGap,
        );
    }

    protected faceLayout = new Map<number, GridPos>();
    protected buildFaceLayout(): void {
        const placed = new Set<number>();

        const facesAt = (vertex: number): number[] => {
            return Object.entries(FACE_VERTICES)
                .filter(([, verts]) => verts.includes(vertex))
                .map(([f]) => Number(f));
        };

        const adjacentFaces = (face: number): number[] => {
            return [...this.getAdjacentFaces(face)].reverse();
        };

        const walkRing = (vertex: number, start: number): number[] => {
            const faces = facesAt(vertex);
            const ring: number[] = [start];
            while (ring.length < faces.length) {
                const current = ring[ring.length - 1];
                for (const next of adjacentFaces(current)) {
                    if (!ring.includes(next) && faces.includes(next)) {
                        ring.push(next);
                        break;
                    }
                }
            }
            return ring;
        };

        const row0 = walkRing(0, facesAt(0)[0]);
        for (let col = 0; col < row0.length; col++) {
            this.faceLayout.set(row0[col], { row: 0, col });
            placed.add(row0[col]);
        }

        const row1: number[] = [];
        for (const face of row0) {
            const adj = adjacentFaces(face).find(
                (f) => !FACE_VERTICES[f].includes(0) && !placed.has(f),
            );
            if (adj !== undefined) {
                row1.push(adj);
                this.faceLayout.set(adj, { row: 1, col: row1.length - 1 });
                placed.add(adj);
            }
        }

        const row2: number[] = [];
        for (const face of row1) {
            const adj = adjacentFaces(face).find((f) => !placed.has(f));
            if (adj !== undefined) {
                row2.push(adj);
                this.faceLayout.set(adj, { row: 2, col: row2.length - 1 });
                placed.add(adj);
            }
        }

        for (const face of row2) {
            const adj = adjacentFaces(face).find(
                (f) => !placed.has(f) && FACE_VERTICES[f].includes(3),
            );
            if (adj !== undefined) {
                this.faceLayout.set(adj, { row: 3, col: placed.size - 15 });
                placed.add(adj);
            }
        }
    }

    protected calculateFacePoints(face: number): Point[] {
        const pos = this.faceLayout.get(face);
        if (!pos) throw new Error(`Unknown face ${face}`);

        const isUp = pos.row % 2 === 0;
        const centre = this.getLayoutAnchor(pos);
        const offsets = this.getPolygonOffsets(3, isUp ? -90 : 90, this.circumradius);

        return [
            { x: centre.x + offsets[0].dx, y: centre.y + offsets[0].dy },
            { x: centre.x + offsets[1].dx, y: centre.y + offsets[1].dy },
            { x: centre.x + offsets[2].dx, y: centre.y + offsets[2].dy },
        ];
    }

    protected calculateCrownPoints(vertex: number): Point[] {
        // find all faces containing this vertex
        const facesWithVertex: number[] = [];
        for (const face of this.faceLayout.keys()) {
            if (FACE_VERTICES[face].includes(vertex)) {
                facesWithVertex.push(face);
            }
        }
        if (facesWithVertex.length === 0) {
            throw new Error(`No faces contain vertex ${vertex}`);
        }

        // pick the face that appears earliest in FACES
        const ownerFace = facesWithVertex.reduce((best, face) => {
            const bestIdx = FACES.findIndex((f) => f.value === best);
            const faceIdx = FACES.findIndex((f) => f.value === face);
            return faceIdx < bestIdx ? face : best;
        });

        const idx3D = FACE_VERTICES[ownerFace].indexOf(vertex);
        const cornerIdx = (idx3D + this.get2DStartIndex(ownerFace)) % 3;

        const pos = this.faceLayout.get(ownerFace);
        if (!pos) throw new Error(`Unknown face ${ownerFace}`);

        const isUp = pos.row % 2 === 0;
        const centre = this.getLayoutAnchor(pos);
        const offsets = this.getPolygonOffsets(3, isUp ? -90 : 90, this.circumradius);

        const { dx, dy } = offsets[cornerIdx];
        const corner = { x: centre.x + dx, y: centre.y + dy };

        // pentagon: edge length = stripWidth, circumradius = stripWidth / (2 * sin(36°))
        const radius = this.stripWidth / (2 * Math.sin(36 * DEG_TO_RAD));
        const pentCentre = {
            x: corner.x + (dx / this.circumradius) * radius,
            y: corner.y + (dy / this.circumradius) * radius,
        };
        const rotation = Math.atan2(-dy, -dx) / DEG_TO_RAD;

        const points = this.getPolygonOffsets(5, rotation, radius).map((o) => ({
            x: pentCentre.x + o.dx,
            y: pentCentre.y + o.dy,
        }));

        if (vertex === 0) {
            const crownLabel = facesWithVertex.sort((a, b) => a - b).join(":");
            console.log(`d20 crown ${crownLabel} (vertex ${vertex}) drawing coords:`);
            points.forEach((pt, i) =>
                console.log(`  point ${i}: (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`),
            );
        }

        return points;
    }

    protected drawFaces(ctx: CanvasRenderingContext2D): void {
        for (const [face, pos] of this.faceLayout) {
            const data = this.faceData.get(face);
            if (!data) continue;
            const [p0, p1, p2] = data.points;

            ctx.fillStyle = this.faceColour;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.closePath();
            ctx.fill();

            const centreX = (p0.x + p1.x + p2.x) / 3;
            const centreY = (p0.y + p1.y + p2.y) / 3;

            const isUp = pos.row % 2 === 0;
            const rotation =
                ((1 - FACE_STANCE[face]) * 120 + (isUp ? 0 : 180)) * (Math.PI / 180);

            ctx.save();
            ctx.translate(centreX, centreY);
            ctx.rotate(rotation);
            this.drawFaceNumber(
                ctx,
                face,
                0,
                0,
                Math.floor(this.circumradius * this.fontSize),
                this.fontFamily,
                this.numberColour,
                this.underlineColour,
            );
            ctx.restore();
        }
    }

    private getLayoutAnchor(pos: GridPos): Point {
        // rows 2+3 are shifted right by half a triangle to interlock
        const xShift = pos.row >= 2 ? this.equatorialShift : 0;
        // each column is: half-triangle to centre, plus gaps to the left
        const x =
            this.crownDiameter +
            (pos.col + 0.5) * this.edgeLength +
            pos.col * this.colGap +
            xShift;

        // y is the centre of the triangle at this grid position
        let y: number;
        switch (pos.row) {
            case 0:
                y = this.crownDiameter + this.circumradius;
                break;
            case 1:
                y = this.crownDiameter + 2 * this.circumradius + this.stripWidth;
                break;
            case 2:
                y =
                    this.crownDiameter +
                    2.5 * this.circumradius +
                    1.5 * this.stripWidth;
                break;
            case 3:
                y =
                    this.crownDiameter +
                    3.5 * this.circumradius +
                    2.5 * this.stripWidth;
                break;
            default:
                throw new Error(`Invalid row ${pos.row}`);
        }
        return { x, y };
    }

    protected get2DEdgeIndex(face: number, adjFace: number): number {
        const pos = this.faceLayout.get(face);
        const adjPos = this.faceLayout.get(adjFace);
        if (!pos || !adjPos) throw new Error(`Unknown face ${face} or ${adjFace}`);

        const isUp = pos.row % 2 === 0;
        const rowDiff = adjPos.row - pos.row;
        const sameCol = adjPos.col === pos.col;
        const isRight = (adjPos.col - pos.col + 5) % 5 === 1;

        if (rowDiff === 0) {
            return isRight === isUp ? 2 : 0;
        }
        if (rowDiff < 0) {
            return isUp ? (sameCol ? 0 : 2) : 1;
        }
        return isUp ? 1 : sameCol ? 0 : 2;
    }

    get2DStartIndex(face: number): number {
        return (this.get2DEdgeIndex(face, this.getAdjacentFaces(face)[0]) + 3) % 3;
    }
}

export class D20TemplateTexture extends TemplateMixin(D20Texture) {}

export class D20DebugTexture extends DebugMixin(D20Texture) {
    protected decorateFaces(ctx: CanvasRenderingContext2D): void {
        for (const face of this.faceLayout.keys()) {
            const data = this.faceData.get(face);
            if (!data) continue;
            const [p0, p1, p2] = data.points;

            const centreX = (p0.x + p1.x + p2.x) / 3;
            const centreY = (p0.y + p1.y + p2.y) / 3;

            ctx.lineWidth = 3;
            const pts = [p0, p1, p2];
            const faceVerts3D = FACE_VERTICES[face];

            for (const adjFace of this.getAdjacentFaces(face)) {
                ctx.strokeStyle = this.getStripColour(face, adjFace);

                const edgeIdx = this.get2DEdgeIndex(face, adjFace);

                const edgePt = pts[edgeIdx];
                const startX = centreX + 0.5 * (edgePt.x - centreX);
                const startY = centreY + 0.5 * (edgePt.y - centreY);

                const midX = (pts[edgeIdx].x + pts[(edgeIdx + 1) % 3].x) / 2;
                const midY = (pts[edgeIdx].y + pts[(edgeIdx + 1) % 3].y) / 2;
                const offsetRatio = this.stripWidth / this.edgeLength;
                const toX = midX + offsetRatio * (edgePt.x - midX);
                const toY = midY + offsetRatio * (edgePt.y - midY);

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
            }

            for (let idx3D = 0; idx3D < 3; idx3D++) {
                const vertex = faceVerts3D[idx3D];

                ctx.strokeStyle = this.getCrownColour(vertex);

                const cornerPt = pts[(idx3D + this.get2DStartIndex(face)) % 3];

                const endX = cornerPt.x + 0.3 * (centreX - cornerPt.x);
                const endY = cornerPt.y + 0.3 * (centreY - cornerPt.y);
                ctx.beginPath();
                ctx.moveTo(cornerPt.x, cornerPt.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    }
}
