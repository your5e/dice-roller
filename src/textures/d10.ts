import {
    FACES,
    FACE_VERTICES,
    PERCENTILE_FACES,
    PERCENTILE_FACE_VERTICES,
    VERTICES,
} from "../bodies/d10";
import { DebugMixin, DieTexture, type Point, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

// base class for kite-faced dice (d10 and d%)
abstract class DKiteTexture extends Unfoldable(DieTexture) {
    protected vertices = VERTICES;

    get startRotation(): number {
        return 53.425;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * 1.5;
    }

    // kite faces can't use the regular height calculation, so the number was hand-tuned
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
}

export class D10Texture extends DKiteTexture {
    protected faces = FACES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#E8DCC8";
    protected stripColour = "#E8DCC8";
    protected crownColour = "#E8DCC8";
    protected numberColour = "#1a1a1a";
    protected underlineColour = "#1a1a1a";

    protected getFaceLabel(face: number): string {
        return String(face % 10);
    }

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class D10TemplateTexture extends TemplateMixin(D10Texture) {}
export class D10DebugTexture extends DebugMixin(D10Texture) {}

export class DPercentileTexture extends DKiteTexture {
    protected faces = PERCENTILE_FACES;
    protected faceVertices = PERCENTILE_FACE_VERTICES;
    protected faceColour = "#3a3a3a";
    protected stripColour = "#3a3a3a";
    protected crownColour = "#3a3a3a";
    protected numberColour = "#E8DCC8";
    protected underlineColour = "#E8DCC8";

    protected override getTextRotation(
        _face: number,
        pts: Point[],
        centreX: number,
        centreY: number,
    ): number {
        const apex = pts[0];
        return Math.atan2(apex.y - centreY, apex.x - centreX) + Math.PI;
    }

    protected getFaceLabel(face: number): string {
        return String(face % 100).padStart(2, "0");
    }

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class DPercentileTemplateTexture extends TemplateMixin(DPercentileTexture) {}
export class DPercentileDebugTexture extends DebugMixin(DPercentileTexture) {}
