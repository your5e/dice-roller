import { FACE_VERTICES } from "../bodies/d12";
import { DieTexture } from "./dice";

export class D12Texture extends DieTexture {
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#e6b800";
    protected edgeColour = "#e6b800";
    protected cornerColour = "#e6b800";
    protected numberColour = "#000000";
    protected underlineColour = "#000000";

    readonly width = 256;
    readonly height = 256;

    protected buildLayoutData(): void {}

    protected drawEdges(_ctx: CanvasRenderingContext2D): void {}
    protected drawCorners(_ctx: CanvasRenderingContext2D): void {}
    protected drawFaces(_ctx: CanvasRenderingContext2D): void {}

    async createCanvas(): Promise<HTMLCanvasElement> {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
        ctx.fillStyle = this.faceColour;
        ctx.fillRect(0, 0, this.width, this.height);
        return canvas;
    }
}

export class D12TemplateTexture extends D12Texture {
    protected faceColour = "#ffffff";
}

export class D12DebugTexture extends D12Texture {
    protected faceColour = "#f0f0f0";
}
