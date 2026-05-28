import {
    FACE_VERTICES,
    FACES,
    PERCENTILE_FACE_VERTICES,
    PERCENTILE_FACES,
    VERTICES,
} from "../bodies/d10";
import {
    DebugMixin,
    DieTexture,
    type Point,
    TemplateMixin,
    type TextureOptions,
} from "./dice";
import { KintsugiMixin } from "./kintsugi";
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

    protected override getIconScale(): number {
        return 0.9 * (this.iconScale ?? 1);
    }

    // numbers always point to the apex
    protected getTextRotation(
        _: number,
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
    protected bgColour = "#E8DCC8";
    protected fgColour = "#1a1a1a";

    protected getFaceLabel(face: number): string {
        return String(face % 10);
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D10TemplateTexture extends TemplateMixin(D10Texture) {}
export class D10DebugTexture extends DebugMixin(D10Texture) {}
export class D10KintsugiTexture extends KintsugiMixin(D10Texture) {}

export class DPercentileTexture extends DKiteTexture {
    protected faces = PERCENTILE_FACES;
    protected faceVertices = PERCENTILE_FACE_VERTICES;
    protected bgColour = "#3a3a3a";
    protected fgColour = "#E8DCC8";

    protected override getTextRotation(
        _: number,
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

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class DPercentileTemplateTexture extends TemplateMixin(DPercentileTexture) {}
export class DPercentileDebugTexture extends DebugMixin(DPercentileTexture) {}
export class DPercentileKintsugiTexture extends KintsugiMixin(DPercentileTexture) {}
