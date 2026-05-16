import { FACES, FACE_VERTICES, VERTICES } from "../bodies/d10";
import { DebugMixin, DieTexture, type Point, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

export class D10Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#E8DCC8";
    protected stripColour = "#E8DCC8";
    protected crownColour = "#E8DCC8";
    protected numberColour = "#1a1a1a";
    protected underlineColour = "#1a1a1a";

    get startRotation(): number {
        return 53.425;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * 1.5;
    }

    // d10 faces can't use the regular height calculation, so the number was hand-tuned
    protected override getFaceHeight(): number {
        return 1.35;
    }

    // numbers always point to the apex
    protected getTextRotation(
        _face: number,
        pts: Point[],
        centreX: number,
        centreY: number,
    ): number {
        const apex = pts[0];
        return Math.atan2(apex.y - centreY, apex.x - centreX) + Math.PI / 2;
    }

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class D10TemplateTexture extends TemplateMixin(D10Texture) {}
export class D10DebugTexture extends DebugMixin(D10Texture) {}
