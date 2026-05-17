import { FACES, FACE_VERTICES, VERTICES } from "../bodies/d4";
import { DebugMixin, DieTexture, TemplateMixin } from "./dice";
import type { Point } from "./dice";
import { Unfoldable } from "./unfold";

export class D4Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#33aa55";
    protected stripColour = "#33aa55";
    protected crownColour = "#33aa55";

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
                this.numberColour,
                this.underlineColour,
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

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class D4TemplateTexture extends TemplateMixin(D4Texture) {}
export class D4DebugTexture extends DebugMixin(D4Texture) {}
