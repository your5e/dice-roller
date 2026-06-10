import type { DieTexture, Point } from "./dice";

export function clipToPoints(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    callback: () => void,
): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.clip();
    callback();
    ctx.restore();
}

export function clipToFace(
    ctx: CanvasRenderingContext2D,
    texture: DieTexture,
    face: number,
    callback: () => void,
): void {
    const data = texture.faceData.get(face);
    if (!data) throw new Error(`No face data for face ${face}`);
    clipToPoints(ctx, data.points, callback);
}

export function clipToStrip(
    ctx: CanvasRenderingContext2D,
    texture: DieTexture,
    key: string,
    callback: () => void,
): void {
    const data = texture.stripData.get(key);
    if (!data) throw new Error(`No strip data for key ${key}`);
    clipToPoints(ctx, data.points, callback);
}

export function clipToCrown(
    ctx: CanvasRenderingContext2D,
    texture: DieTexture,
    vertex: number,
    callback: () => void,
): void {
    const data = texture.crownData.get(vertex);
    if (!data) throw new Error(`No crown data for vertex ${vertex}`);
    clipToPoints(ctx, data.points, callback);
}
