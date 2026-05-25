import * as THREE from "three";
import { loadVarelaRound } from "./fonts/varela-round";
import { createD4 } from "./geometries/d4";
import { createD6 } from "./geometries/d6";
import { createD8 } from "./geometries/d8";
import { createD10, createD100 } from "./geometries/d10";
import { createD12 } from "./geometries/d12";
import { createD20 } from "./geometries/d20";
import type { Die } from "./geometries/dice";

export type DiceWrapper = {
    dice: Die[];
    readResult(): number;
};

import {
    applyFullThrow,
    createTray,
    type DieBehaviour,
    offsetToEdge,
    simulateThrow,
    type Tray,
} from "./physics/tray";
import { D4Texture } from "./textures/d4";
import { D6Texture } from "./textures/d6";
import { D8Texture } from "./textures/d8";
import { D10Texture, DPercentileTexture } from "./textures/d10";
import { D12Texture } from "./textures/d12";
import { D20Texture } from "./textures/d20";
import type { TextureOptions } from "./textures/dice";

export type Stage = {
    container: HTMLElement;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    physicsTray: Tray;
    rolling: boolean;
    animationId: number | null;
    onUpdate?: () => void;
};

export function getTrayDimensions(
    aspect: number,
    size: number,
): { halfWidth: number; halfDepth: number } {
    const halfWidth = size * Math.sqrt(aspect);
    const halfDepth = size / Math.sqrt(aspect);
    return { halfWidth, halfDepth };
}

export function resizeCamera(tray: Stage, halfWidth: number, halfDepth: number): void {
    tray.camera.left = -halfWidth;
    tray.camera.right = halfWidth;
    tray.camera.top = halfDepth;
    tray.camera.bottom = -halfDepth;
    tray.camera.updateProjectionMatrix();
}

export function setCameraSize(
    tray: Stage,
    size: number,
): { halfWidth: number; halfDepth: number } {
    const aspect = tray.container.clientWidth / tray.container.clientHeight;
    const dims = getTrayDimensions(aspect, size);
    resizeCamera(tray, dims.halfWidth, dims.halfDepth);
    return dims;
}

function windowResize(tray: Stage): void {
    const width = tray.container.clientWidth;
    const height = tray.container.clientHeight;
    tray.renderer.setSize(width, height);
    resizeCamera(tray, tray.physicsTray.halfWidth, tray.physicsTray.halfDepth);
}

export function createStage(container: HTMLElement, existingTray?: Tray): Stage {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    // top-down orthographic camera
    const aspect = width / height;
    const frustumHeight = 10;
    const frustumWidth = frustumHeight * aspect;
    const camera = new THREE.OrthographicCamera(
        -frustumWidth,
        frustumWidth,
        frustumHeight,
        -frustumHeight,
        0.1,
        100,
    );
    camera.position.set(0, 50, 0);
    camera.lookAt(0, 0, 0);

    // light from top-left
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-1, 1, 0);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const physicsTray =
        existingTray ??
        (() => {
            const { halfWidth, halfDepth } = getTrayDimensions(aspect, 10);
            return createTray(halfWidth, halfDepth);
        })();

    const state: Stage = {
        container,
        renderer,
        scene,
        camera,
        physicsTray,
        rolling: false,
        animationId: null,
    };

    resizeCamera(state, physicsTray.halfWidth, physicsTray.halfDepth);

    loadVarelaRound();

    window.addEventListener("resize", () => windowResize(state));

    startAnimationLoop(state);

    return state;
}

export async function createDie(
    sides: number,
    options?: TextureOptions,
): Promise<DiceWrapper> {
    switch (sides) {
        case 4:
            return createD4(1, options ? new D4Texture(options) : undefined);
        case 6:
            return createD6(1, options ? new D6Texture(options) : undefined);
        case 8:
            return createD8(1, options ? new D8Texture(options) : undefined);
        case 10:
            return createD10(1, options ? new D10Texture(options) : undefined);
        case 12:
            return createD12(1, options ? new D12Texture(options) : undefined);
        case 20:
            return createD20(1, options ? new D20Texture(options) : undefined);
        case 100:
            return createD100(
                1,
                options ? new D10Texture(options) : undefined,
                options ? new DPercentileTexture(options) : undefined,
            );
        default:
            throw new Error(`No geometry for d${sides}`);
    }
}

export type DiceGroup = { count: number; sides: number; label?: string };

export function removeDice(physicsTray: Tray, stage?: Stage): void {
    for (const die of physicsTray.dice) {
        physicsTray.world.removeBody(die.physics.body);
        if (stage) {
            stage.scene.remove(die.mesh);
        }
        die.dispose();
    }
    physicsTray.dice = [];
}

export type ThrowOptions = {
    stage?: Stage;
    whichSide?: boolean;
    rerollCocked?: boolean;
};

export type ThrowResult = { behaviour: DieBehaviour[] } | { cancelled: true };

export async function throwDice(
    physicsTray: Tray,
    indicesToThrow: number[],
    options?: ThrowOptions,
): Promise<ThrowResult> {
    const stage = options?.stage;
    const whichSide = options?.whichSide ?? Math.random() < 0.5;
    const dice = physicsTray.dice;
    const diceToThrow = indicesToThrow.map((i) => dice[i]);
    const physicsDice = diceToThrow.map((d) => d.physics);

    offsetToEdge(physicsDice, physicsTray, whichSide);

    const isPortrait = physicsTray.halfDepth > physicsTray.halfWidth;
    const sortedByPosition = [...physicsDice].sort((a, b) => {
        const posA = isPortrait ? a.body.position.z : a.body.position.x;
        const posB = isPortrait ? b.body.position.z : b.body.position.x;
        return isPortrait
            ? whichSide
                ? posB - posA
                : posA - posB
            : whichSide
              ? posA - posB
              : posB - posA;
    });
    const positionRanks = new Map<(typeof physicsDice)[0], number>();
    for (let i = 0; i < sortedByPosition.length; i++) {
        positionRanks.set(
            sortedByPosition[i],
            i / Math.max(1, sortedByPosition.length - 1),
        );
    }
    for (const die of physicsDice) {
        applyFullThrow(
            die,
            physicsTray,
            whichSide,
            positionRanks.get(die) ?? 0,
            physicsDice.length,
        );
    }

    if (stage) {
        stage.rolling = true;
    }

    const simulation = simulateThrow(physicsTray, physicsDice, {
        whichSide,
        rerollCocked: options?.rerollCocked ?? true,
        onStep: stage
            ? async () => {
                  for (const die of diceToThrow) {
                      syncDie(die);
                  }
                  await new Promise((resolve) => requestAnimationFrame(resolve));
              }
            : undefined,
    });

    physicsTray.simulation = simulation;
    const result = await simulation.result;
    physicsTray.simulation = undefined;

    if (stage) {
        stage.rolling = false;
    }

    if ("cancelled" in result) {
        return { cancelled: true };
    }

    return { behaviour: result.behaviour };
}

function startAnimationLoop(state: Stage): void {
    function animate(): void {
        state.animationId = requestAnimationFrame(animate);
        state.onUpdate?.();
        state.renderer.render(state.scene, state.camera);
    }
    animate();
}

export function syncDie(die: Die): void {
    const { body, liftProgress } = die.physics;
    die.mesh.position.set(body.position.x, body.position.y, body.position.z);
    die.mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
    );
    const scale = 1 + liftProgress * 3;
    die.mesh.scale.set(scale, scale, scale);
}
