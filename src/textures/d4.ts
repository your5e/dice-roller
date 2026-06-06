import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d4";
import type { FaceData } from "./dice";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { KintsugiMixin } from "./kintsugi";
import { PrideMixin } from "./pride";
import { Unfoldable } from "./unfold";

export class D4Texture extends Unfoldable(DieTexture) {
    faces = FACES;
    vertices = VERTICES;
    faceVertices = FACE_VERTICES;
    bgColour = "#2d9449";
    fgColour = "#ffffff";

    get oppositeVertex(): number {
        return 0;
    }

    get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(3);
    }

    // triangles taper towards the apex, so the text appears over-scaled
    override getShapeFontScale(): number {
        return 0.75;
    }

    override getIconScale(): number {
        return 0.5 * (this.iconScale ?? 1);
    }

    // a traditional d4 each face has three numbers, as they point to the apex
    // that would be "up"...
    override drawFaceNumeral(
        ctx: CanvasRenderingContext2D,
        face: number,
        data: FaceData,
    ): void {
        const points = data.points;
        const centreX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centreY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        const faceH = this.getFaceHeight();

        const fontScale = (faceH / 2.0) * this.getShapeFontScale();
        const fontPx = (this.pixelDensity * this.fontSize * fontScale) / 2;

        for (let i = 0; i < points.length; i++) {
            const point = points[i];

            ctx.save();
            ctx.translate(
                centreX + (point.x - centreX) * 0.5,
                centreY + (point.y - centreY) * 0.5,
            );
            ctx.rotate(Math.atan2(point.y - centreY, point.x - centreX) + Math.PI / 2);
            this.drawNumeral(
                ctx,
                this.getOppositeFace(this.faceVertices[face][i]),
                0,
                0,
                fontPx,
                this.fontFamily,
                this.numeralColour ?? this.fgColour,
                this.underlineColour ?? this.fgColour,
                this.icon ? (this.faceColour ?? this.bgColour) : undefined,
            );
            ctx.restore();
        }
    }

    // ...and that is functionally equivalent to treating the face that is
    // now "down" as the numbered face and reading the number from it
    // (which is how the face numbers are actually stored)
    getOppositeFace(vertexIndex: number): number {
        for (const f of this.faces) {
            if (!f.vertices.includes(vertexIndex)) {
                return f.value;
            }
        }
        throw new Error(`No opposite face found for vertex ${vertexIndex}`);
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D4TemplateTexture extends TemplateMixin(D4Texture) {}
export class D4DebugTexture extends DebugMixin(D4Texture) {}
export class D4KintsugiTexture extends KintsugiMixin(D4Texture) {}
export class D4PrideTexture extends PrideMixin(D4Texture) {}
