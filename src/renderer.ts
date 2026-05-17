import * as THREE from "three";
import { DebugDieController, type DebugDieType } from "./debug";
import { loadVarelaRound } from "./fonts/varela-round";
import { createD4 } from "./geometries/d4";
import { createD6 } from "./geometries/d6";
import { createD8 } from "./geometries/d8";
import { createD10, createD100 } from "./geometries/d10";
import { createD12 } from "./geometries/d12";
import { createD20 } from "./geometries/d20";
import type { Die } from "./geometries/dice";
import {
    type Tray as PhysicsTray,
    TIME_STEP,
    applyThrowVelocity,
    createTray as createPhysicsTray,
    isSettled,
    offsetToEdge,
    packDice,
} from "./physics/tray";

type RollState = {
    onSettle: () => void;
    steps: number;
};

export type TrayState = {
    container: HTMLElement;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    physicsTray: PhysicsTray;
    dice: Die[];
    roll: RollState | null;
    animationId: number | null;
    debugDie: DebugDieController;
};

function resizeCamera(tray: TrayState, halfSize: number): void {
    const aspect = tray.container.clientWidth / tray.container.clientHeight;
    tray.camera.left = -halfSize * aspect;
    tray.camera.right = halfSize * aspect;
    tray.camera.top = halfSize;
    tray.camera.bottom = -halfSize;
    tray.camera.updateProjectionMatrix();
}

export function createTray(container: HTMLElement): TrayState {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

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

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const physicsTray = createPhysicsTray(10, 10);
    const debugDie = new DebugDieController();

    const state: TrayState = {
        container,
        renderer,
        scene,
        camera,
        physicsTray,
        dice: [],
        roll: null,
        animationId: null,
        debugDie,
    };

    loadVarelaRound().then(async () => {
        resizeCamera(state, 3);
        const mesh = await debugDie.create();
        scene.add(mesh);
        debugDie.setupInteraction(container);
    });

    startAnimationLoop(state);

    return state;
}

interface Roll {
    dice: Die[];
    readResult(): number;
}

async function createRoll(sides: number): Promise<Roll> {
    switch (sides) {
        case 4:
            return await createD4();
        case 6:
            return await createD6();
        case 8:
            return await createD8();
        case 10:
            return await createD10();
        case 12:
            return await createD12();
        case 20:
            return await createD20();
        case 100:
            return await createD100();
        default:
            throw new Error(`No geometry for d${sides}`);
    }
}

type DiceGroup = { count: number; sides: number };

export async function roll(tray: TrayState, groups: DiceGroup[]): Promise<number[][]> {
    if (tray.debugDie.mesh) {
        tray.debugDie.remove(tray.scene);
    }

    for (const die of tray.dice) {
        tray.scene.remove(die.mesh);
    }
    tray.dice = [];

    const fromLeft = Math.random() < 0.5;
    const dice: Die[] = [];
    const rolls: Roll[][] = [];

    for (const { count, sides } of groups) {
        const groupRolls: Roll[] = [];
        for (let i = 0; i < count; i++) {
            const roll = await createRoll(sides);
            dice.push(...roll.dice);
            groupRolls.push(roll);
        }
        rolls.push(groupRolls);
    }

    let halfSize = 10;
    tray.physicsTray = createPhysicsTray(halfSize, halfSize);
    packDice(
        dice.map((d) => d.physics),
        tray.physicsTray.world,
    );

    // if the dice don't fit in the tray, make the tray bigger until they do
    while (true) {
        const allFit = dice.every((die) => {
            const pos = die.physics.body.position;
            return Math.abs(pos.x) + 1 <= halfSize && Math.abs(pos.z) + 1 <= halfSize;
        });
        if (allFit) break;
        halfSize += 1;
        tray.physicsTray = createPhysicsTray(halfSize, halfSize);
    }

    offsetToEdge(
        dice.map((d) => d.physics),
        halfSize,
        fromLeft,
    );

    resizeCamera(tray, halfSize);

    for (const die of dice) {
        tray.scene.add(die.mesh);
        tray.physicsTray.world.addBody(die.physics.body);
        syncDie(die);
    }

    tray.dice = dice;

    for (const die of dice) {
        applyThrowVelocity(die.physics, fromLeft, tray.physicsTray.halfWidth);
    }

    return new Promise((resolve) => {
        tray.roll = {
            steps: 0,
            onSettle: () => {
                resolve(rolls.map((group) => group.map((roll) => roll.readResult())));
            },
        };
    });
}

function startAnimationLoop(state: TrayState): void {
    function animate(): void {
        state.animationId = requestAnimationFrame(animate);

        if (state.roll) {
            state.physicsTray.world.step(TIME_STEP);
            state.roll.steps++;

            for (const die of state.dice) {
                syncDie(die);
            }

            if (state.dice.every((die) => isSettled(die.physics))) {
                state.roll.onSettle();
                state.roll = null;
            }
        } else if (state.debugDie.mesh) {
            state.debugDie.update();
        }

        state.renderer.render(state.scene, state.camera);
    }
    animate();
}

export function syncDie(die: Die): void {
    const { body } = die.physics;
    die.mesh.position.set(body.position.x, body.position.y, body.position.z);
    die.mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
    );
}

export async function setDebugDie(tray: TrayState, sides: DebugDieType): Promise<void> {
    if (tray.debugDie.mesh) {
        tray.debugDie.remove(tray.scene);
    }

    for (const die of tray.dice) {
        tray.scene.remove(die.mesh);
    }
    tray.dice = [];
    tray.roll = null;

    resizeCamera(tray, 3);

    const mesh = await tray.debugDie.create(sides);
    tray.scene.add(mesh);
    tray.debugDie.setupInteraction(tray.container);
}
