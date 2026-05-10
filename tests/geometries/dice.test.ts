import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createD6 } from "../../src/geometries/d6";
import { createD12 } from "../../src/geometries/d12";
import { createD20 } from "../../src/geometries/d20";
import type { Die } from "../../src/geometries/dice";
import { normalFromPoints } from "../../src/geometry";

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

        const normal = normalFromPoints(a, b, c);

        // normal should point away from origin
        expect(normal.dot(centroid)).toBeGreaterThan(0);
    }
}

describe("dice geometries", () => {
    it.each([
        ["d6", createD6],
        ["d12", createD12],
        ["d20", createD20],
    ])("%s has all triangles wound outward", (_, create) => {
        assertTrianglesWoundOutward(create());
    });
});
