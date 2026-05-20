import { describe, expect, it } from "vitest";
import { getLabelStyles, type LabelStyle } from "../src/labels";

function getStyle(styles: Map<string, LabelStyle>, label: string): LabelStyle {
    const style = styles.get(label);
    if (!style) throw new Error(`No style for "${label}"`);
    return style;
}

describe("getLabelStyles", () => {
    describe("damage types", () => {
        it("returns colour and icon for fire", () => {
            const style = getStyle(getLabelStyles(["fire"]), "fire");
            expect(style.colour).toBe("#ffb800");
            expect(style.icon).toBe("flame");
        });

        it("returns colour and icon for cold", () => {
            const style = getStyle(getLabelStyles(["cold"]), "cold");
            expect(style.colour).toBe("#95e2fd");
            expect(style.icon).toBe("snowflake");
        });

        it("returns colour and icon for lightning", () => {
            const style = getStyle(getLabelStyles(["lightning"]), "lightning");
            expect(style.colour).toBe("#e8e0ff");
            expect(style.icon).toBe("zap");
        });

        it("returns colour and icon for thunder", () => {
            const style = getStyle(getLabelStyles(["thunder"]), "thunder");
            expect(style.colour).toBe("#8b7355");
            expect(style.icon).toBe("audio-lines");
        });

        it("returns colour and icon for acid", () => {
            const style = getStyle(getLabelStyles(["acid"]), "acid");
            expect(style.colour).toBe("#dfff00");
            expect(style.icon).toBe("flask-round");
        });

        it("returns colour and icon for poison", () => {
            const style = getStyle(getLabelStyles(["poison"]), "poison");
            expect(style.colour).toBe("#8b9a00");
            expect(style.icon).toBe("droplet");
        });

        it("returns colour and icon for necrotic", () => {
            const style = getStyle(getLabelStyles(["necrotic"]), "necrotic");
            expect(style.colour).toBe("#2a4a2a");
            expect(style.icon).toBe("skull");
        });

        it("returns colour and icon for radiant", () => {
            const style = getStyle(getLabelStyles(["radiant"]), "radiant");
            expect(style.colour).toBe("#fff5a0");
            expect(style.icon).toBe("sparkle");
        });

        it("returns colour and icon for force", () => {
            const style = getStyle(getLabelStyles(["force"]), "force");
            expect(style.colour).toBe("#d0e8e8");
            expect(style.icon).toBe("target");
        });

        it("returns colour and icon for psychic", () => {
            const style = getStyle(getLabelStyles(["psychic"]), "psychic");
            expect(style.colour).toBe("#e8a0b0");
            expect(style.icon).toBe("brain");
        });

        it("returns colour and icon for slashing", () => {
            const style = getStyle(getLabelStyles(["slashing"]), "slashing");
            expect(style.colour).toBe("#808080");
            expect(style.icon).toBe("sword");
        });

        it("returns colour and icon for piercing", () => {
            const style = getStyle(getLabelStyles(["piercing"]), "piercing");
            expect(style.colour).toBe("#808080");
            expect(style.icon).toBe("navigation-off");
        });

        it("returns colour and icon for bludgeoning", () => {
            const style = getStyle(getLabelStyles(["bludgeoning"]), "bludgeoning");
            expect(style.colour).toBe("#808080");
            expect(style.icon).toBe("hammer");
        });
    });

    describe("unknown labels", () => {
        it("returns a colour but no icon for unknown labels", () => {
            const style = getStyle(getLabelStyles(["banana"]), "banana");
            expect(style.colour).toMatch(/^#[0-9a-f]{6}$/);
            expect(style.icon).toBeUndefined();
        });

        it("returns a contrasting fgColour for unknown labels", () => {
            const style = getStyle(getLabelStyles(["banana"]), "banana");
            expect(style.fgColour).toMatch(/^#(000000|ffffff)$/);
        });

        it("returns consistent colour for the same label", () => {
            const styles = getLabelStyles(["banana"]);
            const style1 = getStyle(styles, "banana");
            const style2 = getStyle(styles, "banana");
            expect(style1.colour).toBe(style2.colour);
        });

        it("returns different colours for different labels", () => {
            const styles = getLabelStyles(["banana", "apple"]);
            expect(getStyle(styles, "banana").colour).not.toBe(getStyle(styles, "apple").colour);
        });

        it("reserves colour names for matching labels", () => {
            const styles = getLabelStyles(["bodge", "red", "blep"]);
            expect(getStyle(styles, "red").colour).toBe("#e6194b");
            expect(getStyle(styles, "bodge").colour).not.toBe("#e6194b");
            expect(getStyle(styles, "blep").colour).not.toBe("#e6194b");
        });

        it("assigns colours to unnamed labels, skipping reserved names", () => {
            const styles = getLabelStyles(["bodge", "blue", "red", "blep"]);
            expect(getStyle(styles, "red").colour).toBe("#e6194b");
            expect(getStyle(styles, "blue").colour).toBe("#4363d8");
            expect(getStyle(styles, "bodge").colour).toBe("#3cb44b");
            expect(getStyle(styles, "blep").colour).toBe("#ffe119");
        });
    });
});
