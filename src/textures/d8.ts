import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d8";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { Unfoldable } from "./unfold";

export class D8Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected bgColour = "#3366aa";
    protected fgColour = "#ffffff";

    get startRotation(): number {
        return 90;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * Math.SQRT2;
    }

    // triangles taper towards the apex, so the text appears over-scaled
    protected override getShapeFontScale(): number {
        return 0.75;
    }

    protected override getIconScale(): number {
        return 0.65 * (this.iconScale ?? 1);
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D8TemplateTexture extends TemplateMixin(D8Texture) {}

export class D8DebugTexture extends DebugMixin(D8Texture) {}
