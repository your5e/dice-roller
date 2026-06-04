import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d12";
import { DEG_TO_RAD } from "../geometry";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { KintsugiMixin } from "./kintsugi";
import { PrideMixin } from "./pride";
import { Unfoldable } from "./unfold";

export class D12Texture extends Unfoldable(DieTexture) {
    faces = FACES;
    vertices = VERTICES;
    faceVertices = FACE_VERTICES;
    bgColour = "#e6b800";
    fgColour = "#1a1a1a";

    // this puts the first flower horizontal, not the first face
    get startRotation(): number {
        return 36;
    }

    get edgeLength(): number {
        return this.pixelDensity * 2 * Math.sin(36 * DEG_TO_RAD);
    }

    override getIconScale(): number {
        return 0.9 * (this.iconScale ?? 1);
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D12TemplateTexture extends TemplateMixin(D12Texture) {}
export class D12DebugTexture extends DebugMixin(D12Texture) {}
export class D12KintsugiTexture extends KintsugiMixin(D12Texture) {}
export class D12PrideTexture extends PrideMixin(D12Texture) {}
