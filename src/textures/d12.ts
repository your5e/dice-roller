import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d12";
import { DEG_TO_RAD } from "../geometry";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { Unfoldable } from "./unfold";

export class D12Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected bgColour = "#e6b800";
    protected fgColour = "#1a1a1a";

    // this puts the first flower horizontal, not the first face
    get startRotation(): number {
        return 36;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * 2 * Math.sin(36 * DEG_TO_RAD);
    }

    protected override getIconScale(): number {
        return 0.9 * (this.iconScale ?? 1);
    }

    constructor(options?: TextureOptions) {
        super();
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D12TemplateTexture extends TemplateMixin(D12Texture) {}
export class D12DebugTexture extends DebugMixin(D12Texture) {}
