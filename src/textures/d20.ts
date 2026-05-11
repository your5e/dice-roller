import { FACE_BOTTOM_EDGE, FACE_VERTICES } from "../bodies/d20";
import { CHAMFER } from "../geometries/chamfer";
import { DEG_TO_RAD, PHI, perpendicular } from "../geometry";
import { DieTexture, type Point, type UV } from "./dice";

type GridPos = { row: number; col: number };

export class D20Texture extends DieTexture {
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#e07000";
    protected edgeColour = "#e07000";
    protected cornerColour = "#e07000";

    // geometry derives everything from circumradius
    protected readonly circumradius = 140;
    protected readonly side = this.circumradius * Math.sqrt(3);
    protected readonly stripWidth = this.side * CHAMFER;

    // canvas
    protected readonly margin = this.stripWidth + 5;
    protected readonly colGap = PHI * this.stripWidth;
    protected readonly row2Shift = this.side / 2 + (this.stripWidth * Math.sqrt(3)) / 2;
    readonly width = Math.ceil(
        5.5 * this.side + 4 * this.colGap + 2 * this.margin + this.stripWidth + 1,
    );
    readonly height = Math.ceil(
        4.5 * this.circumradius + 2.5 * this.stripWidth + 2 * this.margin,
    );

    protected faceLayout = new Map<number, GridPos>();
    protected drawPriority: number[] = [];

    constructor() {
        super();
        this.buildLayoutData();
    }

    protected buildLayoutData(): void {
        this.buildFaceLayout();
        this.drawPriority = [...this.faceLayout.keys()];
        this.buildFaceData();
        this.buildEdgeData();
        this.buildCornerData();
    }

    private buildFaceLayout(): void {
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

    private buildFaceData(): void {
        for (const [face, pos] of this.faceLayout) {
            const vertices = this.calculateFaceVertices(pos);
            const rotation = this.calculateFaceRotation(face);
            const uvs = vertices.map((_, i) => {
                const j = (i + rotation) % 3;
                return {
                    u: vertices[j].x / this.width,
                    v: vertices[j].y / this.height,
                };
            });
            this.faceData.set(face, { vertices, uvs });
        }
    }

    private buildEdgeData(): void {
        for (const faceA of this.faceLayout.keys()) {
            for (const faceB of this.getAdjacentFaces(faceA)) {
                if (faceB < faceA) continue; // process each edge once

                const stripFace = this.getEdgePriorityFace(faceA, faceB);
                const otherFace = stripFace === faceA ? faceB : faceA;
                const vertices = this.calculateEdgeVertices(stripFace, otherFace);

                // calculate UVs for both faces
                const uvsByFace = new Map<number, UV[]>();
                uvsByFace.set(
                    faceA,
                    this.calculateEdgeUVs(vertices, faceA, faceB, stripFace),
                );
                uvsByFace.set(
                    faceB,
                    this.calculateEdgeUVs(vertices, faceB, faceA, stripFace),
                );

                this.edgeData.set(this.edgeKey(faceA, faceB), { vertices, uvsByFace });
            }
        }
    }

    private calculateEdgeUVs(
        vertices: Point[],
        requestingFace: number,
        otherFace: number,
        stripFace: number,
    ): UV[] {
        const [inner1, inner2, outer2, outer1] = vertices;

        const edge2DIdx = this.get2DEdgeIndex(
            stripFace,
            stripFace === requestingFace ? otherFace : requestingFace,
        );
        const stripRotation = this.calculateFaceRotation(stripFace);
        const strip3DIdx = (edge2DIdx - stripRotation + 3) % 3;
        const stripVerts = FACE_VERTICES[stripFace];
        const requestingVerts = FACE_VERTICES[requestingFace];
        const sharedVerts = requestingVerts.filter((vx) =>
            FACE_VERTICES[otherFace].includes(vx),
        );
        const aIdx = requestingVerts.indexOf(sharedVerts[0]);
        const v3DStart =
            requestingVerts[(aIdx + 1) % 3] === sharedVerts[1]
                ? sharedVerts[0]
                : sharedVerts[1];

        const reverseEdge = stripVerts[strip3DIdx] !== v3DStart;
        const swapSides = stripFace !== requestingFace;

        let uvs: UV[] = [
            { u: outer1.x / this.width, v: outer1.y / this.height },
            { u: outer2.x / this.width, v: outer2.y / this.height },
            { u: inner2.x / this.width, v: inner2.y / this.height },
            { u: inner1.x / this.width, v: inner1.y / this.height },
        ];

        if (reverseEdge) {
            uvs = [uvs[1], uvs[0], uvs[3], uvs[2]];
        }
        if (swapSides) {
            uvs = [uvs[3], uvs[2], uvs[1], uvs[0]];
        }

        return uvs;
    }

    private buildCornerData(): void {
        for (let vertex = 0; vertex < 12; vertex++) {
            // find which face draws this corner (row 0 or 3 faces)
            let ownerFace: number | null = null;
            let corner2D = 0;

            for (const [face, pos] of this.faceLayout) {
                if (pos.row !== 0 && pos.row !== 3) continue;
                const idx3D = FACE_VERTICES[face].indexOf(vertex);
                if (idx3D === -1) continue;
                corner2D = (idx3D + this.calculateFaceRotation(face)) % 3;
                ownerFace = face;
                break;
            }

            if (ownerFace === null) continue;

            const vertices = this.calculateCornerVertices(ownerFace, corner2D);
            const uvs = vertices.map((pt) => ({
                u: pt.x / this.width,
                v: pt.y / this.height,
            }));

            this.cornerData.set(vertex, { vertices, uvs });
        }
    }

    private calculateFaceVertices(pos: GridPos): Point[] {
        const isUp = pos.row % 2 === 0;
        const centre = this.getLayoutAnchor(pos);
        const offsets = this.getTriangleOffsets(isUp ? -90 : 90, this.circumradius);

        return [
            { x: centre.x + offsets[0].dx, y: centre.y + offsets[0].dy },
            { x: centre.x + offsets[1].dx, y: centre.y + offsets[1].dy },
            { x: centre.x + offsets[2].dx, y: centre.y + offsets[2].dy },
        ];
    }

    private calculateEdgeVertices(stripFace: number, otherFace: number): Point[] {
        const pos = this.faceLayout.get(stripFace);
        if (!pos) throw new Error(`Unknown face ${stripFace}`);

        const isUp = pos.row % 2 === 0;
        const centre = this.getLayoutAnchor(pos);
        const offsets = this.getTriangleOffsets(isUp ? -90 : 90, this.circumradius);
        const edgeIdx = this.get2DEdgeIndex(stripFace, otherFace);

        const v1 = {
            x: centre.x + offsets[edgeIdx].dx,
            y: centre.y + offsets[edgeIdx].dy,
        };
        const v2 = {
            x: centre.x + offsets[(edgeIdx + 1) % 3].dx,
            y: centre.y + offsets[(edgeIdx + 1) % 3].dy,
        };

        const perp = perpendicular(v2.x - v1.x, v2.y - v1.y);

        return [
            v1,
            v2,
            { x: v2.x + perp.x * this.stripWidth, y: v2.y + perp.y * this.stripWidth },
            { x: v1.x + perp.x * this.stripWidth, y: v1.y + perp.y * this.stripWidth },
        ];
    }

    private calculateCornerVertices(face: number, cornerIdx: number): Point[] {
        const pos = this.faceLayout.get(face);
        if (!pos) throw new Error(`Unknown face ${face}`);

        const isUp = pos.row % 2 === 0;
        const centre = this.getLayoutAnchor(pos);
        const offsets = this.getTriangleOffsets(isUp ? -90 : 90, this.circumradius);

        const cvx = centre.x + offsets[cornerIdx].dx;
        const cvy = centre.y + offsets[cornerIdx].dy;
        const outAngle = Math.atan2(offsets[cornerIdx].dy, offsets[cornerIdx].dx);

        const vertices: Point[] = [{ x: cvx, y: cvy }];

        let angle = outAngle - 54 * DEG_TO_RAD;
        let px = cvx;
        let py = cvy;
        for (let i = 0; i < 4; i++) {
            px += this.stripWidth * Math.cos(angle);
            py += this.stripWidth * Math.sin(angle);
            vertices.push({ x: px, y: py });
            angle += 72 * DEG_TO_RAD;
        }

        return vertices;
    }

    protected drawEdges(ctx: CanvasRenderingContext2D): void {
        for (const data of this.edgeData.values()) {
            const [v1, v2, v3, v4] = data.vertices;
            ctx.fillStyle = this.edgeColour;
            ctx.beginPath();
            ctx.moveTo(v1.x, v1.y);
            ctx.lineTo(v2.x, v2.y);
            ctx.lineTo(v3.x, v3.y);
            ctx.lineTo(v4.x, v4.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    protected drawCorners(ctx: CanvasRenderingContext2D): void {
        for (const data of this.cornerData.values()) {
            ctx.fillStyle = this.cornerColour;
            ctx.beginPath();
            ctx.moveTo(data.vertices[0].x, data.vertices[0].y);
            for (let i = 1; i < data.vertices.length; i++) {
                ctx.lineTo(data.vertices[i].x, data.vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    protected drawFaces(ctx: CanvasRenderingContext2D): void {
        for (const [face, pos] of this.faceLayout) {
            const data = this.faceData.get(face);
            if (!data) continue;
            const [v0, v1, v2] = data.vertices;

            ctx.fillStyle = this.faceColour;
            ctx.beginPath();
            ctx.moveTo(v0.x, v0.y);
            ctx.lineTo(v1.x, v1.y);
            ctx.lineTo(v2.x, v2.y);
            ctx.closePath();
            ctx.fill();

            const centreX = (v0.x + v1.x + v2.x) / 3;
            const centreY = (v0.y + v1.y + v2.y) / 3;

            const isUp = pos.row % 2 === 0;
            const rotation =
                ((1 - this.getBottomEdge(face)) * 120 + (isUp ? 0 : 180)) *
                (Math.PI / 180);

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

    getFaceRotation(face: number): number {
        return this.calculateFaceRotation(face);
    }

    selectCornerFace(faces: { face: number; idx: number }[]): {
        face: number;
        idx: number;
    } {
        return faces.reduce((best, curr) => {
            const bestIdx = this.drawPriority.indexOf(best.face);
            const currIdx = this.drawPriority.indexOf(curr.face);
            return currIdx < bestIdx ? curr : best;
        });
    }

    private getLayoutAnchor(pos: GridPos): Point {
        const xShift = pos.row >= 2 ? this.row2Shift : 0;
        const x =
            this.margin + (pos.col + 0.5) * this.side + pos.col * this.colGap + xShift;

        let y: number;
        switch (pos.row) {
            case 0:
                y = this.margin + this.circumradius;
                break;
            case 1:
                y = this.margin + 2 * this.circumradius + this.stripWidth;
                break;
            case 2:
                y = this.margin + 2.5 * this.circumradius + 1.5 * this.stripWidth;
                break;
            case 3:
                y = this.margin + 3.5 * this.circumradius + 2.5 * this.stripWidth;
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

    private getEdgePriorityFace(faceA: number, faceB: number): number {
        const idxA = this.drawPriority.indexOf(faceA);
        const idxB = this.drawPriority.indexOf(faceB);
        return idxA < idxB ? faceA : faceB;
    }

    private calculateFaceRotation(face: number): number {
        return (this.get2DEdgeIndex(face, this.getAdjacentFaces(face)[0]) + 3) % 3;
    }

    private getBottomEdge(face: number): number {
        return FACE_BOTTOM_EDGE[face];
    }
}

export class D20TemplateTexture extends D20Texture {
    protected faceColour = "#ffffff";
    protected edgeColour = "#f8f8f8";
    protected cornerColour = "#f0f0f0";
    protected numberColour = "#e8e8e8";
    protected underlineColour = "#e8e8e8";
}

export class D20DebugTexture extends D20Texture {
    protected faceColour = "#f0f0f0";
    protected edgeColour = "#ffffff";
    protected cornerColour = "#ffffff";
    protected numberColour = "#000000";
    protected underlineColour = "#000000";
    protected fontFamily =
        "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif";

    private edgeColourIndex = new Map<string, number>();

    protected decorateEdges(ctx: CanvasRenderingContext2D): void {
        let colourIdx = 0;
        for (const [key, data] of this.edgeData) {
            this.edgeColourIndex.set(key, colourIdx);
            const { hex } = this.getDebugColour(colourIdx);
            colourIdx++;

            const [v1, v2, v3, v4] = data.vertices;

            ctx.strokeStyle = hex;
            ctx.lineWidth = 3;
            const offsetRatio = this.stripWidth / this.side;
            const innerMidX = (v1.x + v2.x) / 2;
            const innerMidY = (v1.y + v2.y) / 2;
            const outerMidX = (v3.x + v4.x) / 2;
            const outerMidY = (v3.y + v4.y) / 2;
            const innerX = innerMidX + offsetRatio * (v1.x - innerMidX);
            const innerY = innerMidY + offsetRatio * (v1.y - innerMidY);
            const outerX = outerMidX + offsetRatio * (v3.x - outerMidX);
            const outerY = outerMidY + offsetRatio * (v3.y - outerMidY);
            ctx.beginPath();
            ctx.moveTo(innerX, innerY);
            ctx.lineTo(outerX, outerY);
            ctx.stroke();
        }
    }

    protected decorateCorners(ctx: CanvasRenderingContext2D): void {
        for (const [vertex, data] of this.cornerData) {
            const { hex } = this.getDebugColour(vertex);

            ctx.fillStyle = hex;
            ctx.beginPath();
            ctx.moveTo(data.vertices[0].x, data.vertices[0].y);
            for (let i = 1; i < data.vertices.length; i++) {
                ctx.lineTo(data.vertices[i].x, data.vertices[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    protected decorateFaces(ctx: CanvasRenderingContext2D): void {
        for (const face of this.faceLayout.keys()) {
            const data = this.faceData.get(face);
            if (!data) continue;
            const [v0, v1, v2] = data.vertices;

            const centreX = (v0.x + v1.x + v2.x) / 3;
            const centreY = (v0.y + v1.y + v2.y) / 3;

            ctx.lineWidth = 3;
            const verts = [v0, v1, v2];
            const faceVerts3D = FACE_VERTICES[face];

            for (const adjFace of this.getAdjacentFaces(face)) {
                const key = this.edgeKey(face, adjFace);
                const { hex } = this.getDebugColour(this.edgeColourIndex.get(key) ?? 0);
                ctx.strokeStyle = hex;

                const edgeIdx = this.get2DEdgeIndex(face, adjFace);

                const edgeVert = verts[edgeIdx];
                const startX = centreX + 0.5 * (edgeVert.x - centreX);
                const startY = centreY + 0.5 * (edgeVert.y - centreY);

                const midX = (verts[edgeIdx].x + verts[(edgeIdx + 1) % 3].x) / 2;
                const midY = (verts[edgeIdx].y + verts[(edgeIdx + 1) % 3].y) / 2;
                const offsetRatio = this.stripWidth / this.side;
                const toX = midX + offsetRatio * (edgeVert.x - midX);
                const toY = midY + offsetRatio * (edgeVert.y - midY);

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
            }

            for (let idx3D = 0; idx3D < 3; idx3D++) {
                const vertex = faceVerts3D[idx3D];

                const { hex } = this.getDebugColour(vertex);
                ctx.strokeStyle = hex;

                const cornerVert = verts[(idx3D + this.getFaceRotation(face)) % 3];

                const endX = cornerVert.x + 0.3 * (centreX - cornerVert.x);
                const endY = cornerVert.y + 0.3 * (centreY - cornerVert.y);
                ctx.beginPath();
                ctx.moveTo(cornerVert.x, cornerVert.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    }
}
