import { describe, expect, it } from "vitest";
import { createD6 } from "../src/geometries/d6";

describe("createD6", () => {
    it("produces a mesh with all triangles wound outward", () => {
        const { mesh } = createD6(1, 0.08);
        const geometry = mesh.geometry;
        const positions = geometry.getAttribute("position");
        const indices = geometry.getIndex();

        if (!indices) {
            throw new Error("Geometry has no index buffer");
        }

        function getVertex(index: number): number[] {
            return [
                positions.getX(index),
                positions.getY(index),
                positions.getZ(index),
            ];
        }

        for (let triangle = 0; triangle < indices.count; triangle += 3) {
            const vertices = [0, 1, 2].map((offset) =>
                getVertex(indices.getX(triangle + offset)),
            );

            const centroid = [0, 1, 2].map(
                (axis) =>
                    (vertices[0][axis] + vertices[1][axis] + vertices[2][axis]) / 3,
            );

            // cross product of edges gives the normal direction
            const edge1 = [0, 1, 2].map(
                (axis) => vertices[1][axis] - vertices[0][axis],
            );
            const edge2 = [0, 1, 2].map(
                (axis) => vertices[2][axis] - vertices[0][axis],
            );
            const normal = [
                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                edge1[0] * edge2[1] - edge1[1] * edge2[0],
            ];

            // normal should point away from origin
            const dot = [0, 1, 2].reduce(
                (sum, axis) => sum + normal[axis] * centroid[axis],
                0,
            );

            expect(dot).toBeGreaterThan(0);
        }
    });
});
