import type { CrownData, DieTexture, FaceData, Point, StripData } from "./dice";

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

// Gilbert Baker 9-stripe pride flag colours (top to bottom)
const PRIDE_COLOURS = [
    "#cd66ff", // lavender (diversity)
    "#ff6599", // pink (sex)
    "#ff0000", // red (life)
    "#ff8e00", // orange (healing)
    "#ffff00", // yellow (sunlight)
    "#008e00", // green (nature)
    "#00c0c0", // turquoise (magic)
    "#400098", // indigo (serenity)
    "#8e008e", // violet (spirit)
];

export function PrideMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        numeralColour = "#000000";
        underlineColour = "#000000";
        numeralOutlineColour = "#ffffff";
        numberOutlineWidth = 0.03;

        override drawFaceBackground(
            ctx: CanvasRenderingContext2D,
            _face: number,
            data: FaceData,
        ): void {
            this.prideFill(ctx, data.points);
        }

        override drawStripBackground(
            ctx: CanvasRenderingContext2D,
            _key: string,
            data: StripData,
        ): void {
            this.prideFill(ctx, data.points);
        }

        override drawCrownBackground(
            ctx: CanvasRenderingContext2D,
            _vertex: number,
            data: CrownData,
        ): void {
            this.prideFill(ctx, data.points);
        }

        getPolygonInBand(
            corners: Point[],
            bandBottom: number,
            bandTop: number,
        ): Point[] {
            let poly = corners;
            poly = this.trimPolygonAtThreshold(poly, bandBottom, true);
            poly = this.trimPolygonAtThreshold(poly, bandTop, false);
            return poly;
        }

        trimPolygonAtThreshold(
            poly: Point[],
            threshold: number,
            keepAbove: boolean,
        ): Point[] {
            if (poly.length === 0) return [];

            const lat = (p: Point): number => {
                if (p.latitude === undefined) {
                    throw new Error("Point missing latitude");
                }
                return p.latitude;
            };

            const result: Point[] = [];

            for (let i = 0; i < poly.length; i++) {
                const curr = poly[i];
                const next = poly[(i + 1) % poly.length];

                const currLat = lat(curr);
                const nextLat = lat(next);

                const currInside = keepAbove
                    ? currLat >= threshold
                    : currLat <= threshold;
                const nextInside = keepAbove
                    ? nextLat >= threshold
                    : nextLat <= threshold;

                if (currInside) {
                    result.push(curr);
                }

                if (currInside !== nextInside) {
                    const t = (threshold - currLat) / (nextLat - currLat);
                    result.push({
                        x: curr.x + t * (next.x - curr.x),
                        y: curr.y + t * (next.y - curr.y),
                        latitude: threshold,
                    });
                }
            }

            return result;
        }

        prideFill(ctx: CanvasRenderingContext2D, corners: Point[]): void {
            const numBands = PRIDE_COLOURS.length;
            const boundaries = Array.from(
                { length: numBands + 1 },
                (_, i) => i / numBands,
            );

            for (let band = 0; band < numBands; band++) {
                const bandBottom = boundaries[band];
                const bandTop = boundaries[band + 1];
                const colour = PRIDE_COLOURS[numBands - 1 - band];

                const bandPoly = this.getPolygonInBand(corners, bandBottom, bandTop);
                if (bandPoly.length >= 3) {
                    ctx.fillStyle = colour;
                    ctx.beginPath();
                    ctx.moveTo(bandPoly[0].x, bandPoly[0].y);
                    for (let i = 1; i < bandPoly.length; i++) {
                        ctx.lineTo(bandPoly[i].x, bandPoly[i].y);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    };
}
