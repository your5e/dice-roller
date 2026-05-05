import * as THREE from "three";
import { type Die, createD6 } from "./geometries/d6";
import {
    type Tray as PhysicsTray,
    TIME_STEP,
    createTray as createPhysicsTray,
    isSettled,
    throwDie,
} from "./physics/tray";

type RollState = {
    onSettle: (results: number[]) => void;
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

export function roll(tray: TrayState, count: number): Promise<number[]> {
    // Clear previous dice from scene
    for (const die of tray.dice) {
        tray.scene.remove(die.mesh);
        tray.physicsTray.world.removeBody(die.physics.body);
    }
    tray.dice = [];

    const { halfWidth, halfDepth } = tray.physicsTray;
    const dice: Die[] = [];

    for (let i = 0; i < count; i++) {
        const die = createD6(1, 0.1);
        dice.push(die);
        tray.scene.add(die.mesh);
        throwDie(die.physics, halfWidth, halfDepth);
        tray.physicsTray.world.addBody(die.physics.body);
    }

    tray.dice = dice;

    return new Promise((resolve) => {
        tray.roll = {
            onSettle: resolve,
        };
    });
}

function startAnimationLoop(state: TrayState): void {
    function animate(): void {
        state.animationId = requestAnimationFrame(animate);

        if (state.roll) {
            state.physicsTray.world.step(TIME_STEP);

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
