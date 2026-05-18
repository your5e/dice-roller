import {
    Astroid,
    AudioLines,
    AudioWaveform,
    Bone,
    Brain,
    Droplet,
    Flame,
    FlaskRound,
    Hammer,
    Locate,
    NavigationOff,
    Skull,
    Snowflake,
    Sparkle,
    Sparkles,
    Sun,
    Sword,
    Target,
    Volume2,
    Zap,
} from "lucide";

type IconElement = [string, Record<string, string>];
type IconData = IconElement[];

const ICONS: Record<string, IconData> = {
    astroid: Astroid as IconData,
    "audio-lines": AudioLines as IconData,
    "audio-waveform": AudioWaveform as IconData,
    bone: Bone as IconData,
    brain: Brain as IconData,
    droplet: Droplet as IconData,
    flame: Flame as IconData,
    "flask-round": FlaskRound as IconData,
    hammer: Hammer as IconData,
    locate: Locate as IconData,
    "navigation-off": NavigationOff as IconData,
    skull: Skull as IconData,
    snowflake: Snowflake as IconData,
    sparkle: Sparkle as IconData,
    sparkles: Sparkles as IconData,
    sun: Sun as IconData,
    sword: Sword as IconData,
    target: Target as IconData,
    "volume-2": Volume2 as IconData,
    zap: Zap as IconData,
};

export function drawIcon(
    ctx: CanvasRenderingContext2D,
    iconName: string,
    x: number,
    y: number,
    size: number,
    colour: string,
): void {
    const iconData = ICONS[iconName];
    if (!iconData) {
        return;
    }

    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);

    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
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

    ctx.restore();
}
