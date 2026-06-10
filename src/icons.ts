import {
    AudioLines,
    Brain,
    Droplet,
    Flame,
    FlaskRound,
    Hammer,
    NavigationOff,
    ShieldUser,
    ShieldX,
    Skull,
    Snowflake,
    Sparkle,
    Sword,
    Target,
    Zap,
} from "lucide";

type IconElement = [string, Record<string, string>];
type IconData = IconElement[];

const ICONS: Record<string, IconData> = {
    "audio-lines": AudioLines as IconData,
    brain: Brain as IconData,
    droplet: Droplet as IconData,
    flame: Flame as IconData,
    "flask-round": FlaskRound as IconData,
    hammer: Hammer as IconData,
    "navigation-off": NavigationOff as IconData,
    "shield-user": ShieldUser as IconData,
    "shield-x": ShieldX as IconData,
    skull: Skull as IconData,
    snowflake: Snowflake as IconData,
    sparkle: Sparkle as IconData,
    sword: Sword as IconData,
    target: Target as IconData,
    zap: Zap as IconData,
};

function drawIconPaths(
    ctx: CanvasRenderingContext2D,
    iconData: IconData,
    colour: string,
    lineWidth: number,
): void {
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [tag, attrs] of iconData) {
        if (tag === "path" && attrs.d) {
            const path = new Path2D(attrs.d);
            ctx.stroke(path);
        } else if (tag === "circle") {
            ctx.beginPath();
            ctx.arc(
                Number(attrs.cx),
                Number(attrs.cy),
                Number(attrs.r),
                0,
                Math.PI * 2,
            );
            ctx.stroke();
        } else if (tag === "line") {
            ctx.beginPath();
            ctx.moveTo(Number(attrs.x1), Number(attrs.y1));
            ctx.lineTo(Number(attrs.x2), Number(attrs.y2));
            ctx.stroke();
        } else if (tag === "polyline" && attrs.points) {
            const points = attrs.points.split(" ").map((p) => p.split(",").map(Number));
            ctx.beginPath();
            ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.stroke();
        } else if (tag === "rect") {
            const rx = Number(attrs.rx || 0);
            if (rx > 0) {
                ctx.beginPath();
                ctx.roundRect(
                    Number(attrs.x),
                    Number(attrs.y),
                    Number(attrs.width),
                    Number(attrs.height),
                    rx,
                );
                ctx.stroke();
            } else {
                ctx.strokeRect(
                    Number(attrs.x),
                    Number(attrs.y),
                    Number(attrs.width),
                    Number(attrs.height),
                );
            }
        }
    }
}

export function drawIcon(
    ctx: CanvasRenderingContext2D,
    iconName: string,
    x: number,
    y: number,
    size: number,
    colour: string,
    outlineColour?: string,
): void {
    const iconData = ICONS[iconName];
    if (!iconData) {
        return;
    }

    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);

    if (outlineColour) {
        drawIconPaths(ctx, iconData, outlineColour, 5);
    }
    drawIconPaths(ctx, iconData, colour, 2);

    ctx.restore();
}
