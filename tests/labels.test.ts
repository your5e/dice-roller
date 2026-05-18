import { describe, expect, it } from "vitest";
import { getLabelStyle } from "../src/labels";

describe("getLabelStyle", () => {
    describe("damage types", () => {
        it("returns colour and icon for fire", () => {
            const style = getLabelStyle("fire");
            expect(style.colour).toBe("#ffb800");
            expect(style.icon).toBe("flame");
        });

        it("returns colour and icon for cold", () => {
            const style = getLabelStyle("cold");
            expect(style.colour).toBe("#95e2fd");
            expect(style.icon).toBe("snowflake");
        });

        it("returns colour and icon for lightning", () => {
            const style = getLabelStyle("lightning");
            expect(style.colour).toBe("#e8e0ff");
            expect(style.icon).toBe("zap");
        });

        it("returns colour and icon for thunder", () => {
            const style = getLabelStyle("thunder");
            expect(style.colour).toBe("#8b7355");
            expect(style.icon).toBe("audio-lines");
        });

        it("returns colour and icon for acid", () => {
            const style = getLabelStyle("acid");
            expect(style.colour).toBe("#dfff00");
            expect(style.icon).toBe("flask-round");
        });

        it("returns colour and icon for poison", () => {
            const style = getLabelStyle("poison");
            expect(style.colour).toBe("#8b9a00");
            expect(style.icon).toBe("droplet");
        });

        it("returns colour and icon for necrotic", () => {
            const style = getLabelStyle("necrotic");
            expect(style.colour).toBe("#2a4a2a");
            expect(style.icon).toBe("skull");
        });

        it("returns colour and icon for radiant", () => {
            const style = getLabelStyle("radiant");
            expect(style.colour).toBe("#fff5a0");
            expect(style.icon).toBe("sparkle");
        });

        it("returns colour and icon for force", () => {
            const style = getLabelStyle("force");
            expect(style.colour).toBe("#d0e8e8");
            expect(style.icon).toBe("target");
        });

        it("returns colour and icon for psychic", () => {
            const style = getLabelStyle("psychic");
            expect(style.colour).toBe("#e8a0b0");
            expect(style.icon).toBe("brain");
        });

        it("returns colour and icon for slashing", () => {
            const style = getLabelStyle("slashing");
            expect(style.colour).toBe("#808080");
            expect(style.icon).toBe("sword");
        });

        it("returns colour and icon for piercing", () => {
            const style = getLabelStyle("piercing");
            expect(style.colour).toBe("#808080");
            expect(style.icon).toBe("navigation-off");
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
