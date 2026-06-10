import * as THREE from "three";
import {
    DIE_SCALE,
    FACE_STANCE,
    FACE_VERTICES,
    FACES,
    HALF_THICKNESS,
    VERTICES,
} from "../bodies/d2";
import { createDieBody, DEFAULT_DICE_CONFIG, type DiceConfig } from "../physics/dice";
import { coinMaterial } from "../physics/tray";
import { D2Texture, UV_REGIONS } from "../textures/d2";
import type { TextureOptions } from "../textures/dice";
import { Die } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const defaultTexture = new D2Texture();

// the coin is metallic, so its shine comes from reflecting an environment;
// the renderer provides one when it has a WebGL context to build it with
let environment: THREE.Texture | null = null;

export function setCoinEnvironment(map: THREE.Texture): void {
    environment = map;
}

// heavier than a plastic die, and lands dead rather than bouncing
const D2_DICE_CONFIG: DiceConfig = {
    ...DEFAULT_DICE_CONFIG,
    mass: 200,
    material: coinMaterial,
    angularDamping: 0.1,
    flick: {
        lift: 40, // upward velocity (height and hang time)
        spin: 55, // rotation (radians/second)
        drive: 0.35, // ratio on horizontal "throw" speed
    },
};

// the coin is not chamfered
function createCoinGeometry(scale: number): THREE.BufferGeometry {
    const geometry = new THREE.CylinderGeometry(
        scale,
        scale,
        2 * HALF_THICKNESS * scale,
        32,
    );

    // cylinder groups are side, top cap, bottom cap; remap each group's
    // unit-square UVs into its region of the texture atlas
    const regions = [UV_REGIONS.rim, UV_REGIONS.heads, UV_REGIONS.tails];
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
    const index = geometry.getIndex();
    if (!index) {
        throw new Error("CylinderGeometry has no index buffer");
    }
    for (const group of geometry.groups) {
        const region = regions[group.materialIndex ?? 0];
        const remapped = new Set<number>();
        for (let i = group.start; i < group.start + group.count; i++) {
            const vertex = index.getX(i);
            if (remapped.has(vertex)) continue;
            remapped.add(vertex);
            uv.setXY(
                vertex,
                region.u + uv.getX(vertex) * region.width,
                region.v + uv.getY(vertex) * region.height,
            );
        }
    }

    // a single material covers the whole atlas
    geometry.clearGroups();
    return geometry;
}

export class D2 extends Die {
    faceVertices = FACE_VERTICES;
    meshVertices = VERTICES;
    faceStance = FACE_STANCE;

    async replaceTexture(options: TextureOptions): Promise<void> {
        const material = this.mesh.material as THREE.MeshPhysicalMaterial;
        const texture = new D2Texture(options);
        material.map?.dispose();
        material.map = await texture.createTexture();
        material.bumpMap?.dispose();
        material.bumpMap = await texture.createBumpTexture();
        material.roughnessMap?.dispose();
        material.roughnessMap = await texture.createRoughnessTexture();
    }

    override dispose(): void {
        const material = this.mesh.material as THREE.MeshPhysicalMaterial;
        material.bumpMap?.dispose();
        material.roughnessMap?.dispose();
        super.dispose();
    }
}

export async function createD2(
    size = 1,
    texture: D2Texture = defaultTexture,
): Promise<D2> {
    const scale = size * DIE_SCALE;
    const scaledVertices = VERTICES.map((v) => v.clone().multiplyScalar(scale));

    let geometry = geometryCache.get(size);
    if (!geometry) {
        geometry = createCoinGeometry(scale);
        geometryCache.set(size, geometry);
    }

    // a landed coin face mirrors a single point of the environment across
    // its whole area, so reflections are kept blurred and damped or the
    // face washes out into one uniform bright tone
    const material = new THREE.MeshPhysicalMaterial({
        map: await texture.createTexture(),
        bumpMap: await texture.createBumpTexture(),
        bumpScale: -1,
        metalness: 0.75,
        // the roughness map carries the real values: polished field,
        // frosted icons
        roughness: 1,
        roughnessMap: await texture.createRoughnessTexture(),
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        envMap: environment,
        envMapIntensity: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const physics = createDieBody(scaledVertices, FACES, D2_DICE_CONFIG);

    const die = new D2(mesh, physics);
    die.texture = texture;
    return die;
}
