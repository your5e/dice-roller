import { FACES, FACE_VERTICES, VERTICES } from "../bodies/d8";
import { DebugMixin, DieTexture, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

export class D8Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#3366aa";
    protected stripColour = "#3366aa";
    protected crownColour = "#3366aa";

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

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class D8TemplateTexture extends TemplateMixin(D8Texture) {}

export class D8DebugTexture extends DebugMixin(D8Texture) {}
