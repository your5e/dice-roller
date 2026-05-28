import { CubicBezierCurve, Vector2 } from "three";
import { findSharedVertex, perpendicular } from "../geometry";
import { DEBUG_COLOURS, type DieTexture, type EdgeTarget, type Point } from "./dice";

// biome-ignore lint/suspicious/noExplicitAny: mixin pattern requires any
type DieTextureConstructor = new (...args: any[]) => DieTexture;

const DEBUG_BEZIERS = false;

export function KintsugiMixin<T extends DieTextureConstructor>(Base: T) {
    // @ts-expect-error: mixin applied to concrete subclass, not abstract base
    return class extends Base {
        protected bgColour = this.options?.bgColour ?? "#004225";
        protected fgColour = this.options?.fgColour ?? "#d4af37";
        protected numberColour = this.options?.fgColour ?? "#ffffff";
        protected underlineColour = this.options?.fgColour ?? "#ffffff";
        protected numberOutlineColour = "#996515";
        protected numberOutlineWidth = 0.03;

        protected repairColour = "#996515"; // darker gold base
        protected repairWidth = 3;

        private loopData!: {
            loops: EdgeTarget[][];
            edgeConnections: Map<string, number[]>;
        };

        protected generateWidthMultipliers(numSegments: number): number[] {
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

        protected drawFaceBackgroundDecoration(
            ctx: CanvasRenderingContext2D,
            face: number,
            pts: Point[],
        ): void {
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

                    this.drawJitteredLine(
                        ctx,
                        from,
                        to,
                        faceRadius,
                        baseWidth,
                        startEdgeDir,
                        endEdgeDir,
                        isSymmetric,
                        curveIndex,
                    );
                    curveIndex++;
                }
            }
            // biome-ignore lint/suspicious/noExplicitAny: mixin type limitation
            (this as any).drawFaceIcon(ctx, face, pts);
        }

        private drawJitteredLine(
            ctx: CanvasRenderingContext2D,
            from: Point,
            to: Point,
            faceRadius: number,
            baseWidth: number,
            startEdgeDir: Point,
            endEdgeDir: Point,
            isSymmetric: boolean,
            curveIndex: number,
        ): void {
            const outwardEntry = perpendicular(startEdgeDir.x, startEdgeDir.y);
            const entryPerp = { x: -outwardEntry.x, y: -outwardEntry.y };
            const outwardExit = perpendicular(endEdgeDir.x, endEdgeDir.y);
            const exitPerp = { x: -outwardExit.x, y: -outwardExit.y };

            // "ease" control points allow the curve to come from the edge at 90
            // degrees, otherwise things take sharp corners
            const segLen = Math.hypot(to.x - from.x, to.y - from.y);
            const depthRatio = 0.3;
            const easeDepth = segLen * depthRatio;
            const entryEase = {
                x: from.x + entryPerp.x * easeDepth,
                y: from.y + entryPerp.y * easeDepth,
            };
            const exitEase = {
                x: to.x + exitPerp.x * easeDepth,
                y: to.y + exitPerp.y * easeDepth,
            };
            const toVec = (p: Point) => new Vector2(p.x, p.y);
            const anchor = {
                x: (entryEase.x + exitEase.x) / 2,
                y: (entryEase.y + exitEase.y) / 2,
            };
            const mid1 = {
                x: (entryEase.x + anchor.x) / 2,
                y: (entryEase.y + anchor.y) / 2,
            };
            const mid2 = {
                x: (anchor.x + exitEase.x) / 2,
                y: (anchor.y + exitEase.y) / 2,
            };
            const curves: CubicBezierCurve[] = isSymmetric
                ? [
                      new CubicBezierCurve(
                          toVec(from),
                          toVec(entryEase),
                          toVec(exitEase),
                          toVec(to),
                      ),
                  ]
                : [
                      new CubicBezierCurve(
                          toVec(from),
                          toVec(entryEase),
                          toVec(mid1),
                          toVec(anchor),
                      ),
                      new CubicBezierCurve(
                          toVec(anchor),
                          toVec(mid2),
                          toVec(exitEase),
                          toVec(to),
                      ),
                  ];

            const maxLength = faceRadius * 2;
            const relativeLength = Math.min(1, segLen / maxLength);
            const numSamples = Math.max(2, Math.floor(9 * relativeLength));
            const samples: { point: Point; tangent: Point }[] = [];
            const totalCurves = curves.length;
            for (let i = 0; i <= numSamples; i++) {
                const globalT = i / numSamples;
                const segmentFloat = globalT * totalCurves;
                const curveIdx = Math.min(Math.floor(segmentFloat), totalCurves - 1);
                const localT = segmentFloat - curveIdx;

                const point = curves[curveIdx].getPoint(localT);
                const tangent = curves[curveIdx].getTangent(localT);
                samples.push({
                    point: { x: point.x, y: point.y },
                    tangent: { x: tangent.x, y: tangent.y },
                });
            }

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

            ctx.fillStyle = this.repairColour;
            ctx.beginPath();
            ctx.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
                ctx.lineTo(polygon[i].x, polygon[i].y);
            }
            ctx.closePath();
            ctx.fill();
            this.drawAllStippling(ctx, polygon, baseWidth);

            if (DEBUG_BEZIERS) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                if (isSymmetric) {
                    ctx.bezierCurveTo(
                        entryEase.x,
                        entryEase.y,
                        exitEase.x,
                        exitEase.y,
                        to.x,
                        to.y,
                    );
                } else {
                    ctx.bezierCurveTo(
                        entryEase.x,
                        entryEase.y,
                        mid1.x,
                        mid1.y,
                        anchor.x,
                        anchor.y,
                    );
                    ctx.bezierCurveTo(
                        mid2.x,
                        mid2.y,
                        exitEase.x,
                        exitEase.y,
                        to.x,
                        to.y,
                    );
                }
                ctx.stroke();

                const debugColours =
                    curveIndex % 2 === 0
                        ? { edge: DEBUG_COLOURS[0].hex, ease: DEBUG_COLOURS[1].hex }
                        : { edge: DEBUG_COLOURS[2].hex, ease: DEBUG_COLOURS[3].hex };

                ctx.strokeStyle = debugColours.ease;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(entryEase.x, entryEase.y);
                ctx.moveTo(to.x, to.y);
                ctx.lineTo(exitEase.x, exitEase.y);
                ctx.stroke();

                ctx.fillStyle = debugColours.edge;
                ctx.beginPath();
                ctx.arc(from.x, from.y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(to.x, to.y, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = debugColours.ease;
                ctx.beginPath();
                ctx.arc(entryEase.x, entryEase.y, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(exitEase.x, exitEase.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        private drawAllStippling(
            ctx: CanvasRenderingContext2D,
            polygon: Point[],
            baseWidth: number,
        ): void {
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

        protected override decorateStripBackground(
            ctx: CanvasRenderingContext2D,
        ): void {
            this.loopData = this.findAllClosedLoops();

            const baseWidth = this.repairWidth * this.pixelDensity * 0.03;
            const halfWidth = baseWidth * 0.5;

            for (const [key, points] of this.loopData.edgeConnections) {
                const strip = this.stripData.get(key);
                if (!strip) continue;

                const [p1, p2, p3, p4] = strip.points;

                const edgeDx = p2.x - p1.x;
                const edgeDy = p2.y - p1.y;
                const edgeLen = Math.hypot(edgeDx, edgeDy);
                const perpX = edgeDx / edgeLen;
                const perpY = edgeDy / edgeLen;

                for (const t of points) {
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

                    ctx.fillStyle = this.repairColour;
                    ctx.beginPath();
                    ctx.moveTo(stripPolygon[0].x, stripPolygon[0].y);
                    ctx.lineTo(stripPolygon[1].x, stripPolygon[1].y);
                    ctx.lineTo(stripPolygon[2].x, stripPolygon[2].y);
                    ctx.lineTo(stripPolygon[3].x, stripPolygon[3].y);
                    ctx.closePath();
                    ctx.fill();
                    this.drawAllStippling(ctx, stripPolygon, baseWidth);
                }
            }
        }
    };
}
