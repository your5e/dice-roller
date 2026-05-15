import { FACES, FACE_VERTICES, VERTICES } from "../bodies/d20";
import { DebugMixin, DieTexture, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

export class D20Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#e07000";
    protected stripColour = "#e07000";
    protected crownColour = "#e07000";

    get startRotation(): number {
        return 0;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(3);
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

export class D20TemplateTexture extends TemplateMixin(D20Texture) {}
export class D20DebugTexture extends DebugMixin(D20Texture) {}
