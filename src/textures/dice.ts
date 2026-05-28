import * as THREE from "three";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { CHAMFER } from "../geometries/chamfer";
import { perpendicular, pointInPolygon } from "../geometry";

export type TextureOptions = {
    bgColour?: string;
    fgColour?: string;
    faceColour?: string;
    stripColour?: string;
    crownColour?: string;
    numberColour?: string;
    underlineColour?: string;
    icon?: string;
    iconColour?: string;
    iconScale?: number;
    seed?: number | string;
};

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

export type EdgeTarget = {
    face: number;
    adjFace: number;
    t: number;
};

export type ClosedLoopState = {
    usedEdges: Set<string>;
    usedTargets: Set<string>;
    faceVisitCount: Map<number, number>;
    allEdges: Array<{ face: number; adjFace: number }>;
    edgeConnections: Map<string, number[]>;
};

export const FIXED_T_VALUES = [0.25, 0.5, 0.75] as const;

// colours from "List of 20 Simple, Distinct Colors" by Sasha Trubetskoy
// https://sashamaps.net/docs/resources/20-colors/
export const DEBUG_COLOURS: { hex: string; name: string }[] = [
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

export const GHOST_COLOURS: TextureOptions = {
    faceColour: "transparent",
    stripColour: "rgba(255, 255, 255, 0.66)",
    crownColour: "rgba(255, 255, 255, 0.66)",
    numberColour: "rgba(255, 255, 255, 0.66)",
    iconColour: "rgba(255, 255, 255, 0.33)",
};

const textureCache = new Map<string, THREE.CanvasTexture>();

function optionsKey(options?: TextureOptions): string {
    if (!options || Object.keys(options).length === 0) return "";
    const sorted = Object.keys(options)
        .sort()
        .reduce(
            (obj, key) => {
                obj[key] = options[key as keyof TextureOptions];
                return obj;
            },
            {} as Record<string, unknown>,
        );
    return JSON.stringify(sorted);
}

export abstract class DieTexture {
    protected options?: TextureOptions;

    private static hashString(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    private _prngState?: number;

    protected seededRandom(): number {
        if (this._prngState === undefined) {
            if (this.options?.seed === undefined) {
                throw new Error("Texture requires a seed for seededRandom");
            }
            this._prngState =
                typeof this.options.seed === "string"
                    ? DieTexture.hashString(this.options.seed)
                    : this.options.seed;
        }
        this._prngState = (this._prngState + 0x6d2b79f5) | 0;
        let t = Math.imul(
            this._prngState ^ (this._prngState >>> 15),
            1 | this._prngState,
        );
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    private _simplex?: SimplexNoise;

    protected get simplex(): SimplexNoise {
        if (!this._simplex) {
            this._simplex = new SimplexNoise({ random: () => this.seededRandom() });
        }
        return this._simplex;
    }

    protected findAllClosedLoops(): {
        loops: EdgeTarget[][];
        edgeConnections: Map<string, number[]>;
    } {
        const allEdges: Array<{ face: number; adjFace: number }> = [];
        for (const { value: face } of this.faces) {
            for (const adjFace of this.getAdjacentFaces(face)) {
                if (adjFace < face) continue;
                allEdges.push({ face, adjFace });
            }
        }

        const state: ClosedLoopState = {
            usedEdges: new Set(),
            usedTargets: new Set(),
            faceVisitCount: new Map(),
            allEdges,
            edgeConnections: new Map(),
        };

        const loops: EdgeTarget[][] = [];
        for (;;) {
            const loop = this.findNextLoop(state);
            if (!loop) break;
            loops.push(loop);
        }

        return { loops, edgeConnections: state.edgeConnections };
    }

    private closedLoopTargetKey(edge: string, t: number): string {
        return `${edge}@${t}`;
    }

    private findNextLoop(state: ClosedLoopState): EdgeTarget[] | null {
        const MAX_FACE_VISITS = 2;

        const getAvailableT = (edge: string) =>
            FIXED_T_VALUES.filter(
                (t) => !state.usedTargets.has(this.closedLoopTargetKey(edge, t)),
            );

        const availableEdges = state.allEdges.filter((e) => {
            if (state.usedEdges.has(this.stripKey(e.face, e.adjFace))) return false;
            const faceACount = state.faceVisitCount.get(e.face) ?? 0;
            const faceBCount = state.faceVisitCount.get(e.adjFace) ?? 0;
            return faceACount < MAX_FACE_VISITS && faceBCount < MAX_FACE_VISITS;
        });

        if (availableEdges.length === 0) return null;

        const startEdge =
            availableEdges[Math.floor(this.seededRandom() * availableEdges.length)];
        const startEdgeStr = this.stripKey(startEdge.face, startEdge.adjFace);

        const faceACount = state.faceVisitCount.get(startEdge.face) ?? 0;
        const faceBCount = state.faceVisitCount.get(startEdge.adjFace) ?? 0;
        let startFace: number;
        if (faceACount < faceBCount) {
            startFace = startEdge.face;
        } else if (faceBCount < faceACount) {
            startFace = startEdge.adjFace;
        } else {
            startFace = this.seededRandom() < 0.5 ? startEdge.face : startEdge.adjFace;
        }
        const firstFace =
            startFace === startEdge.face ? startEdge.adjFace : startEdge.face;

        const startAvailableT = getAvailableT(startEdgeStr);
        const startT =
            startAvailableT[Math.floor(this.seededRandom() * startAvailableT.length)];

        const walkEdges = new Set(state.usedEdges);
        const walkTargets = new Set(state.usedTargets);
        const walkFaces = new Map(state.faceVisitCount);
        const visitedInLoop = new Set<number>([firstFace]);

        walkEdges.add(startEdgeStr);
        walkTargets.add(this.closedLoopTargetKey(startEdgeStr, startT));
        walkFaces.set(firstFace, (walkFaces.get(firstFace) ?? 0) + 1);

        const loop: EdgeTarget[] = [{ face: startFace, adjFace: firstFace, t: startT }];
        const found = this.tryNextFace(
            loop,
            firstFace,
            startFace,
            visitedInLoop,
            walkEdges,
            walkTargets,
            walkFaces,
            MAX_FACE_VISITS,
        );

        if (!found) return null;

        const facesEntered = new Set<number>();
        for (const target of loop) {
            const edge = this.stripKey(target.face, target.adjFace);
            state.usedEdges.add(edge);
            state.usedTargets.add(this.closedLoopTargetKey(edge, target.t));
            facesEntered.add(target.adjFace);

            let points = state.edgeConnections.get(edge);
            if (!points) {
                points = [];
                state.edgeConnections.set(edge, points);
            }
            if (!points.includes(target.t)) {
                points.push(target.t);
            }
        }
        for (const face of facesEntered) {
            state.faceVisitCount.set(face, (state.faceVisitCount.get(face) ?? 0) + 1);
        }

        return loop;
    }

    private tryNextFace(
        loop: EdgeTarget[],
        currentFace: number,
        startFace: number,
        visitedInLoop: Set<number>,
        usedEdges: Set<string>,
        usedTargets: Set<string>,
        faceVisitCount: Map<number, number>,
        maxFaceVisits: number,
    ): boolean {
        const getAvailableT = (edge: string) =>
            FIXED_T_VALUES.filter(
                (t) => !usedTargets.has(this.closedLoopTargetKey(edge, t)),
            );

        const prevFace = loop[loop.length - 1].face;
        const allAdjacent = this.getAdjacentFaces(currentFace);

        const adjacentFaces = allAdjacent.filter((adj) => {
            if (adj === prevFace) return false;
            const edge = this.stripKey(currentFace, adj);
            if (getAvailableT(edge).length === 0) return false;
            if (adj === startFace) return true;
            if (visitedInLoop.has(adj)) return false;
            return (faceVisitCount.get(adj) ?? 0) < maxFaceVisits;
        });

        if (adjacentFaces.length === 0) {
            return false;
        }

        const shuffled = [...adjacentFaces];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(this.seededRandom() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (const nextFace of shuffled) {
            const nextEdgeStr = this.stripKey(currentFace, nextFace);
            const availableT = getAvailableT(nextEdgeStr);
            const t = availableT[Math.floor(this.seededRandom() * availableT.length)];

            usedEdges.add(nextEdgeStr);
            usedTargets.add(this.closedLoopTargetKey(nextEdgeStr, t));
            loop.push({ face: currentFace, adjFace: nextFace, t });

            if (nextFace === startFace) {
                return true;
            }

            faceVisitCount.set(nextFace, (faceVisitCount.get(nextFace) ?? 0) + 1);
            visitedInLoop.add(nextFace);

            const success = this.tryNextFace(
                loop,
                nextFace,
                startFace,
                visitedInLoop,
                usedEdges,
                usedTargets,
                faceVisitCount,
                maxFaceVisits,
            );

            if (success) {
                return true;
            }

            loop.pop();
            usedEdges.delete(nextEdgeStr);
            usedTargets.delete(this.closedLoopTargetKey(nextEdgeStr, t));
            faceVisitCount.set(nextFace, (faceVisitCount.get(nextFace) ?? 0) - 1);
            visitedInLoop.delete(nextFace);
        }

        return false;
    }

    protected abstract faceVertices: Record<number, number[]>;
    protected abstract faces: { value: number }[];
    protected abstract get edgeLength(): number;
    protected abstract bgColour: string;
    protected abstract fgColour: string;
    protected faceColour?: string;
    protected stripColour?: string;
    protected crownColour?: string;
    protected numberColour?: string;
    protected numberOutlineColour?: string;
    protected numberOutlineWidth = 0.08;
    protected underlineColour?: string;
    protected iconColour?: string;
    protected fontFamily = "Varela Round, sans-serif";
    protected fontWeight = 400;
    protected fontSize = 1.2;
    protected faceData = new Map<number, FaceData>();
    protected stripData = new Map<string, StripData>();
    protected crownData = new Map<number, CrownData>();
    public width = 0;
    public height = 0;
    protected icon?: string;
    protected iconScale?: number;

    protected get pixelDensity(): number {
        return 100;
    }
    protected get stripWidth(): number {
        return this.edgeLength * CHAMFER;
    }
    protected get margin(): number {
        return this.stripWidth * 1.5;
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

        this.drawStripBackground(ctx);
        this.decorateStripBackground(ctx);
        this.decorateStrips(ctx);
        this.drawCrowns(ctx);
        this.decorateCrowns(ctx);
        this.drawFaces(ctx);

        return canvas;
    }

    async createTexture(): Promise<THREE.CanvasTexture> {
        const cacheKey = `${this.constructor.name}:${optionsKey(this.options)}`;
        const cached = textureCache.get(cacheKey);
        if (cached) return cached;

        const canvas = await this.createCanvas();
        const texture = this.createTextureFromCanvas(canvas);
        textureCache.set(cacheKey, texture);

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
        _otherFace: number,
        stripFace: number,
    ): UV[] {
        const [inner1, inner2, outer2, outer1] = points;

        const reverseEdge = this.isEdgeReversed(requestingFace, stripFace);
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

    protected drawStripBackground(ctx: CanvasRenderingContext2D): void {
        for (const data of this.stripData.values()) {
            const [p1, p2, p3, p4] = data.points;
            ctx.fillStyle = this.stripColour ?? this.bgColour;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.fill();
        }
    }

    protected decorateStripBackground(_ctx: CanvasRenderingContext2D): void {}

    protected drawCrowns(ctx: CanvasRenderingContext2D): void {
        for (const data of this.crownData.values()) {
            ctx.fillStyle = this.crownColour ?? this.bgColour;
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
        outlineColour?: string,
    ): void {
        const valueStr = this.getFaceLabel(value);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${this.fontWeight} ${fontPx}px ${fontFamily}`;

        const drawChar = (ch: string, cx: number) => {
            if (outlineColour) {
                ctx.strokeStyle = outlineColour;
                ctx.lineWidth = fontPx * this.numberOutlineWidth;
                ctx.lineJoin = "round";
                ctx.strokeText(ch, cx, y);
            }
            ctx.fillStyle = colour;
            ctx.fillText(ch, cx, y);
        };

        if (valueStr.length > 1) {
            // tighten double-digit faces manually as the CSS property doesn't do it
            const letterSpacing = -fontPx * 0.1;
            const totalWidth =
                ctx.measureText(valueStr).width + letterSpacing * (valueStr.length - 1);
            let offsetX = x - totalWidth / 2;
            for (const ch of valueStr) {
                offsetX += ctx.measureText(ch).width / 2;
                drawChar(ch, offsetX);
                offsetX += ctx.measureText(ch).width / 2 + letterSpacing;
            }
        } else {
            drawChar(valueStr, x);
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

    protected getIconScale(): number {
        return 1.0 * (this.iconScale ?? 1);
    }

    protected getIconColour(): string {
        return this.iconColour ?? this.fgColour;
    }

    protected getEdgeDirection(face: number, adjFace: number): Point {
        const data = this.faceData.get(face);
        if (!data) throw new Error(`Unknown face ${face}`);

        const pts = data.points;
        const n = pts.length;
        const edgeIdx = this.get2DEdgeIndex(face, adjFace);
        const p1 = pts[edgeIdx];
        const p2 = pts[(edgeIdx + 1) % n];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);

        return { x: dx / len, y: dy / len };
    }

    protected isEdgeReversed(face: number, otherFace: number): boolean {
        const faceVerts = this.faceVertices[face];
        const otherVerts = this.faceVertices[otherFace];

        const faceEdgeIdx = this.get2DEdgeIndex(face, otherFace);
        const otherEdgeIdx = this.get2DEdgeIndex(otherFace, face);

        const faceStartVert = faceVerts[faceEdgeIdx];
        const otherStartVert = otherVerts[otherEdgeIdx];

        return faceStartVert !== otherStartVert;
    }

    protected edgeTargetToCanvas(target: EdgeTarget): Point {
        const data = this.faceData.get(target.face);
        if (!data) throw new Error(`Unknown face ${target.face}`);

        const pts = data.points;
        const n = pts.length;
        const edgeIdx = this.get2DEdgeIndex(target.face, target.adjFace);
        const p1 = pts[edgeIdx];
        const p2 = pts[(edgeIdx + 1) % n];

        const priorityFace = this.getStripPriorityFace(target.face, target.adjFace);
        const needsFlip =
            target.face !== priorityFace &&
            this.isEdgeReversed(target.face, priorityFace);
        const effectiveT = needsFlip ? 1 - target.t : target.t;

        return {
            x: p1.x + effectiveT * (p2.x - p1.x),
            y: p1.y + effectiveT * (p2.y - p1.y),
        };
    }

    protected stippleArea(
        ctx: CanvasRenderingContext2D,
        polygon: Point[],
        baseWidth: number,
        colour: { r: number; g: number; b: number },
        spacingMultiplier: number,
        sizeMultiplier: number,
    ): void {
        const noiseScale = 0.008;
        const dotRadius = baseWidth * 0.06 * sizeMultiplier;
        const spacing = baseWidth * 0.18 * spacingMultiplier;

        let minX = polygon[0].x;
        let maxX = polygon[0].x;
        let minY = polygon[0].y;
        let maxY = polygon[0].y;
        for (const p of polygon) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        const startX = Math.floor(minX / spacing) * spacing;
        const startY = Math.floor(minY / spacing) * spacing;

        for (let x = startX; x <= maxX; x += spacing) {
            for (let y = startY; y <= maxY; y += spacing) {
                if (!pointInPolygon({ x, y }, polygon)) continue;

                const noiseVal = this.simplex.noise(x * noiseScale, y * noiseScale);
                const density = (noiseVal + 1) / 2;

                if (this.seededRandom() > density * 0.8 + 0.2) continue;

                const jitterX = (this.seededRandom() - 0.5) * spacing * 0.8;
                const jitterY = (this.seededRandom() - 0.5) * spacing * 0.8;

                const brightness = 0.6 + this.seededRandom() * 0.4;
                const actualRadius = dotRadius * (0.6 + this.seededRandom() * 0.4);

                ctx.fillStyle = `rgba(${colour.r}, ${colour.g}, ${colour.b}, ${brightness})`;
                ctx.beginPath();
                ctx.arc(x + jitterX, y + jitterY, actualRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

export function TemplateMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        protected bgColour = "#ffffff";
        protected fgColour = "#e8e8e8";
        protected stripColour = "#f8f8f8";
        protected crownColour = "#f0f0f0";
    };
}

export function DebugMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        protected override get pixelDensity(): number {
            return 200;
        }
        protected bgColour = "#f0f0f0";
        protected fgColour = "#000000";
        protected stripColour = "#ffffff";
        protected crownColour = "#ffffff";
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

        protected drawFaceBackgroundDecoration(
            ctx: CanvasRenderingContext2D,
            face: number,
            pts: Point[],
        ): void {
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
            // biome-ignore lint/suspicious/noExplicitAny: mixin type limitation
            (this as any).drawFaceIcon(ctx, face, pts);
        }
    };
}
