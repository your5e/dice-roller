import * as THREE from "three";

export type Point = { x: number; y: number };
export type UV = { u: number; v: number };

export type FaceData = {
    vertices: Point[];
    uvs: UV[];
};

export type EdgeData = {
    vertices: Point[];
    uvsByFace: Map<number, UV[]>;
};

export type CornerData = {
    vertices: Point[];
    uvs: UV[];
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
    protected abstract faceColour: string;
    protected abstract edgeColour: string;
    protected abstract cornerColour: string;
    protected numberColour = "#ffffff";
    protected underlineColour = "#ffffff";
    protected fontFamily = "Varela Round, sans-serif";
    protected fontSize = 0.6;
    private textureCache: { current: THREE.CanvasTexture | null } = { current: null };

    protected faceData = new Map<number, FaceData>();
    protected edgeData = new Map<string, EdgeData>();
    protected cornerData = new Map<number, CornerData>();

    abstract readonly width: number;
    abstract readonly height: number;

    protected abstract buildLayoutData(): void;

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

        this.drawEdges(ctx);
        this.decorateEdges(ctx);
        this.drawCorners(ctx);
        this.decorateCorners(ctx);
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

    findCommonVertex(faces: number[]): number | null {
        const vertSets = faces.map((f) => new Set(this.faceVertices[f]));
        for (const vx of vertSets[0]) {
            if (vertSets.every((s) => s.has(vx))) {
                return vx;
            }
        }
        return null;
    }

    protected edgeKey(faceA: number, faceB: number): string {
        return `${Math.min(faceA, faceB)},${Math.max(faceA, faceB)}`;
    }

    getFaceUV(face: number): UV[] {
        const data = this.faceData.get(face);
        if (!data) throw new Error(`No face data for face ${face}`);
        return data.uvs;
    }

    getEdgeUV(faceA: number, faceB: number): UV[] {
        const data = this.edgeData.get(this.edgeKey(faceA, faceB));
        if (!data) throw new Error(`No edge data for faces ${faceA}, ${faceB}`);
        const uvs = data.uvsByFace.get(faceA);
        if (!uvs) throw new Error(`No UVs for face ${faceA} on edge ${faceA}-${faceB}`);
        return uvs;
    }

    getCornerUV(faces: number[]): UV[] {
        const vertex = this.findCommonVertex(faces);
        if (vertex === null)
            throw new Error(`No common vertex for faces [${faces.join(", ")}]`);
        const data = this.cornerData.get(vertex);
        if (!data) throw new Error(`No corner data for vertex ${vertex}`);
        return data.uvs;
    }

    protected getTriangleOffsets(
        rotation: number,
        radius: number,
    ): { dx: number; dy: number }[] {
        const offsets: { dx: number; dy: number }[] = [];
        for (let i = 0; i < 3; i++) {
            const angle = ((rotation - i * 120) * Math.PI) / 180;
            offsets.push({
                dx: radius * Math.cos(angle),
                dy: radius * Math.sin(angle),
            });
        }
        return offsets;
    }

    protected abstract drawEdges(ctx: CanvasRenderingContext2D): void;
    protected decorateEdges(_ctx: CanvasRenderingContext2D): void {}
    protected abstract drawCorners(ctx: CanvasRenderingContext2D): void;
    protected decorateCorners(_ctx: CanvasRenderingContext2D): void {}
    protected abstract drawFaces(ctx: CanvasRenderingContext2D): void;
    protected decorateFaces(_ctx: CanvasRenderingContext2D): void {}

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
        ctx.fillStyle = colour;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `400 ${fontPx}px ${fontFamily}`;
        ctx.letterSpacing = value >= 10 ? `${-fontPx * 0.1}px` : "0px";
        ctx.fillText(String(value), x, y);

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
}
