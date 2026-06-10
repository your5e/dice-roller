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
import { NightSkyMixin } from "./nightsky";
import { PrideMixin } from "./pride";
import { Unfoldable } from "./unfold";

// base class for kite-faced dice (d10 and d%)
abstract class DKiteTexture extends Unfoldable(DieTexture) {
    vertices = VERTICES;

    get balanceVertex(): number {
        return 0;
    }

    get startRotation(): number {
        return 20;
    }

    get edgeLength(): number {
        return this.pixelDensity * 1.5;
    }

    // kite faces can't use the regular height calculation, so the number was hand-tuned
    override getFaceHeight(): number {
        return 1.35;
    }

    override getIconScale(): number {
        return 0.9 * (this.iconScale ?? 1);
    }

    // numbers always point to the apex
    getTextRotation(_: number, pts: Point[], centreX: number, centreY: number): number {
        const apex = pts[0];
        return Math.atan2(apex.y - centreY, apex.x - centreX) + Math.PI / 2;
    }
}

export class D10Texture extends DKiteTexture {
    faces = FACES;
    faceVertices = FACE_VERTICES;
    bgColour = "#E8DCC8";
    fgColour = "#1a1a1a";

    getFaceLabel(face: number): string {
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
export class D10NightSkyTexture extends NightSkyMixin(D10Texture) {}
export class D10PrideTexture extends PrideMixin(D10Texture) {}

export class DPercentileTexture extends DKiteTexture {
    faces = PERCENTILE_FACES;
    faceVertices = PERCENTILE_FACE_VERTICES;
    bgColour = "#3a3a3a";
    fgColour = "#E8DCC8";

    override getTextRotation(
        _: number,
        pts: Point[],
        centreX: number,
        centreY: number,
    ): number {
        const apex = pts[0];
        return Math.atan2(apex.y - centreY, apex.x - centreX) + Math.PI;
    }

    getFaceLabel(face: number): string {
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
export class DPercentileNightSkyTexture extends NightSkyMixin(DPercentileTexture) {}
export class DPercentilePrideTexture extends PrideMixin(DPercentileTexture) {}
