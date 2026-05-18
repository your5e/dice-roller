export type LabelStyle = {
    colour: string;
    fgColour?: string;
    iconColour?: string;
    iconScale?: number;
    icon?: string;
};

const LABEL_STYLES: Record<string, LabelStyle> = {
    acid: {
        colour: "#dfff00",
        fgColour: "#000000",
        iconColour: "#c0e000",
        icon: "flask-round",
    },
    bludgeoning: {
        colour: "#808080",
        fgColour: "#ffffff",
        iconColour: "#a0a0a0",
        icon: "hammer",
    },
    cold: {
        colour: "#95e2fd",
        fgColour: "#000000",
        iconColour: "#5bcefa",
        icon: "snowflake",
    },
    fire: {
        colour: "#ffb800",
        fgColour: "#000000",
        iconColour: "#ffffaa",
        icon: "flame",
    },
    force: {
        colour: "#d0e8e8",
        fgColour: "#000000",
        iconColour: "#a8d0d0",
        icon: "target",
    },
    lightning: {
        colour: "#e8e0ff",
        fgColour: "#000000",
        iconColour: "#c8c0e0",
        icon: "zap",
    },
    necrotic: {
        colour: "#2a4a2a",
        fgColour: "#ffffff",
        iconColour: "#6e886e",
        icon: "skull",
    },
    piercing: {
        colour: "#808080",
        fgColour: "#ffffff",
        iconColour: "#a0a0a0",
        iconScale: 0.8,
        icon: "navigation-off",
    },
    poison: {
        colour: "#8b9a00",
        fgColour: "#000000",
        iconColour: "#aebb40",
        icon: "droplet",
    },
    psychic: {
        colour: "#e8a0b0",
        fgColour: "#000000",
        iconColour: "#c080b0",
        icon: "brain",
    },
    radiant: {
        colour: "#fff5a0",
        fgColour: "#000000",
        iconColour: "#d4a000",
        icon: "sparkle",
    },
    slashing: {
        colour: "#808080",
        fgColour: "#ffffff",
        iconColour: "#a0a0a0",
        icon: "sword",
    },
    thunder: {
        colour: "#8b7355",
        fgColour: "#ffffff",
        iconColour: "#b3a086",
        icon: "audio-lines",
    },
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

function hslToHex(h: number, sPct: number, lPct: number): string {
    const s = sPct / 100;
    const l = lPct / 100;
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
