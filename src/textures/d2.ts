import * as THREE from "three";
import { FACE_VERTICES, FACES, SEGMENTS, VERTICES } from "../bodies/d2";
import { drawIcon } from "../icons";
import { DieTexture, type TextureOptions } from "./dice";

// the coin texture is an atlas, not an unfolded net: two cap tiles side
// by side with the rim band along the bottom; the cylinder cap UVs are
// each a disc inscribed in the unit square, remapped into their tile
export const UV_REGIONS = {
    heads: { u: 0, v: 0, width: 0.5, height: 0.8 },
    tails: { u: 0.5, v: 0, width: 0.5, height: 0.8 },
    rim: { u: 0, v: 0.8, width: 1, height: 0.2 },
};

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 320;

// bimetallic like a pound coin: an inner disc within an outer ring, with
// a circle of beads inside the rim like a penny; fractions of cap radius
const INNER_DISC = 0.68;
const BEAD_RING = 0.9;
const BEAD_SIZE = 0.035;
const BEAD_COUNT = 36;

type CoinPalette = {
    ring: string;
    disc: string;
    bead?: string;
    rimLip?: string;
    groove?: string;
    icon: string;
    iconOutline?: string;
};

export class D2Texture extends DieTexture {
    faces = FACES;
    faceVertices = FACE_VERTICES;
    vertices = VERTICES;
    bgColour = "#C5C9D1";
    fgColour = "#4A4E57";
    ringColour = "#B49A57";

    get edgeLength(): number {
        return 2 * Math.sin(Math.PI / SEGMENTS) * this.pixelDensity;
    }

    getFaceIcon(face: number): string {
        return face === 2 ? "shield-user" : "shield-x";
    }

    constructor(options?: TextureOptions) {
        super();
        this.options = options;
        if (options) Object.assign(this, options);
    }

    drawAtlas(
        ctx: CanvasRenderingContext2D,
        rimColour: string,
        palette: CoinPalette,
    ): void {
        ctx.fillStyle = rimColour;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (const [face, region] of [
            [1, UV_REGIONS.heads],
            [2, UV_REGIONS.tails],
        ] as const) {
            const centreX = (region.u + region.width / 2) * CANVAS_WIDTH;
            const centreY = (region.v + region.height / 2) * CANVAS_HEIGHT;
            const radius = (region.height * CANVAS_HEIGHT) / 2;

            // the outer ring, covering the whole cap
            ctx.fillStyle = palette.ring;
            ctx.beginPath();
            ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
            ctx.fill();

            // the contrasting inner disc
            ctx.fillStyle = palette.disc;
            ctx.beginPath();
            ctx.arc(centreX, centreY, radius * INNER_DISC, 0, Math.PI * 2);
            ctx.fill();

            // a groove where the two metals join
            if (palette.groove) {
                ctx.strokeStyle = palette.groove;
                ctx.lineWidth = radius * 0.02;
                ctx.beginPath();
                ctx.arc(centreX, centreY, radius * INNER_DISC, 0, Math.PI * 2);
                ctx.stroke();
            }

            // the raised lip at the very edge of the face
            if (palette.rimLip) {
                ctx.strokeStyle = palette.rimLip;
                ctx.lineWidth = radius * 0.04;
                ctx.beginPath();
                ctx.arc(centreX, centreY, radius * 0.98, 0, Math.PI * 2);
                ctx.stroke();
            }

            // beading just inside the rim
            if (palette.bead) {
                for (let bead = 0; bead < BEAD_COUNT; bead++) {
                    const angle = (bead / BEAD_COUNT) * Math.PI * 2;
                    const beadX = centreX + radius * BEAD_RING * Math.cos(angle);
                    const beadY = centreY + radius * BEAD_RING * Math.sin(angle);
                    const beadRadius = radius * BEAD_SIZE;

                    const dome = ctx.createRadialGradient(
                        beadX,
                        beadY,
                        0,
                        beadX,
                        beadY,
                        beadRadius,
                    );
                    dome.addColorStop(0, palette.bead);
                    dome.addColorStop(1, palette.ring);
                    ctx.fillStyle = dome;
                    ctx.beginPath();
                    ctx.arc(beadX, beadY, beadRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            const iconSize = radius * INNER_DISC * 2 * 0.66 * this.getIconScale();
            drawIcon(
                ctx,
                this.getFaceIcon(face),
                centreX,
                centreY,
                iconSize,
                palette.icon,
                palette.iconOutline,
            );
        }
    }

    override async createCanvas(): Promise<HTMLCanvasElement> {
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        this.drawAtlas(ctx, this.ringColour, {
            ring: this.ringColour,
            disc: this.bgColour,
            icon: this.getIconColour(),
            iconOutline: this.getIconOutlineColour(),
        });

        return canvas;
    }

    async createBumpCanvas(): Promise<HTMLCanvasElement> {
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        this.drawAtlas(ctx, "#808080", {
            ring: "#808080",
            disc: "#808080",
            bead: "#ffffff",
            rimLip: "#e0e0e0",
            groove: "#5a5a5a",
            icon: "#f0f0f0",
        });

        return canvas;
    }

    async createRoughnessCanvas(): Promise<HTMLCanvasElement> {
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        const polished = "#737373";
        this.drawAtlas(ctx, polished, {
            ring: polished,
            disc: polished,
            icon: "#dddddd",
        });

        return canvas;
    }

    _bumpTexture?: THREE.CanvasTexture;
    _roughnessTexture?: THREE.CanvasTexture;

    async createBumpTexture(): Promise<THREE.CanvasTexture> {
        if (!this._bumpTexture) {
            const canvas = await this.createBumpCanvas();
            this._bumpTexture = this.createTextureFromCanvas(canvas);
            // height data, not colour: must not be SRGB-decoded
            this._bumpTexture.colorSpace = THREE.NoColorSpace;
        }
        return this._bumpTexture;
    }

    async createRoughnessTexture(): Promise<THREE.CanvasTexture> {
        if (!this._roughnessTexture) {
            const canvas = await this.createRoughnessCanvas();
            this._roughnessTexture = this.createTextureFromCanvas(canvas);
            // roughness data, not colour: must not be SRGB-decoded
            this._roughnessTexture.colorSpace = THREE.NoColorSpace;
        }
        return this._roughnessTexture;
    }
}
