import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createD6 } from "../../src/geometries/d6";
import { createD8 } from "../../src/geometries/d8";
import { createD10 } from "../../src/geometries/d10";
import { createD12 } from "../../src/geometries/d12";
import { createD20 } from "../../src/geometries/d20";
import type { Die } from "../../src/geometries/dice";
import { normalFromVertices } from "../../src/geometry";

// Mock canvas for texture creation in d20
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
    };

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "canvas") {
            return {
                width: 0,
                height: 0,
                getContext: () => mockContext,
            } as unknown as HTMLCanvasElement;
        }
        return document.createElement(tagName);
    });
});

function assertTrianglesWoundOutward(die: Die) {
    const geometry = die.mesh.geometry;
    const positions = geometry.getAttribute("position");
    const indices = geometry.getIndex();

    if (!indices) {
        throw new Error("Geometry has no index buffer");
    }

    function getVertex(index: number): THREE.Vector3 {
        return new THREE.Vector3(
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index),
        );
    }

    for (let triangle = 0; triangle < indices.count; triangle += 3) {
        const a = getVertex(indices.getX(triangle));
        const b = getVertex(indices.getX(triangle + 1));
        const c = getVertex(indices.getX(triangle + 2));

        const centroid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);

        const normal = normalFromVertices(a, b, c);

        // normal should point away from origin
        expect(normal.dot(centroid)).toBeGreaterThan(0);
    }
}

describe("dice geometries", () => {
    it("d6 has all triangles wound outward", async () => {
        const texture = new THREE.Texture();
        assertTrianglesWoundOutward(await createD6(0.5, texture));
    });

    it("d8 has all triangles wound outward", async () => {
        const texture = new THREE.Texture();
        assertTrianglesWoundOutward(await createD8(0.5, texture));
    });

    it("d10 has all triangles wound outward", async () => {
        const texture = new THREE.Texture();
        assertTrianglesWoundOutward(await createD10(0.5, texture));
    });

    it("d12 has all triangles wound outward", async () => {
        const texture = new THREE.Texture();
        assertTrianglesWoundOutward(await createD12(0.5, texture));
    });

    it("d20 has all triangles wound outward", async () => {
        const texture = new THREE.Texture();
        assertTrianglesWoundOutward(await createD20(0.5, texture));
    });
});
