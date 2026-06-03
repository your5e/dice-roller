import { FACE_VERTICES, FACES, VERTICES } from "../bodies/d6";
import { DebugMixin, DieTexture, TemplateMixin, type TextureOptions } from "./dice";
import { KintsugiMixin } from "./kintsugi";
import { Unfoldable } from "./unfold";

export class D6Texture extends Unfoldable(DieTexture) {
    faces = FACES;
    vertices = VERTICES;
    faceVertices = FACE_VERTICES;
    bgColour = "#cc3333";
    fgColour = "#ffffff";

    get startRotation(): number {
        return 0;
    }

    get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(2);
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
        this.buildLayoutData();
    }
}

export class D6TemplateTexture extends TemplateMixin(D6Texture) {}
export class D6DebugTexture extends DebugMixin(D6Texture) {}
export class D6KintsugiTexture extends KintsugiMixin(D6Texture) {}
