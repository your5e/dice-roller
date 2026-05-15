import { FACES, FACE_VERTICES, VERTICES } from "../bodies/d6";
import { DebugMixin, DieTexture, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

export class D6Texture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#cc3333";
    protected stripColour = "#cc3333";
    protected crownColour = "#cc3333";

    get startRotation(): number {
        return 0;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(2);
    }

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class D6TemplateTexture extends TemplateMixin(D6Texture) {}
export class D6DebugTexture extends DebugMixin(D6Texture) {}
