import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d20";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { KintsugiMixin } from "./kintsugi";
import { PrideMixin } from "./pride";
import { Unfoldable } from "./unfold";

export class D20Texture extends Unfoldable(DieTexture) {
    faces = FACES;
    vertices = VERTICES;
    faceVertices = FACE_VERTICES;
    bgColour = "#f08020";
    fgColour = "#1a1a1a";

    get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(3);
    }

    // triangles taper towards the apex, so the text appears over-scaled
    override getShapeFontScale(): number {
        return 0.75;
    }

    override getIconScale(): number {
        return 0.8 * (this.iconScale ?? 1);
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D20TemplateTexture extends TemplateMixin(D20Texture) {}
export class D20DebugTexture extends DebugMixin(D20Texture) {}
export class D20KintsugiTexture extends KintsugiMixin(D20Texture) {}
export class D20PrideTexture extends PrideMixin(D20Texture) {}
