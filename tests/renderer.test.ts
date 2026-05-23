import type * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createD4 } from "../src/geometries/d4";
import { createD6 } from "../src/geometries/d6";
import { createD8 } from "../src/geometries/d8";
import { createD10, createD100 } from "../src/geometries/d10";
import { createD12 } from "../src/geometries/d12";
import { createD20 } from "../src/geometries/d20";
import type { Die } from "../src/geometries/dice";
import { createTray } from "../src/physics/tray";
import { getTrayDimensions, removeDice } from "../src/renderer";
import { D4Texture } from "../src/textures/d4";
import { D6Texture } from "../src/textures/d6";
import { D8Texture } from "../src/textures/d8";
import { D10Texture, DPercentileTexture } from "../src/textures/d10";
import { D12Texture } from "../src/textures/d12";
import { D20Texture } from "../src/textures/d20";
import type { DieTexture, TextureOptions } from "../src/textures/dice";

const originalCreateElement = document.createElement.bind(document);

beforeEach(() => {
    const mockContext = {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 0,
        textAlign: "",
        textBaseline: "",
        font: "",
        letterSpacing: "",
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillText: vi.fn(),
        roundRect: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
    };

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "canvas") {
            return {
                width: 0,
                height: 0,
                getContext: () => mockContext,
            } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
    });
});

describe("d100 result combination", () => {
    it("combines 00 + 0 as 100", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 100;
        d100.dice[1].physics.readFace = () => 10;
        expect(d100.readResult()).toBe(100);
    });

    it("combines 30 + 7 as 37", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 30;
        d100.dice[1].physics.readFace = () => 7;
        expect(d100.readResult()).toBe(37);
    });

    it("combines 10 + 1 as 11", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 10;
        d100.dice[1].physics.readFace = () => 1;
        expect(d100.readResult()).toBe(11);
    });

    it("combines 90 + 9 as 99", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 90;
        d100.dice[1].physics.readFace = () => 9;
        expect(d100.readResult()).toBe(99);
    });

    it("combines 00 + 1 as 1", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 100;
        d100.dice[1].physics.readFace = () => 1;
        expect(d100.readResult()).toBe(1);
    });
});

describe("d100 dice creation", () => {
    it("d100 creates two dice: tens (10-100) and ones (1-10)", async () => {
        const d100 = await createD100();
        expect(d100.dice.length).toBe(2);

        const tensValues = d100.dice[0].physics.faces.map((f) => f.value).sort((a, b) => a - b);
        expect(tensValues).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

        const onesValues = d100.dice[1].physics.faces.map((f) => f.value).sort((a, b) => a - b);
        expect(onesValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});

describe("getTrayDimensions", () => {
    it("returns landscape dimensions for aspect > 1", () => {
        const { halfWidth, halfDepth } = getTrayDimensions(2, 10);
        expect(halfWidth).toBeGreaterThan(halfDepth);
    });

    it("returns portrait dimensions for aspect < 1", () => {
        const { halfWidth, halfDepth } = getTrayDimensions(0.5, 10);
        expect(halfWidth).toBeLessThan(halfDepth);
    });

    it("returns square dimensions for aspect = 1", () => {
        const { halfWidth, halfDepth } = getTrayDimensions(1, 10);
        expect(halfWidth).toBe(halfDepth);
    });
});


describe("removeDice", () => {
    it("disposes geometry, material, and texture", async () => {
        const tray = createTray(5, 5);
        const die = await createD6();

        tray.world.addBody(die.physics.body);
        tray.dice = [die];

        const geometryDispose = vi.spyOn(die.mesh.geometry, "dispose");
        const material = die.mesh.material as THREE.MeshPhysicalMaterial;
        const materialDispose = vi.spyOn(material, "dispose");
        expect(material.map).not.toBeNull();
        const textureDispose = vi.spyOn(material.map as THREE.Texture, "dispose");

        removeDice(tray);

        expect(geometryDispose).toHaveBeenCalled();
        expect(materialDispose).toHaveBeenCalled();
        expect(textureDispose).toHaveBeenCalled();
        expect(tray.dice).toHaveLength(0);
    });
});

describe("texture caching", () => {
    const dieTypes: {
        name: string;
        create: (texture?: DieTexture) => Promise<Die>;
        Texture: new (options?: TextureOptions) => DieTexture;
    }[] = [
        { name: "d4", create: (t) => createD4(1, t as D4Texture), Texture: D4Texture },
        { name: "d6", create: (t) => createD6(1, t as D6Texture), Texture: D6Texture },
        { name: "d8", create: (t) => createD8(1, t as D8Texture), Texture: D8Texture },
        { name: "d10", create: (t) => createD10(1, t as D10Texture), Texture: D10Texture },
        { name: "d12", create: (t) => createD12(1, t as D12Texture), Texture: D12Texture },
        { name: "d20", create: (t) => createD20(1, t as D20Texture), Texture: D20Texture },
        {
            name: "percentile",
            create: async (t) => (await createD100(1, undefined, t as DPercentileTexture)).dice[1],
            Texture: DPercentileTexture,
        },
    ];

    it.each(dieTypes)(
        "$name reuses the same texture for multiple dice with default options",
        async ({ create }) => {
            const die1 = await create();
            const die2 = await create();
            const die3 = await create();

            const material1 = die1.mesh.material as THREE.MeshPhysicalMaterial;
            const material2 = die2.mesh.material as THREE.MeshPhysicalMaterial;
            const material3 = die3.mesh.material as THREE.MeshPhysicalMaterial;

            expect(material1.map).toBe(material2.map);
            expect(material2.map).toBe(material3.map);
        },
    );

    it.each(dieTypes)(
        "$name reuses the same texture for dice with identical options",
        async ({ create, Texture }) => {
            const options = { bgColour: "#ff0000" };
            const die1 = await create(new Texture(options));
            const die2 = await create(new Texture(options));
            const die3 = await create(new Texture(options));

            const material1 = die1.mesh.material as THREE.MeshPhysicalMaterial;
            const material2 = die2.mesh.material as THREE.MeshPhysicalMaterial;
            const material3 = die3.mesh.material as THREE.MeshPhysicalMaterial;

            expect(material1.map).toBe(material2.map);
            expect(material2.map).toBe(material3.map);
        },
    );
});
