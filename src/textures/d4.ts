import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d4";
import { drawIcon } from "../icons";
import type { Point } from "./dice";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { Unfoldable } from "./unfold";

export class D4Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected bgColour = "#2d9449";
    protected fgColour = "#ffffff";

    get startRotation(): number {
        return 0;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(3);
    }

    // triangles taper towards the apex, so the text appears over-scaled
    protected override getShapeFontScale(): number {
        return 0.75;
    }

    protected override getIconScale(): number {
        return 0.5 * (this.iconScale ?? 1);
    }

    protected drawFaceIcon(
        ctx: CanvasRenderingContext2D,
        face: number,
        points: Point[],
    ): void {
        if (!this.icon) return;

        const centreX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centreY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        const faceData = this.faces.find((f) => f.value === face);
        const apexIdx = (faceData?.stance ?? 0) + 2;
        const apex = points[apexIdx % points.length];
        const rotation = Math.atan2(apex.y - centreY, apex.x - centreX) + Math.PI / 2;
        const faceH = this.getFaceHeight();
        const iconSize = faceH * this.pixelDensity * 0.8 * this.getIconScale();

        ctx.save();
        ctx.translate(centreX, centreY);
        ctx.rotate(rotation);
        drawIcon(ctx, this.icon, 0, 0, iconSize, this.getIconColour());
        ctx.restore();
    }

    // a traditional d4 each face has three numbers, as they point to the apex
    // that would be "up"...
    protected drawFaceNumerals(
        ctx: CanvasRenderingContext2D,
        face: number,
        points: Point[],
    ): void {
        const centreX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centreY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        const faceH = this.getFaceHeight();

        // baseline: d6 square face, height = 2.0
        const fontScale = (faceH / 2.0) * this.getShapeFontScale();
        const fontPx = (this.pixelDensity * this.fontSize * fontScale) / 2;

        for (let i = 0; i < points.length; i++) {
            const point = points[i];

            // positioned 50% from centre toward vertex
            ctx.save();
            ctx.translate(
                centreX + (point.x - centreX) * 0.5,
                centreY + (point.y - centreY) * 0.5,
            );
            ctx.rotate(Math.atan2(point.y - centreY, point.x - centreX) + Math.PI / 2);
            this.drawFaceNumber(
                ctx,
                this.getOppositeFace(this.faceVertices[face][i]),
                0,
                0,
                fontPx,
                this.fontFamily,
                this.numberColour ?? this.fgColour,
                this.underlineColour ?? this.fgColour,
                this.icon ? (this.faceColour ?? this.bgColour) : undefined,
            );
            ctx.restore();
        }
    }

    // ...and that is functionally equivalent to treating the face that is
    // now "down" as the numbered face and reading the number from it
    // (which is how the face numbers are actually stored)
    private getOppositeFace(vertexIndex: number): number {
        for (const f of this.faces) {
            if (!f.vertices.includes(vertexIndex)) {
                return f.value;
            }
        }
        throw new Error(`No opposite face found for vertex ${vertexIndex}`);
    }

    constructor(options?: TextureOptions) {
        super();
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D4TemplateTexture extends TemplateMixin(D4Texture) {}
export class D4DebugTexture extends DebugMixin(D4Texture) {}
