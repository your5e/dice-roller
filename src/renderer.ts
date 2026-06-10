import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadVarelaRound } from "./fonts/varela-round";
import { createD2, setCoinEnvironment } from "./geometries/d2";
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
    type TextureStyle,
    type Tray,
} from "./physics/tray";
import {
    D4DebugTexture,
    D4KintsugiTexture,
    D4NightSkyTexture,
    D4PrideTexture,
    D4Texture,
} from "./textures/d4";
import {
    D6DebugTexture,
    D6KintsugiTexture,
    D6NightSkyTexture,
    D6PrideTexture,
    D6Texture,
} from "./textures/d6";
import {
    D8DebugTexture,
    D8KintsugiTexture,
    D8NightSkyTexture,
    D8PrideTexture,
    D8Texture,
} from "./textures/d8";
import {
    D10DebugTexture,
    D10KintsugiTexture,
    D10NightSkyTexture,
    D10PrideTexture,
    D10Texture,
    DPercentileDebugTexture,
    DPercentileKintsugiTexture,
    DPercentileNightSkyTexture,
    DPercentilePrideTexture,
    DPercentileTexture,
} from "./textures/d10";
import {
    D12DebugTexture,
    D12KintsugiTexture,
    D12NightSkyTexture,
    D12PrideTexture,
    D12Texture,
} from "./textures/d12";
import {
    D20DebugTexture,
    D20KintsugiTexture,
    D20NightSkyTexture,
    D20PrideTexture,
    D20Texture,
} from "./textures/d20";
import type { DieTexture, TextureOptions } from "./textures/dice";

type TextureConstructor = new (options?: TextureOptions) => DieTexture;

type TextureRegistry = {
    [K in TextureStyle]: {
        4: TextureConstructor;
        6: TextureConstructor;
        8: TextureConstructor;
        10: TextureConstructor;
        12: TextureConstructor;
        20: TextureConstructor;
        100: TextureConstructor;
    };
};

const textureRegistry: TextureRegistry = {
    standard: {
        4: D4Texture,
        6: D6Texture,
        8: D8Texture,
        10: D10Texture,
        12: D12Texture,
        20: D20Texture,
        100: DPercentileTexture,
    },
    kintsugi: {
        4: D4KintsugiTexture,
        6: D6KintsugiTexture,
        8: D8KintsugiTexture,
        10: D10KintsugiTexture,
        12: D12KintsugiTexture,
        20: D20KintsugiTexture,
        100: DPercentileKintsugiTexture,
    },
    debug: {
        4: D4DebugTexture,
        6: D6DebugTexture,
        8: D8DebugTexture,
        10: D10DebugTexture,
        12: D12DebugTexture,
        20: D20DebugTexture,
        100: DPercentileDebugTexture,
    },
    pride: {
        4: D4PrideTexture,
        6: D6PrideTexture,
        8: D8PrideTexture,
        10: D10PrideTexture,
        12: D12PrideTexture,
        20: D20PrideTexture,
        100: DPercentilePrideTexture,
    },
    nightsky: {
        4: D4NightSkyTexture,
        6: D6NightSkyTexture,
        8: D8NightSkyTexture,
        10: D10NightSkyTexture,
        12: D12NightSkyTexture,
        20: D20NightSkyTexture,
        100: DPercentileNightSkyTexture,
    },
};

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

    const pmrem = new THREE.PMREMGenerator(renderer);
    setCoinEnvironment(pmrem.fromScene(new RoomEnvironment()).texture);
    pmrem.dispose();

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

function createTextureForSides(
    sides: 4 | 6 | 8 | 10 | 12 | 20 | 100,
    textureStyle: TextureStyle,
    options?: TextureOptions,
): DieTexture {
    const TextureClass = textureRegistry[textureStyle][sides];
    return new TextureClass(options);
}

export async function createDie(
    sides: number,
    textureStyle: TextureStyle = "standard",
    options?: TextureOptions,
): Promise<DiceWrapper> {
    switch (sides) {
        // the coin sits outside the theme system, it has a single look
        case 2:
            return createD2(1);
        case 4:
            return createD4(
                1,
                createTextureForSides(4, textureStyle, options) as D4Texture,
            );
        case 6:
            return createD6(
                1,
                createTextureForSides(6, textureStyle, options) as D6Texture,
            );
        case 8:
            return createD8(
                1,
                createTextureForSides(8, textureStyle, options) as D8Texture,
            );
        case 10:
            return createD10(
                1,
                createTextureForSides(10, textureStyle, options) as D10Texture,
            );
        case 12:
            return createD12(
                1,
                createTextureForSides(12, textureStyle, options) as D12Texture,
            );
        case 20:
            return createD20(
                1,
                createTextureForSides(20, textureStyle, options) as D20Texture,
            );
        case 100:
            return createD100(
                1,
                createTextureForSides(10, textureStyle, options) as D10Texture,
                createTextureForSides(100, textureStyle, options) as DPercentileTexture,
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
