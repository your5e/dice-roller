import * as THREE from "three";
import { CubicBezierCurve, Vector2 } from "three";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { loadVarelaRound } from "../fonts/varela-round";
import { CHAMFER } from "../geometries/chamfer";
import {
    centroid2d,
    centroid3d,
    DEG_TO_RAD,
    perpendicular,
    pointInPolygon,
} from "../geometry";
import { drawAt } from "./spanning";
import type { UnfoldableTexture } from "./unfold";

export type TextureOptions = {
    bgColour?: string;
    fgColour?: string;
    faceColour?: string;
    stripColour?: string;
    crownColour?: string;
    numeralColour?: string;
    underlineColour?: string;
    icon?: string;
    iconColour?: string;
    iconScale?: number;
    seed?: number | string;
};

export type Point = { x: number; y: number; latitude?: number };
export type UV = { u: number; v: number };

export type FaceData = {
    points: Point[];
    uvs: UV[];
    rotation: number;
    paths: Record<number, number[]>;
};

export type StripData = {
    points: Point[];
    uvs: UV[];
    rotation: number;
    owner: number;
};

export type CrownData = {
    points: Point[];
    uvs: UV[];
    faceOrder?: number[];
    angles: number[];
    rotation: number;
};

export type EdgeTarget = {
    face: number;
    adjFace: number;
    t: number;
};

export type BezierSample = {
    point: Point;
    tangent: Point;
};

export type EdgeBezierData = {
    samples: BezierSample[];
    from: Point;
    to: Point;
    entryEase: Point;
    exitEase: Point;
    anchor: Point;
    mid1: Point;
    mid2: Point;
    isSymmetric: boolean;
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
    numeralColour: "rgba(255, 255, 255, 0.66)",
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
    options?: TextureOptions;

    static hashString(str: string): number {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
        }
        return hash >>> 0;
    }

    _prngState?: number;

    seededRandom(): number {
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

    _simplex?: SimplexNoise;

    get simplex(): SimplexNoise {
        if (!this._simplex) {
            this._simplex = new SimplexNoise({ random: () => this.seededRandom() });
        }
        return this._simplex;
    }

    findAllClosedLoops(): {
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

    closedLoopTargetKey(edge: string, t: number): string {
        return `${edge}@${t}`;
    }

    findNextLoop(state: ClosedLoopState): EdgeTarget[] | null {
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

    tryNextFace(
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

    abstract faceVertices: Record<number, number[]>;
    abstract vertices: THREE.Vector3[];
    abstract faces: { value: number }[];
    abstract get edgeLength(): number;
    abstract bgColour: string;
    abstract fgColour: string;
    faceColour?: string;
    stripColour?: string;
    crownColour?: string;
    numeralColour?: string;
    fgOutlineColour?: string;
    numeralOutlineColour?: string;
    numberOutlineWidth = 0.08;
    underlineColour?: string;
    iconColour?: string;
    iconOutlineColour?: string;
    fontFamily = "Varela Round, sans-serif";
    fontWeight = 400;
    fontSize = 1.2;
    faceData = new Map<number, FaceData>();
    stripData = new Map<string, StripData>();
    crownData = new Map<number, CrownData>();
    width = 0;
    height = 0;
    icon?: string;
    iconScale?: number;

    get pixelDensity(): number {
        return 100;
    }

    get stripWidth(): number {
        // the gap is chamfer * the distance between adjacent face centres
        const faceA = this.faces[0];
        const centreA = new THREE.Vector3();
        for (const vi of this.faceVertices[faceA.value]) {
            centreA.add(this.vertices[vi]);
        }
        centreA.divideScalar(this.faceVertices[faceA.value].length);

        const faceBValue = this.getAdjacentFaces(faceA.value)[0];
        const centreB = new THREE.Vector3();
        for (const vi of this.faceVertices[faceBValue]) {
            centreB.add(this.vertices[vi]);
        }
        centreB.divideScalar(this.faceVertices[faceBValue].length);

        return centreA.distanceTo(centreB) * CHAMFER * this.pixelDensity;
    }

    // the bevel between two adjacent faces is a parallelogram, in most cases
    // a rectangle (but on the d10 equator it is not)
    getStripOffset(faceA: number, faceB: number): { along: number; across: number } {
        const verts = this.faceVertices[faceA];
        const edgeIdx = this.get2DEdgeIndex(faceA, faceB);
        const v1 = this.vertices[verts[edgeIdx]];
        const v2 = this.vertices[verts[(edgeIdx + 1) % verts.length]];

        const centreA = centroid3d(
            this.faceVertices[faceA].map((vi) => this.vertices[vi]),
        );
        const centreB = centroid3d(
            this.faceVertices[faceB].map((vi) => this.vertices[vi]),
        );
        const end = centreB.sub(centreA).multiplyScalar(CHAMFER);

        const direction = v2.clone().sub(v1).normalize();
        const along = end.dot(direction);
        const across = end.sub(direction.multiplyScalar(along)).length();

        return {
            along: along * this.pixelDensity,
            across: across * this.pixelDensity,
        };
    }

    bevelEndAngle(face: number, neighbour: number, vertex: number): number {
        const shared = this.faceVertices[face].filter((v) =>
            this.faceVertices[neighbour].includes(v),
        );
        const other = shared.find((v) => v !== vertex);
        if (shared.length !== 2 || other === undefined || !shared.includes(vertex)) {
            throw new Error(
                `Faces ${face} and ${neighbour} do not share an edge at vertex ${vertex}`,
            );
        }

        const centreA = centroid3d(
            this.faceVertices[face].map((vi) => this.vertices[vi]),
        );
        const centreB = centroid3d(
            this.faceVertices[neighbour].map((vi) => this.vertices[vi]),
        );
        const end = centreB.sub(centreA);
        const edge = this.vertices[other].clone().sub(this.vertices[vertex]);

        const cos = edge.dot(end) / (edge.length() * end.length());
        return Math.acos(cos) / DEG_TO_RAD;
    }

    get margin(): number {
        return this.stripWidth * 1.5;
    }

    calculateStripPoints(faceA: number, faceB: number): Point[] {
        const stripFace = this.getStripPriorityFace(faceA, faceB);
        const otherFace = stripFace === faceA ? faceB : faceA;

        const points = this.calculateFacePoints(stripFace);
        const edgeIdx = this.get2DEdgeIndex(stripFace, otherFace);
        const pointCount = points.length;

        const p1 = points[edgeIdx];
        const p2 = points[(edgeIdx + 1) % pointCount];
        const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const direction = { x: (p2.x - p1.x) / length, y: (p2.y - p1.y) / length };
        const perp = perpendicular(p2.x - p1.x, p2.y - p1.y);
        const { along, across } = this.getStripOffset(stripFace, otherFace);
        const offset = {
            x: direction.x * along + perp.x * across,
            y: direction.y * along + perp.y * across,
        };

        return [
            p1,
            p2,
            { x: p2.x + offset.x, y: p2.y + offset.y },
            { x: p1.x + offset.x, y: p1.y + offset.y },
        ];
    }

    createTextureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    designData(): void {}

    async createCanvas(): Promise<HTMLCanvasElement> {
        this.designData();

        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        for (const [key, data] of this.stripData) {
            this.drawStripBackground(ctx, key, data);
        }
        for (const [vertex, data] of this.crownData) {
            this.drawCrownBackground(ctx, vertex, data);
        }
        for (const [face, data] of this.faceData) {
            this.drawFaceBackground(ctx, face, data);
        }
        for (const [key, data] of this.stripData) {
            this.drawStripGrain(ctx, key, data);
        }
        for (const [vertex, data] of this.crownData) {
            this.drawCrownGrain(ctx, vertex, data);
        }
        for (const [face, data] of this.faceData) {
            this.drawFaceGrain(ctx, face, data);
        }
        for (const [key, data] of this.stripData) {
            this.drawStripDecoration(ctx, key, data);
        }
        for (const [vertex, data] of this.crownData) {
            this.drawCrownDecoration(ctx, vertex, data);
        }
        for (const [face, data] of this.faceData) {
            this.drawFaceDecoration(ctx, face, data);
        }
        for (const [face, data] of this.faceData) {
            this.drawFaceIcon(ctx, face, data);
        }
        for (const [face, data] of this.faceData) {
            this.drawFaceNumeral(ctx, face, data);
        }
        for (const [key, data] of this.stripData) {
            this.drawStripFinish(ctx, key, data);
        }
        for (const [vertex, data] of this.crownData) {
            this.drawCrownFinish(ctx, vertex, data);
        }
        for (const [face, data] of this.faceData) {
            this.drawFaceFinish(ctx, face, data);
        }

        return canvas;
    }

    drawFaceBackground(
        _ctx: CanvasRenderingContext2D,
        _face: number,
        _data: FaceData,
    ): void {}
    drawStripGrain(
        _ctx: CanvasRenderingContext2D,
        _key: string,
        _data: StripData,
    ): void {}
    drawCrownGrain(
        _ctx: CanvasRenderingContext2D,
        _vertex: number,
        _data: CrownData,
    ): void {}
    drawFaceGrain(
        _ctx: CanvasRenderingContext2D,
        _face: number,
        _data: FaceData,
    ): void {}
    drawStripDecoration(
        _ctx: CanvasRenderingContext2D,
        _key: string,
        _data: StripData,
    ): void {}
    drawCrownDecoration(
        _ctx: CanvasRenderingContext2D,
        _vertex: number,
        _data: CrownData,
    ): void {}
    drawFaceDecoration(
        _ctx: CanvasRenderingContext2D,
        _face: number,
        _data: FaceData,
    ): void {}
    drawFaceIcon(
        _ctx: CanvasRenderingContext2D,
        _face: number,
        _data: FaceData,
    ): void {}
    drawFaceNumeral(
        _ctx: CanvasRenderingContext2D,
        _face: number,
        _data: FaceData,
    ): void {}
    drawStripFinish(
        _ctx: CanvasRenderingContext2D,
        _key: string,
        _data: StripData,
    ): void {}
    drawCrownFinish(
        _ctx: CanvasRenderingContext2D,
        _vertex: number,
        _data: CrownData,
    ): void {}
    drawFaceFinish(
        _ctx: CanvasRenderingContext2D,
        _face: number,
        _data: FaceData,
    ): void {}

    async createTexture(): Promise<THREE.CanvasTexture> {
        const cacheKey = `${this.constructor.name}:${optionsKey(this.options)}`;
        const cached = textureCache.get(cacheKey);
        if (cached) return cached;

        await loadVarelaRound();
        const canvas = await this.createCanvas();
        const texture = this.createTextureFromCanvas(canvas);
        textureCache.set(cacheKey, texture);

        return texture;
    }

    getDebugColour(index: number): { hex: string; name: string } {
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

    getFaceAtEdge(face: number, edgeIdx: number): number {
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

    stripKey(faceA: number, faceB: number): string {
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
        return data.uvs;
    }

    getCrownUV(faces: number[]): UV[] {
        const vertex = this.findCommonVertex(faces);
        if (vertex === null)
            throw new Error(`No common vertex for faces [${faces.join(", ")}]`);
        const data = this.crownData.get(vertex);
        if (!data) throw new Error(`No crown data for vertex ${vertex}`);
        if (!data.faceOrder) throw new Error(`No face order for vertex ${vertex}`);

        const { faceOrder } = data;
        return faces.map((f) => {
            const idx = faceOrder.indexOf(f);
            if (idx === -1) throw new Error(`Face ${f} not in crown ${vertex}`);
            return data.uvs[idx];
        });
    }

    getStripPriorityFace(faceA: number, faceB: number): number {
        const idxA = this.faces.findIndex((f) => f.value === faceA);
        const idxB = this.faces.findIndex((f) => f.value === faceB);
        return idxA < idxB ? faceA : faceB;
    }

    calculateStripUVs(
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

    getPolygonOffsets(
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

    drawStripBackground(
        ctx: CanvasRenderingContext2D,
        _key: string,
        data: StripData,
    ): void {
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

    drawCrownBackground(
        ctx: CanvasRenderingContext2D,
        _vertex: number,
        data: CrownData,
    ): void {
        ctx.fillStyle = this.crownColour ?? this.bgColour;
        ctx.beginPath();
        ctx.moveTo(data.points[0].x, data.points[0].y);
        for (let i = 1; i < data.points.length; i++) {
            ctx.lineTo(data.points[i].x, data.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
    }

    getFaceLabel(face: number): string {
        return String(face);
    }

    drawNumeral(
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

    buildFaceLayout(): void {}
    buildLayoutData(): void {}
    calculateCrownPoints(_vertex: number): Point[] {
        return [];
    }
    calculateFacePoints(_face: number): Point[] {
        return [];
    }
    get2DEdgeIndex(_face: number, _adjFace: number): number {
        return -1;
    }
    getFaceHeight(): number {
        return 1.0;
    }
    getShapeFontScale(): number {
        return 1.0;
    }

    getIconScale(): number {
        return 1.0 * (this.iconScale ?? 1);
    }

    getIconColour(): string {
        return this.iconColour ?? this.fgColour;
    }

    getIconOutlineColour(): string | undefined {
        return this.iconOutlineColour ?? this.fgOutlineColour;
    }

    getEdgeDirection(face: number, adjFace: number): Point {
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

    isEdgeReversed(face: number, otherFace: number): boolean {
        const faceVerts = this.faceVertices[face];
        const otherVerts = this.faceVertices[otherFace];

        const faceEdgeIdx = this.get2DEdgeIndex(face, otherFace);
        const otherEdgeIdx = this.get2DEdgeIndex(otherFace, face);

        const faceStartVert = faceVerts[faceEdgeIdx];
        const otherStartVert = otherVerts[otherEdgeIdx];

        return faceStartVert !== otherStartVert;
    }

    edgeTargetToCanvas(target: EdgeTarget): Point {
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

    stippleArea(
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

    computeEdgeBezierSamples(
        from: Point,
        to: Point,
        startEdgeDir: Point,
        endEdgeDir: Point,
        faceRadius: number,
        isSymmetric: boolean,
    ): EdgeBezierData {
        const outwardEntry = perpendicular(startEdgeDir.x, startEdgeDir.y);
        const entryPerp = { x: -outwardEntry.x, y: -outwardEntry.y };
        const outwardExit = perpendicular(endEdgeDir.x, endEdgeDir.y);
        const exitPerp = { x: -outwardExit.x, y: -outwardExit.y };

        const segLen = Math.hypot(to.x - from.x, to.y - from.y);
        const depthRatio = 0.3;
        const easeDepth = segLen * depthRatio;
        const entryEase = {
            x: from.x + entryPerp.x * easeDepth,
            y: from.y + entryPerp.y * easeDepth,
        };
        const exitEase = {
            x: to.x + exitPerp.x * easeDepth,
            y: to.y + exitPerp.y * easeDepth,
        };
        const anchor = {
            x: (entryEase.x + exitEase.x) / 2,
            y: (entryEase.y + exitEase.y) / 2,
        };
        const mid1 = {
            x: (entryEase.x + anchor.x) / 2,
            y: (entryEase.y + anchor.y) / 2,
        };
        const mid2 = {
            x: (anchor.x + exitEase.x) / 2,
            y: (anchor.y + exitEase.y) / 2,
        };

        const toVec = (p: Point) => new Vector2(p.x, p.y);
        const curves: CubicBezierCurve[] = isSymmetric
            ? [
                  new CubicBezierCurve(
                      toVec(from),
                      toVec(entryEase),
                      toVec(exitEase),
                      toVec(to),
                  ),
              ]
            : [
                  new CubicBezierCurve(
                      toVec(from),
                      toVec(entryEase),
                      toVec(mid1),
                      toVec(anchor),
                  ),
                  new CubicBezierCurve(
                      toVec(anchor),
                      toVec(mid2),
                      toVec(exitEase),
                      toVec(to),
                  ),
              ];

        const maxLength = faceRadius * 2;
        const relativeLength = Math.min(1, segLen / maxLength);
        const numSamples = Math.max(2, Math.floor(9 * relativeLength));
        const samples: BezierSample[] = [];
        const totalCurves = curves.length;
        for (let i = 0; i <= numSamples; i++) {
            const globalT = i / numSamples;
            const segmentFloat = globalT * totalCurves;
            const curveIdx = Math.min(Math.floor(segmentFloat), totalCurves - 1);
            const localT = segmentFloat - curveIdx;

            const point = curves[curveIdx].getPoint(localT);
            const tangent = curves[curveIdx].getTangent(localT);
            samples.push({
                point: { x: point.x, y: point.y },
                tangent: { x: tangent.x, y: tangent.y },
            });
        }

        return {
            samples,
            from,
            to,
            entryEase,
            exitEase,
            anchor,
            mid1,
            mid2,
            isSymmetric,
        };
    }

    debugDrawBezier(
        ctx: CanvasRenderingContext2D,
        data: EdgeBezierData,
        curveIndex: number,
    ): void {
        const { from, to, entryEase, exitEase, anchor, mid1, mid2, isSymmetric } = data;

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        if (isSymmetric) {
            ctx.bezierCurveTo(
                entryEase.x,
                entryEase.y,
                exitEase.x,
                exitEase.y,
                to.x,
                to.y,
            );
        } else {
            ctx.bezierCurveTo(
                entryEase.x,
                entryEase.y,
                mid1.x,
                mid1.y,
                anchor.x,
                anchor.y,
            );
            ctx.bezierCurveTo(mid2.x, mid2.y, exitEase.x, exitEase.y, to.x, to.y);
        }
        ctx.stroke();

        const debugColours =
            curveIndex % 2 === 0
                ? { edge: DEBUG_COLOURS[0].hex, ease: DEBUG_COLOURS[1].hex }
                : { edge: DEBUG_COLOURS[2].hex, ease: DEBUG_COLOURS[3].hex };

        ctx.strokeStyle = debugColours.ease;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(entryEase.x, entryEase.y);
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(exitEase.x, exitEase.y);
        ctx.stroke();

        ctx.fillStyle = debugColours.edge;
        ctx.beginPath();
        ctx.arc(from.x, from.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(to.x, to.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = debugColours.ease;
        ctx.beginPath();
        ctx.arc(entryEase.x, entryEase.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(exitEase.x, exitEase.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

export function TemplateMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        bgColour = "#ffffff";
        fgColour = "#e8e8e8";
        stripColour = "#f8f8f8";
        crownColour = "#f0f0f0";
    };
}

export function DebugMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        override get pixelDensity(): number {
            return 200;
        }
        bgColour = "#ffffff";
        fgColour = "#000000";
        faceColour = "#ffffff";
        stripColour = "#cccccc";
        fontFamily =
            "Inter, Roboto, 'Helvetica Neue', 'Arial Nova', 'Nimbus Sans', Arial, sans-serif";
        fontWeight = 200;

        stripColourIndex = new Map<string, number>();
        nextStripColour = 0;

        getStripColourIndex(key: string): number {
            const index = this.stripColourIndex.get(key);
            if (index === undefined) {
                const newIndex = this.nextStripColour++;
                this.stripColourIndex.set(key, newIndex);
                return newIndex;
            }
            return index;
        }

        getStripColour(faceA: number, faceB: number): string {
            const key = `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
            return this.getDebugColour(this.getStripColourIndex(key)).hex;
        }

        getStripColourName(faceA: number, faceB: number): string {
            const key = `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
            return this.getDebugColour(this.getStripColourIndex(key)).name;
        }

        getCrownColour(vertex: number): string {
            return this.getDebugColour(vertex).hex;
        }

        getCrownColourName(vertex: number): string {
            return this.getDebugColour(vertex).name;
        }

        override drawFaceDecoration(
            ctx: CanvasRenderingContext2D,
            face: number,
            data: FaceData,
        ): void {
            const faceVerts = this.faceVertices[face];
            const pts = data.points;
            const n = pts.length;

            const { x: centreX, y: centreY } = centroid2d(pts);

            const lineWidth = 0.03 * this.pixelDensity;

            for (const adjFace of this.getAdjacentFaces(face)) {
                // only draw once per edge
                if (face > adjFace) continue;

                const edgeIdx = this.get2DEdgeIndex(face, adjFace);
                const edgePt = pts[edgeIdx];
                const startX = centreX + 0.5 * (edgePt.x - centreX);
                const startY = centreY + 0.5 * (edgePt.y - centreY);
                const midX = (pts[edgeIdx].x + pts[(edgeIdx + 1) % n].x) / 2;
                const midY = (pts[edgeIdx].y + pts[(edgeIdx + 1) % n].y) / 2;
                const offsetRatio = this.stripWidth / this.edgeLength;
                const toX = midX + offsetRatio * (edgePt.x - midX);
                const toY = midY + offsetRatio * (edgePt.y - midY);

                // double the line length to cross to the adjacent face
                const dx = toX - startX;
                const dy = toY - startY;

                const colour = this.getStripColour(face, adjFace);
                drawAt(
                    ctx,
                    this as unknown as UnfoldableTexture & DieTexture,
                    face,
                    { x: startX, y: startY },
                    (ctx) => {
                        ctx.strokeStyle = colour;
                        ctx.lineWidth = lineWidth;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(2 * dx, 2 * dy);
                        ctx.stroke();
                    },
                );
            }

            for (let i = 0; i < n; i++) {
                const vertex = faceVerts[i];
                const cornerPt = pts[i];

                // line from inside face, towards corner, extending into crown
                const startX = cornerPt.x + 0.3 * (centreX - cornerPt.x);
                const startY = cornerPt.y + 0.3 * (centreY - cornerPt.y);
                const toCornerX = cornerPt.x - startX;
                const toCornerY = cornerPt.y - startY;
                const len = Math.hypot(toCornerX, toCornerY);

                // irregular crowns have a different distance per face, so
                // measure from this face's own crown corner
                const crownData = this.crownData.get(vertex);
                let extension = this.stripWidth;
                if (crownData?.faceOrder) {
                    const crownCentre = centroid2d(crownData.points);
                    const idx = crownData.faceOrder.indexOf(face);
                    const crownCorner = crownData.points[idx === -1 ? 0 : idx];
                    extension = Math.hypot(
                        crownCorner.x - crownCentre.x,
                        crownCorner.y - crownCentre.y,
                    );
                }
                const endDx = toCornerX + (toCornerX / len) * extension;
                const endDy = toCornerY + (toCornerY / len) * extension;

                const px = -toCornerY / len;
                const py = toCornerX / len;
                const halfWidth = lineWidth / 2;

                // taper the tip
                const taperLen = extension;
                const ux = toCornerX / len;
                const uy = toCornerY / len;
                const taperDx = endDx - ux * taperLen;
                const taperDy = endDy - uy * taperLen;

                const colour = this.getDebugColour(face).hex;

                drawAt(
                    ctx,
                    this as unknown as UnfoldableTexture & DieTexture,
                    face,
                    { x: startX, y: startY },
                    (ctx) => {
                        ctx.fillStyle = colour;
                        ctx.beginPath();
                        ctx.moveTo(px * halfWidth, py * halfWidth);
                        ctx.lineTo(taperDx + px * halfWidth, taperDy + py * halfWidth);
                        ctx.lineTo(endDx, endDy);
                        ctx.lineTo(taperDx - px * halfWidth, taperDy - py * halfWidth);
                        ctx.lineTo(-px * halfWidth, -py * halfWidth);
                        ctx.closePath();
                        ctx.fill();

                        // thin line through centre for rotation debugging
                        ctx.strokeStyle = "#000000";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(endDx, endDy);
                        ctx.stroke();
                    },
                );
            }

            this.drawFaceIcon(ctx, face, data);
        }
    };
}
