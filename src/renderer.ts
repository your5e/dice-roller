import * as THREE from "three";
import { createD6 } from "./geometries/d6";
import { createD12 } from "./geometries/d12";
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
    onSettle: (results: number[]) => void;
    steps: number;
};

export type TrayState = {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    physicsTray: PhysicsTray;
    dice: Die[];
    roll: RollState | null;
    animationId: number | null;
};

export function createTray(container: HTMLElement): TrayState {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // top-down camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8, 0);
    camera.lookAt(0, 0, 0);

    // light from top-left
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-1, 1, 0);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const physicsTray = createPhysicsTray(3, 3);

    const state: TrayState = {
        renderer,
        scene,
        camera,
        physicsTray,
        dice: [],
        roll: null,
        animationId: null,
    };

    startAnimationLoop(state);

    return state;
}

function createDie(sides: number): Die {
    switch (sides) {
        case 6:
            return createD6();
        case 12:
            return createD12();
        default:
            throw new Error(`No geometry for d${sides}`);
    }
}

type DiceGroup = { count: number; sides: number };

export function roll(tray: TrayState, groups: DiceGroup[]): Promise<number[][]> {
    for (const die of tray.dice) {
        tray.scene.remove(die.mesh);
    }
    tray.dice = [];

    const fromLeft = Math.random() < 0.5;
    const dice: Die[] = [];
    const groupBoundaries: number[] = [0];

    for (const { count, sides } of groups) {
        for (let i = 0; i < count; i++) {
            dice.push(createDie(sides));
        }
        groupBoundaries.push(dice.length);
    }

    let halfSize = 3;
    tray.physicsTray = createPhysicsTray(halfSize, halfSize);
    packDice(
        dice.map((d) => d.physics),
        tray.physicsTray.world,
    );

    // if the dice don't fit in the tray, make the tray bigger until they do
    while (true) {
        const allFit = dice.every((die) => {
            const pos = die.physics.body.position;
            return (
                Math.abs(pos.x) + 0.5 <= halfSize && Math.abs(pos.z) + 0.5 <= halfSize
            );
        });
        if (allFit) break;
        halfSize += 0.5;
        tray.physicsTray = createPhysicsTray(halfSize, halfSize);
    }

    offsetToEdge(
        dice.map((d) => d.physics),
        halfSize,
        fromLeft,
    );

    tray.camera.position.y = halfSize * (8 / 3);

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
            onSettle: (results) => {
                const grouped: number[][] = [];
                for (let i = 0; i < groupBoundaries.length - 1; i++) {
                    grouped.push(
                        results.slice(groupBoundaries[i], groupBoundaries[i + 1]),
                    );
                }
                resolve(grouped);
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
                const results = state.dice.map((die) => die.physics.readFace());
                state.roll.onSettle(results);
                state.roll = null;
            }
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
