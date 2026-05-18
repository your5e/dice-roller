import { describe, expect, it } from "vitest";
import { getLabelStyle } from "../src/labels";

describe("getLabelStyle", () => {
    describe("damage types", () => {
        it("returns colour and icon for fire", () => {
            const style = getLabelStyle("fire");
            expect(style.colour).toBe("#e25822");
            expect(style.icon).toBe("flame");
        });

        it("returns colour and icon for cold", () => {
            const style = getLabelStyle("cold");
            expect(style.colour).toBe("#5bcefa");
            expect(style.icon).toBe("snowflake");
        });

        it("returns colour and icon for lightning", () => {
            const style = getLabelStyle("lightning");
            expect(style.colour).toBe("#f5e642");
            expect(style.icon).toBe("zap");
        });

        it("returns colour and icon for thunder", () => {
            const style = getLabelStyle("thunder");
            expect(style.colour).toBe("#7b68ee");
            expect(style.icon).toBe("volume-2");
        });

        it("returns colour and icon for acid", () => {
            const style = getLabelStyle("acid");
            expect(style.colour).toBe("#7fff00");
            expect(style.icon).toBe("flask-round");
        });

        it("returns colour and icon for poison", () => {
            const style = getLabelStyle("poison");
            expect(style.colour).toBe("#8b008b");
            expect(style.icon).toBe("skull");
        });

        it("returns colour and icon for necrotic", () => {
            const style = getLabelStyle("necrotic");
            expect(style.colour).toBe("#4a0a4a");
            expect(style.icon).toBe("bone");
        });

        it("returns colour and icon for radiant", () => {
            const style = getLabelStyle("radiant");
            expect(style.colour).toBe("#fffacd");
            expect(style.icon).toBe("sun");
        });

        it("returns colour and icon for force", () => {
            const style = getLabelStyle("force");
            expect(style.colour).toBe("#ff00ff");
            expect(style.icon).toBe("sparkles");
        });

        it("returns colour and icon for psychic", () => {
            const style = getLabelStyle("psychic");
            expect(style.colour).toBe("#ff69b4");
            expect(style.icon).toBe("brain");
        });

        it("returns colour and icon for slashing", () => {
            const style = getLabelStyle("slashing");
            expect(style.colour).toBe("#c0c0c0");
            expect(style.icon).toBe("sword");
        });

        it("returns colour and icon for piercing", () => {
            const style = getLabelStyle("piercing");
            expect(style.colour).toBe("#a0a0a0");
            expect(style.icon).toBe("locate");
        });

        it("returns colour and icon for bludgeoning", () => {
            const style = getLabelStyle("bludgeoning");
            expect(style.colour).toBe("#808080");
            expect(style.icon).toBe("hammer");
        });
    });

    describe("unknown labels", () => {
        it("returns a colour but no icon for unknown labels", () => {
            const style = getLabelStyle("banana");
            expect(style.colour).toMatch(/^#[0-9a-f]{6}$/);
            expect(style.icon).toBeUndefined();
        });

        it("returns consistent colour for the same label", () => {
            const style1 = getLabelStyle("banana");
            const style2 = getLabelStyle("banana");
            expect(style1.colour).toBe(style2.colour);
        });

        it("returns different colours for different labels", () => {
            const style1 = getLabelStyle("banana");
            const style2 = getLabelStyle("apple");
            expect(style1.colour).not.toBe(style2.colour);
        });
    });
});
