import { FACES, FACE_VERTICES, VERTICES } from "../bodies/d12";
import { DEG_TO_RAD } from "../geometry";
import { DebugMixin, DieTexture, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

export class D12Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#e6b800";
    protected stripColour = "#e6b800";
    protected crownColour = "#e6b800";

    // this puts the first flower horizontal, not the first face
    get startRotation(): number {
        return 36;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * 2 * Math.sin(36 * DEG_TO_RAD);
    }

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class D12TemplateTexture extends TemplateMixin(D12Texture) {}
export class D12DebugTexture extends DebugMixin(D12Texture) {}
