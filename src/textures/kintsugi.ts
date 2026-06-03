import { findSharedVertex } from "../geometry";
import type {
    DieTexture,
    EdgeBezierData,
    EdgeTarget,
    FaceData,
    Point,
    StripData,
} from "./dice";

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

const DEBUG_BEZIERS = false;

export function KintsugiMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        bgColour = this.options?.bgColour ?? "#004225";
        fgColour = this.options?.fgColour ?? "#d4af37";
        numeralColour = this.options?.fgColour ?? "#ffffff";
        underlineColour = this.options?.fgColour ?? "#ffffff";
        numeralOutlineColour = "#996515";
        numberOutlineWidth = 0.03;

        repairColour = "#996515"; // darker gold base
        repairWidth = 3;

        loopData!: {
            loops: EdgeTarget[][];
            edgeConnections: Map<string, number[]>;
        };

        override designData(): void {
            this.loopData = this.findAllClosedLoops();
        }

        generateWidthMultipliers(numSegments: number): number[] {
            const multipliers: number[] = [];

            for (let i = 0; i < numSegments; i++) {
                let multiplier: number;
                if (i === 0 || i === numSegments - 1) {
                    multiplier = 1.0;
                } else {
                    multiplier = 0.5 + this.seededRandom() * 2.5;
                }
                multipliers.push(multiplier);
            }

            return multipliers;
        }

        override drawFaceGrain(
            ctx: CanvasRenderingContext2D,
            face: number,
            data: FaceData,
        ): void {
            const pts = data.points;
            const baseWidth = this.repairWidth * this.pixelDensity * 0.03;

            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            const centroid = {
                x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
                y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
            };
            const faceRadius = Math.hypot(pts[0].x - centroid.x, pts[0].y - centroid.y);

            let curveIndex = 0;
            for (const loop of this.loopData.loops) {
                for (let i = 0; i < loop.length; i++) {
                    const current = loop[i];
                    if (current.adjFace !== face) continue;

                    const next = loop[(i + 1) % loop.length];
                    const entryTarget: EdgeTarget = {
                        face: current.adjFace,
                        adjFace: current.face,
                        t: current.t,
                    };
                    const from = this.edgeTargetToCanvas(entryTarget);
                    const to = this.edgeTargetToCanvas(next);
                    const startEdgeDir = this.getEdgeDirection(face, current.face);
                    const endEdgeDir = this.getEdgeDirection(face, next.adjFace);
                    const entryEdgeIdx = this.get2DEdgeIndex(face, current.face);
                    const exitEdgeIdx = this.get2DEdgeIndex(face, next.adjFace);
                    const sharedVertex = findSharedVertex(
                        pts,
                        entryEdgeIdx,
                        exitEdgeIdx,
                    );
                    const isSymmetric = sharedVertex
                        ? Math.abs(
                              Math.hypot(
                                  from.x - sharedVertex.x,
                                  from.y - sharedVertex.y,
                              ) -
                                  Math.hypot(
                                      to.x - sharedVertex.x,
                                      to.y - sharedVertex.y,
                                  ),
                          ) < 1
                        : false;

                    const bezierData = this.computeEdgeBezierSamples(
                        from,
                        to,
                        startEdgeDir,
                        endEdgeDir,
                        faceRadius,
                        isSymmetric,
                    );
                    this.drawJitteredLine(ctx, bezierData, baseWidth, curveIndex);
                    curveIndex++;
                }
            }
        }

        override drawStripGrain(
            ctx: CanvasRenderingContext2D,
            key: string,
            data: StripData,
        ): void {
            const connectionPoints = this.loopData.edgeConnections.get(key);
            if (!connectionPoints) return;

            const baseWidth = this.repairWidth * this.pixelDensity * 0.03;
            const halfWidth = baseWidth * 0.5;

            const [p1, p2, p3, p4] = data.points;

            const edgeDx = p2.x - p1.x;
            const edgeDy = p2.y - p1.y;
            const edgeLen = Math.hypot(edgeDx, edgeDy);
            const perpX = edgeDx / edgeLen;
            const perpY = edgeDy / edgeLen;

            for (const t of connectionPoints) {
                const innerX = p1.x + t * (p2.x - p1.x);
                const innerY = p1.y + t * (p2.y - p1.y);
                const outerX = p4.x + t * (p3.x - p4.x);
                const outerY = p4.y + t * (p3.y - p4.y);

                const stripPolygon: Point[] = [
                    {
                        x: innerX + perpX * halfWidth,
                        y: innerY + perpY * halfWidth,
                    },
                    {
                        x: outerX + perpX * halfWidth,
                        y: outerY + perpY * halfWidth,
                    },
                    {
                        x: outerX - perpX * halfWidth,
                        y: outerY - perpY * halfWidth,
                    },
                    {
                        x: innerX - perpX * halfWidth,
                        y: innerY - perpY * halfWidth,
                    },
                ];

                this.fillRepairPolygon(ctx, stripPolygon, baseWidth);
            }
        }

        drawJitteredLine(
            ctx: CanvasRenderingContext2D,
            bezierData: EdgeBezierData,
            baseWidth: number,
            curveIndex: number,
        ): void {
            const { samples } = bezierData;

            const widths = this.generateWidthMultipliers(samples.length);
            const polygon: Point[] = [];
            for (let i = 0; i < samples.length; i++) {
                const { point, tangent } = samples[i];
                const perp = { x: -tangent.y, y: tangent.x };
                const w = baseWidth * widths[i] * 0.5;
                polygon.push({
                    x: point.x + perp.x * w,
                    y: point.y + perp.y * w,
                });
            }
            for (let i = samples.length - 1; i >= 0; i--) {
                const { point, tangent } = samples[i];
                const perp = { x: -tangent.y, y: tangent.x };
                const w = baseWidth * widths[i] * 0.5;
                polygon.push({
                    x: point.x - perp.x * w,
                    y: point.y - perp.y * w,
                });
            }

            this.fillRepairPolygon(ctx, polygon, baseWidth);

            if (DEBUG_BEZIERS) {
                this.debugDrawBezier(ctx, bezierData, curveIndex);
            }
        }

        fillRepairPolygon(
            ctx: CanvasRenderingContext2D,
            polygon: Point[],
            baseWidth: number,
        ): void {
            ctx.fillStyle = this.repairColour;
            ctx.beginPath();
            ctx.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
                ctx.lineTo(polygon[i].x, polygon[i].y);
            }
            ctx.closePath();
            ctx.fill();
            this.stippleArea(
                ctx,
                polygon,
                baseWidth,
                { r: 255, g: 223, b: 100 },
                0.7,
                1.0,
            );
            this.stippleArea(
                ctx,
                polygon,
                baseWidth,
                { r: 255, g: 255, b: 255 },
                3.0,
                2.0,
            );
        }
    };
}
