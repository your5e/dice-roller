import * as THREE from "three";
import { CHAMFER } from "../geometries/chamfer";
import { perpendicular } from "../geometry";

export type Point = { x: number; y: number };
export type UV = { u: number; v: number };

export type FaceData = {
    points: Point[];
    uvs: UV[];
};

export type StripData = {
    points: Point[];
    uvsByFace: Map<number, UV[]>;
};

export type CrownData = {
    points: Point[];
    uvs: UV[];
    faceOrder?: number[];
};

// colours from "List of 20 Simple, Distinct Colors" by Sasha Trubetskoy
// https://sashamaps.net/docs/resources/20-colors/
const DEBUG_COLOURS: { hex: string; name: string }[] = [
    { hex: "#e6194b", name: "red" },
    { hex: "#3cb44b", name: "green" },
    { hex: "#ffe119", name: "yellow" },
    { hex: "#4363d8", name: "blue" },
    { hex: "#f58231", name: "orange" },
    { hex: "#911eb4", name: "purple" },
    { hex: "#46f0f0", name: "cyan" },
    { hex: "#f032e6", name: "magenta" },
    { hex: "#bcf60c", name: "lime" },
    { hex: "#008080", name: "teal" },
    { hex: "#9a6324", name: "brown" },
    { hex: "#800000", name: "maroon" },
    { hex: "#808000", name: "olive" },
    { hex: "#000075", name: "navy" },
    { hex: "#808080", name: "grey" },
];

export abstract class DieTexture {
    protected abstract faceVertices: Record<number, number[]>;
    protected abstract faces: { value: number }[];
    protected abstract faceColour: string;
    protected abstract stripColour: string;
    protected abstract crownColour: string;
    protected abstract get edgeLength(): number;
    protected numberColour = "#ffffff";
    protected underlineColour = "#ffffff";
    protected fontFamily = "Varela Round, sans-serif";
    protected fontWeight = 400;
    protected fontSize = 1.2;
    protected faceData = new Map<number, FaceData>();
    protected stripData = new Map<string, StripData>();
    protected crownData = new Map<number, CrownData>();
    private textureCache: { current: THREE.CanvasTexture | null } = { current: null };
    public width = 0;
    public height = 0;

    protected get pixelDensity(): number {
        return 100;
    }
    protected get stripWidth(): number {
        return this.edgeLength * CHAMFER;
    }
    protected get margin(): number {
        return this.stripWidth + 5;
    }

    protected buildFaceData(): void {
        for (const { value: face } of this.faces) {
            const points = this.calculateFacePoints(face);
            const uvs = points.map((p) => ({
                u: p.x / this.width,
                v: p.y / this.height,
            }));
            this.faceData.set(face, { points, uvs });
        }
    }
    protected buildStripData(): void {
        for (const { value: faceA } of this.faces) {
            for (const faceB of this.getAdjacentFaces(faceA)) {
                if (faceB < faceA) continue;

                const stripFace = this.getStripPriorityFace(faceA, faceB);
                const points = this.calculateStripPoints(faceA, faceB);

                const uvsByFace = new Map<number, UV[]>();
                uvsByFace.set(
                    faceA,
                    this.calculateStripUVs(points, faceA, faceB, stripFace),
                );
                uvsByFace.set(
                    faceB,
                    this.calculateStripUVs(points, faceB, faceA, stripFace),
                );

                this.stripData.set(this.stripKey(faceA, faceB), {
                    points,
                    uvsByFace,
                });
            }
        }
    }
    protected buildCrownData(): void {
        const vertexCount = Math.max(...Object.values(this.faceVertices).flat()) + 1;
        for (let vertex = 0; vertex < vertexCount; vertex++) {
            const hasVertex = this.faces.some(({ value: face }) =>
                this.faceVertices[face].includes(vertex),
            );
            if (!hasVertex) continue;

            const points = this.calculateCrownPoints(vertex);
            const uvs = points.map((pt) => ({
                u: pt.x / this.width,
                v: pt.y / this.height,
            }));

            this.crownData.set(vertex, { points, uvs });
        }
    }

    protected buildLayoutData(): void {
        this.buildFaceLayout();
        this.buildFaceData();
        this.buildStripData();
        this.buildCrownData();
        this.validateBounds();
    }

    protected validateBounds(): void {
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
            data.points.forEach((pt, i) => check(pt, `Face ${face} point ${i}`));
        }
        for (const [key, data] of this.stripData) {
            data.points.forEach((pt, i) => check(pt, `Strip ${key} point ${i}`));
        }
        for (const [vertex, data] of this.crownData) {
            data.points.forEach((pt, i) => check(pt, `Crown ${vertex} point ${i}`));
        }
    }

    protected calculateStripPoints(faceA: number, faceB: number): Point[] {
        const stripFace = this.getStripPriorityFace(faceA, faceB);
        const otherFace = stripFace === faceA ? faceB : faceA;

        const points = this.calculateFacePoints(stripFace);
        const edgeIdx = this.get2DEdgeIndex(stripFace, otherFace);
        const pointCount = points.length;

        const p1 = points[edgeIdx];
        const p2 = points[(edgeIdx + 1) % pointCount];
        const perp = perpendicular(p2.x - p1.x, p2.y - p1.y);

        return [
            p1,
            p2,
            { x: p2.x + perp.x * this.stripWidth, y: p2.y + perp.y * this.stripWidth },
            { x: p1.x + perp.x * this.stripWidth, y: p1.y + perp.y * this.stripWidth },
        ];
    }

    protected createTextureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    protected async createCanvas(): Promise<HTMLCanvasElement> {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        this.drawStrips(ctx);
        this.decorateStrips(ctx);
        this.drawCrowns(ctx);
        this.decorateCrowns(ctx);
        this.drawFaces(ctx);
        this.decorateFaces(ctx);

        return canvas;
    }

    async createTexture(): Promise<THREE.CanvasTexture> {
        if (this.textureCache.current) {
            return this.textureCache.current;
        }

        const canvas = await this.createCanvas();
        const texture = this.createTextureFromCanvas(canvas);
        this.textureCache.current = texture;

        return texture;
    }

    protected getDebugColour(index: number): { hex: string; name: string } {
        return DEBUG_COLOURS[index % DEBUG_COLOURS.length];
    }

    areAdjacent(faceA: number, faceB: number): boolean {
        const vertsA = new Set(this.faceVertices[faceA]);
        const shared = this.faceVertices[faceB].filter((v) => vertsA.has(v));
        return shared.length === 2;
    }

    getAdjacentFaces(face: number): number[] {
        const verts = this.faceVertices[face];
        const adjacent: number[] = [];
        for (let i = 0; i < verts.length; i++) {
            const v1 = verts[i];
            const v2 = verts[(i + 1) % verts.length];
            for (const otherStr of Object.keys(this.faceVertices)) {
                const other = Number(otherStr);
                if (other === face) continue;
                const otherVerts = this.faceVertices[other];
                if (otherVerts.includes(v1) && otherVerts.includes(v2)) {
                    adjacent.push(other);
                    break;
                }
            }
        }
        return adjacent;
    }

    protected getFaceAtEdge(face: number, edgeIdx: number): number {
        for (const adjFace of this.getAdjacentFaces(face)) {
            if (this.get2DEdgeIndex(face, adjFace) === edgeIdx) return adjFace;
        }
        throw new Error(`No face found at edge ${edgeIdx} of face ${face}`);
    }

    findCommonVertex(faces: number[]): number | null {
        const vertSets = faces.map((f) => new Set(this.faceVertices[f]));
        for (const vx of vertSets[0]) {
            if (vertSets.every((s) => s.has(vx))) {
                return vx;
            }
        }
        return null;
    }

    protected stripKey(faceA: number, faceB: number): string {
        return `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
    }

    getFaceUV(face: number): UV[] {
        const data = this.faceData.get(face);
        if (!data) throw new Error(`No face data for face ${face}`);
        return data.uvs;
    }

    getStripUV(faceA: number, faceB: number): UV[] {
        const data = this.stripData.get(this.stripKey(faceA, faceB));
        if (!data) throw new Error(`No strip data for faces ${faceA}, ${faceB}`);
        const uvs = data.uvsByFace.get(faceA);
        if (!uvs)
            throw new Error(`No UVs for face ${faceA} on strip ${faceA}-${faceB}`);
        return uvs;
    }

    getCrownUV(faces: number[]): UV[] {
        const vertex = this.findCommonVertex(faces);
        if (vertex === null)
            throw new Error(`No common vertex for faces [${faces.join(", ")}]`);
        const data = this.crownData.get(vertex);
        if (!data) throw new Error(`No crown data for vertex ${vertex}`);
        return data.uvs;
    }

    protected getStripPriorityFace(faceA: number, faceB: number): number {
        const idxA = this.faces.findIndex((f) => f.value === faceA);
        const idxB = this.faces.findIndex((f) => f.value === faceB);
        return idxA < idxB ? faceA : faceB;
    }

    protected calculateStripUVs(
        points: Point[],
        requestingFace: number,
        otherFace: number,
        stripFace: number,
    ): UV[] {
        const [inner1, inner2, outer2, outer1] = points;
        const vertexCount = this.faceVertices[stripFace].length;

        const strip3DIdx = this.get2DEdgeIndex(
            stripFace,
            stripFace === requestingFace ? otherFace : requestingFace,
        );
        const stripVerts = this.faceVertices[stripFace];
        const requestingVerts = this.faceVertices[requestingFace];
        const sharedVerts = requestingVerts.filter((vx) =>
            this.faceVertices[otherFace].includes(vx),
        );
        const aIdx = requestingVerts.indexOf(sharedVerts[0]);
        const v3DStart =
            requestingVerts[(aIdx + 1) % vertexCount] === sharedVerts[1]
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

    protected getPolygonOffsets(
        sides: number,
        rotation: number,
        radius: number,
    ): { dx: number; dy: number }[] {
        const offsets: { dx: number; dy: number }[] = [];
        const angleStep = 360 / sides;
        for (let i = 0; i < sides; i++) {
            const angle = ((rotation - i * angleStep) * Math.PI) / 180;
            offsets.push({
                dx: radius * Math.cos(angle),
                dy: radius * Math.sin(angle),
            });
        }
        return offsets;
    }

    protected drawStrips(ctx: CanvasRenderingContext2D): void {
        for (const data of this.stripData.values()) {
            const [p1, p2, p3, p4] = data.points;
            ctx.fillStyle = this.stripColour;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    protected drawCrowns(ctx: CanvasRenderingContext2D): void {
        for (const data of this.crownData.values()) {
            ctx.fillStyle = this.crownColour;
            ctx.beginPath();
            ctx.moveTo(data.points[0].x, data.points[0].y);
            for (let i = 1; i < data.points.length; i++) {
                ctx.lineTo(data.points[i].x, data.points[i].y);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    protected getFaceLabel(face: number): string {
        return String(face);
    }

    protected drawFaceNumber(
        ctx: CanvasRenderingContext2D,
        value: number,
        x: number,
        y: number,
        fontPx: number,
        fontFamily: string,
        colour: string,
        underlineColour: string,
    ): void {
        const valueStr = this.getFaceLabel(value);
        ctx.fillStyle = colour;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${this.fontWeight} ${fontPx}px ${fontFamily}`;

        if (valueStr.length > 1) {
            // tighten double-digit faces manually as the CSS property doesn't do it
            const letterSpacing = -fontPx * 0.1;
            const totalWidth =
                ctx.measureText(valueStr).width + letterSpacing * (valueStr.length - 1);
            let offsetX = x - totalWidth / 2;
            for (const ch of valueStr) {
                offsetX += ctx.measureText(ch).width / 2;
                ctx.fillText(ch, offsetX, y);
                offsetX += ctx.measureText(ch).width / 2 + letterSpacing;
            }
        } else {
            ctx.fillText(valueStr, x, y);
        }

        // underline 6 and 9 to distinguish them
        if (value === 6 || value === 9) {
            ctx.fillStyle = underlineColour;
            const underlineWidth = fontPx * 0.4;
            const underlineHeight = Math.max(2, fontPx * 0.04);
            const underlineOffset = fontPx * 0.4;
            const radius = underlineHeight / 2;
            ctx.beginPath();
            ctx.roundRect(
                x - underlineWidth / 2,
                y + underlineOffset,
                underlineWidth,
                underlineHeight,
                radius,
            );
            ctx.fill();
        }
    }

    protected buildFaceLayout(): void {}
    protected calculateCrownPoints(_vertex: number): Point[] {
        return [];
    }
    protected calculateFacePoints(_face: number): Point[] {
        return [];
    }
    protected decorateCrowns(_ctx: CanvasRenderingContext2D): void {}
    protected decorateFaces(_ctx: CanvasRenderingContext2D): void {}
    protected decorateStrips(_ctx: CanvasRenderingContext2D): void {}
    protected drawFaces(_ctx: CanvasRenderingContext2D): void {}
    protected get2DEdgeIndex(_face: number, _adjFace: number): number {
        return -1;
    }
    protected getFaceHeight(): number {
        return 1.0;
    }
    protected getShapeFontScale(): number {
        return 1.0;
    }
}

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

export function TemplateMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        protected faceColour = "#ffffff";
        protected stripColour = "#f8f8f8";
        protected crownColour = "#f0f0f0";
        protected numberColour = "#e8e8e8";
        protected underlineColour = "#e8e8e8";
    };
}

export function DebugMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        protected override get pixelDensity(): number {
            return 200;
        }
        protected faceColour = "#f0f0f0";
        protected stripColour = "#ffffff";
        protected crownColour = "#ffffff";
        protected numberColour = "#000000";
        protected underlineColour = "#000000";
        protected fontFamily =
            "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif";
        protected fontWeight = 200;

        private stripColourIndex = new Map<string, number>();
        private nextStripColour = 0;

        private getStripColourIndex(key: string): number {
            const index = this.stripColourIndex.get(key);
            if (index === undefined) {
                const newIndex = this.nextStripColour++;
                this.stripColourIndex.set(key, newIndex);
                return newIndex;
            }
            return index;
        }

        protected getStripColour(faceA: number, faceB: number): string {
            const key = `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
            return this.getDebugColour(this.getStripColourIndex(key)).hex;
        }

        protected getStripColourName(faceA: number, faceB: number): string {
            const key = `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
            return this.getDebugColour(this.getStripColourIndex(key)).name;
        }

        protected getCrownColour(vertex: number): string {
            return this.getDebugColour(vertex).hex;
        }

        protected getCrownColourName(vertex: number): string {
            return this.getDebugColour(vertex).name;
        }

        protected override decorateStrips(ctx: CanvasRenderingContext2D): void {
            for (const [key, data] of this.stripData) {
                const [faceA, faceB] = key.split(",").map(Number);
                const [p1, p2, p3, p4] = data.points;

                ctx.strokeStyle = this.getStripColour(faceA, faceB);
                ctx.lineWidth = 0.03 * this.pixelDensity;

                const offsetRatio = this.stripWidth / this.edgeLength;
                const innerMidX = (p1.x + p2.x) / 2;
                const innerMidY = (p1.y + p2.y) / 2;
                const outerMidX = (p3.x + p4.x) / 2;
                const outerMidY = (p3.y + p4.y) / 2;
                const innerX = innerMidX + offsetRatio * (p1.x - innerMidX);
                const innerY = innerMidY + offsetRatio * (p1.y - innerMidY);
                const outerX = outerMidX + offsetRatio * (p3.x - outerMidX);
                const outerY = outerMidY + offsetRatio * (p3.y - outerMidY);
                ctx.beginPath();
                ctx.moveTo(innerX, innerY);
                ctx.lineTo(outerX, outerY);
                ctx.stroke();
            }
        }

        protected override decorateCrowns(ctx: CanvasRenderingContext2D): void {
            for (const [vertex, data] of this.crownData) {
                ctx.fillStyle = this.getCrownColour(vertex);
                ctx.beginPath();
                ctx.moveTo(data.points[0].x, data.points[0].y);
                for (let i = 1; i < data.points.length; i++) {
                    ctx.lineTo(data.points[i].x, data.points[i].y);
                }
                ctx.closePath();
                ctx.fill();
            }
        }

        protected override decorateFaces(ctx: CanvasRenderingContext2D): void {
            for (const { value: face } of this.faces) {
                const data = this.faceData.get(face);
                if (!data) continue;
                const pts = data.points;
                const n = pts.length;

                const centreX = pts.reduce((sum, p) => sum + p.x, 0) / n;
                const centreY = pts.reduce((sum, p) => sum + p.y, 0) / n;

                ctx.lineWidth = 0.03 * this.pixelDensity;

                for (const adjFace of this.getAdjacentFaces(face)) {
                    ctx.strokeStyle = this.getStripColour(face, adjFace);
                    const edgeIdx = this.get2DEdgeIndex(face, adjFace);
                    const edgePt = pts[edgeIdx];
                    const startX = centreX + 0.5 * (edgePt.x - centreX);
                    const startY = centreY + 0.5 * (edgePt.y - centreY);
                    const midX = (pts[edgeIdx].x + pts[(edgeIdx + 1) % n].x) / 2;
                    const midY = (pts[edgeIdx].y + pts[(edgeIdx + 1) % n].y) / 2;
                    const offsetRatio = this.stripWidth / this.edgeLength;
                    const toX = midX + offsetRatio * (edgePt.x - midX);
                    const toY = midY + offsetRatio * (edgePt.y - midY);
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(toX, toY);
                    ctx.stroke();
                }

                const faceVerts = this.faceVertices[face];
                for (let i = 0; i < n; i++) {
                    const vertex = faceVerts[i];
                    ctx.strokeStyle = this.getCrownColour(vertex);
                    const cornerPt = pts[i];
                    const endX = cornerPt.x + 0.3 * (centreX - cornerPt.x);
                    const endY = cornerPt.y + 0.3 * (centreY - cornerPt.y);
                    ctx.beginPath();
                    ctx.moveTo(cornerPt.x, cornerPt.y);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                }
            }
        }
    };
}
