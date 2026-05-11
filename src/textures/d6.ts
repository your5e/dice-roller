import { FACE_VERTICES } from "../bodies/d6";
import { DieTexture } from "./dice";

export class D6Texture extends DieTexture {
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#cc3333";
    protected edgeColour = "#cc3333";
    protected cornerColour = "#cc3333";

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

export class D6TemplateTexture extends D6Texture {
    protected faceColour = "#ffffff";
}

export class D6DebugTexture extends D6Texture {
    protected faceColour = "#f0f0f0";
}
