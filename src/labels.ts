import { DEBUG_COLOURS } from "./textures/dice";

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

const colourNameToIndex = new Map<string, number>(
    DEBUG_COLOURS.map((c, i) => [c.name, i]),
);

export function isDamageLabel(label: string): boolean {
    return label in LABEL_STYLES;
}

function fgColourForHex(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 150 ? "#000000" : "#ffffff";
}

export function getLabelStyles(labels: string[]): Map<string, LabelStyle> {
    const result = new Map<string, LabelStyle>();
    const usedIndices = new Set<number>();

    // first pass: known damage types and colour names
    for (const label of labels) {
        const known = LABEL_STYLES[label];
        if (known) {
            result.set(label, known);
            continue;
        }
        const namedIndex = colourNameToIndex.get(label);
        if (namedIndex !== undefined) {
            const { hex } = DEBUG_COLOURS[namedIndex];
            result.set(label, { colour: hex, fgColour: fgColourForHex(hex) });
            usedIndices.add(namedIndex);
        }
    }

    // second pass: assign remaining labels to available slots
    let nextIndex = 0;
    for (const label of labels) {
        if (result.has(label)) continue;

        while (usedIndices.has(nextIndex) && nextIndex < DEBUG_COLOURS.length) {
            nextIndex++;
        }
        const index = nextIndex % DEBUG_COLOURS.length;
        const { hex } = DEBUG_COLOURS[index];
        result.set(label, { colour: hex, fgColour: fgColourForHex(hex) });
        usedIndices.add(index);
        nextIndex++;
    }

    return result;
}
