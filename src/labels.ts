export type LabelStyle = {
    colour: string;
    icon?: string;
};

const LABEL_STYLES: Record<string, LabelStyle> = {
    acid: { colour: "#7fff00", icon: "flask-round" },
    bludgeoning: { colour: "#808080", icon: "hammer" },
    cold: { colour: "#5bcefa", icon: "snowflake" },
    fire: { colour: "#e25822", icon: "flame" },
    force: { colour: "#ff00ff", icon: "sparkles" },
    lightning: { colour: "#f5e642", icon: "zap" },
    necrotic: { colour: "#4a0a4a", icon: "bone" },
    piercing: { colour: "#a0a0a0", icon: "locate" },
    poison: { colour: "#8b008b", icon: "skull" },
    psychic: { colour: "#ff69b4", icon: "brain" },
    radiant: { colour: "#fffacd", icon: "sun" },
    slashing: { colour: "#c0c0c0", icon: "sword" },
    thunder: { colour: "#7b68ee", icon: "volume-2" },
};

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function hashToColour(hash: number): string {
    const hue = hash % 360;
    const saturation = 50 + (hash % 30);
    const lightness = 40 + (hash % 20);
    return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const colour = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * colour)
            .toString(16)
            .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export function getLabelStyle(label: string): LabelStyle {
    const known = LABEL_STYLES[label];
    if (known) {
        return known;
    }
    return { colour: hashToColour(hashString(label)) };
}
