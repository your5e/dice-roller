import type { DieTexture, FaceData, Point } from "./dice";
import { drawAt } from "./spanning";
import type { UnfoldableTexture } from "./unfold";

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

export type Star = {
    x: number;
    y: number;
    radius: number;
    alpha: number;
};

export type Nebula = {
    x: number;
    y: number;
    face: number;
    radius: number;
    colour: string;
};

// rgb triples so the gradient stops can apply their own alpha
const NEBULA_COLOURS = [
    "98, 56, 168", // violet
    "142, 68, 173", // purple
    "75, 44, 145", // indigo
    "173, 59, 191", // magenta
];

export function NightSkyMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        bgColour = "#112351";
        fgColour = "#ffffff";
        numeralColour = "#ffffff";
        underlineColour = "#ffffff";
        numeralOutlineColour = "#000000";
        numberOutlineWidth = 0.06;

        // densities are per unit area, a unit being pixelDensity pixels square
        bandStarsPerUnitArea = 300;
        baseStarsPerUnitArea = 48;
        nebulaePerUnitArea = 6;
        bandHalfWidth = 0.07;
        shoulderWidth = 0.11;

        get baseDensity(): number {
            return this.baseStarsPerUnitArea / this.bandStarsPerUnitArea;
        }

        faceStars!: Map<number, Star[]>;
        stripStars!: Map<string, Star[]>;
        crownStars!: Map<number, Star[]>;
        nebulae!: Nebula[];

        override designData(): void {
            this.faceStars = new Map();
            this.stripStars = new Map();
            this.crownStars = new Map();
            for (const [face, data] of this.faceData) {
                this.faceStars.set(face, this.generateStars(data.points));
            }
            for (const [key, data] of this.stripData) {
                this.stripStars.set(key, this.generateStars(data.points));
            }
            for (const [vertex, data] of this.crownData) {
                this.crownStars.set(vertex, this.generateStars(data.points));
            }
            this.nebulae = this.generateNebulae();
        }

        bandProfile(latitude: number): number {
            const distance = Math.abs(latitude - 0.5);
            if (distance <= this.bandHalfWidth) return 1;

            const t = (distance - this.bandHalfWidth) / this.shoulderWidth;
            if (t >= 1) return this.baseDensity;

            const ramp = 1 - t * t * (3 - 2 * t);
            return this.baseDensity + (1 - this.baseDensity) * ramp;
        }

        generateStars(polygon: Point[]): Star[] {
            const unit = this.pixelDensity;
            return this.samplePoints(
                polygon,
                this.bandStarsPerUnitArea,
                (latitude) => this.bandProfile(latitude),
                (point) => {
                    // cubed so most stars are small, squared so most are dim
                    const size = this.seededRandom() ** 3;
                    return {
                        x: point.x,
                        y: point.y,
                        radius: unit * (0.006 + 0.024 * size),
                        alpha: 0.3 + 0.7 * this.seededRandom() ** 2,
                    };
                },
            );
        }

        generateNebulae(): Nebula[] {
            const unit = this.pixelDensity;
            const nebulae: Nebula[] = [];
            for (const [face, data] of this.faceData) {
                nebulae.push(
                    ...this.samplePoints(
                        data.points,
                        this.nebulaePerUnitArea,
                        (latitude) =>
                            (this.bandProfile(latitude) - this.baseDensity) /
                            (1 - this.baseDensity),
                        (point) => ({
                            x: point.x,
                            y: point.y,
                            face,
                            radius: unit * (0.35 + 0.4 * this.seededRandom()),
                            colour: NEBULA_COLOURS[
                                Math.floor(this.seededRandom() * NEBULA_COLOURS.length)
                            ],
                        }),
                    ),
                );
            }
            return nebulae;
        }

        regionStars<K>(starMap: Map<K, Star[]>, key: K): Star[] {
            const stars = starMap.get(key);
            if (!stars) throw new Error(`No stars generated for region ${key}`);
            return stars;
        }

        paintStars(ctx: CanvasRenderingContext2D, stars: Star[]): void {
            for (const star of stars) {
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        paintNebula(ctx: CanvasRenderingContext2D, nebula: Nebula): void {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.radius);
            gradient.addColorStop(0, `rgba(${nebula.colour}, 0.22)`);
            gradient.addColorStop(1, `rgba(${nebula.colour}, 0)`);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, nebula.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        override drawStripGrain(ctx: CanvasRenderingContext2D, key: string): void {
            this.paintStars(ctx, this.regionStars(this.stripStars, key));
        }

        override drawCrownGrain(ctx: CanvasRenderingContext2D, vertex: number): void {
            this.paintStars(ctx, this.regionStars(this.crownStars, vertex));
        }

        override drawFaceGrain(
            ctx: CanvasRenderingContext2D,
            face: number,
            _data: FaceData,
        ): void {
            for (const nebula of this.nebulae) {
                if (nebula.face !== face) continue;
                drawAt(
                    ctx,
                    this as unknown as UnfoldableTexture & DieTexture,
                    face,
                    nebula,
                    (ctx) => this.paintNebula(ctx, nebula),
                );
            }
            this.paintStars(ctx, this.regionStars(this.faceStars, face));
        }
    };
}
