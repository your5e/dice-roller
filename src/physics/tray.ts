import * as CANNON from "cannon-es";
import type { PhysicsDie } from "./dice";

// Walls tall enough to contain bouncing dice
const TRAY_WALL_HEIGHT = 3;

export const SETTLE_THRESHOLD = 0.01;
export const TIME_STEP = 1 / 60;

// Dice should settle within 5 seconds; 10 gives margin for error
const MAX_SIMULATION_TIME = 10;

export function isSettled(die: PhysicsDie): boolean {
    const speed = die.body.velocity.length();
    const angularSpeed = die.body.angularVelocity.length();
    return speed < SETTLE_THRESHOLD && angularSpeed < SETTLE_THRESHOLD;
}

export function throwDie(die: PhysicsDie, halfWidth: number, halfDepth: number): void {
    die.body.position.set(
        (Math.random() - 0.5) * halfWidth,
        3 + Math.random() * 2,
        (Math.random() - 0.5) * halfDepth,
    );
    die.body.quaternion.setFromEuler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
    );
    die.body.velocity.set((Math.random() - 0.5) * 4, -2, (Math.random() - 0.5) * 4);
    die.body.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
    );
}

export type Tray = {
    world: CANNON.World;
    halfWidth: number;
    halfDepth: number;
};

export function createTray(halfWidth: number, halfDepth: number): Tray {
    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0),
    });

    // Ground plane
    const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const wallThickness = 0.5;
    const verticalWallShape = new CANNON.Box(
        new CANNON.Vec3(wallThickness, TRAY_WALL_HEIGHT, halfDepth),
    );
    const horizontalWallShape = new CANNON.Box(
        new CANNON.Vec3(halfWidth, TRAY_WALL_HEIGHT, wallThickness),
    );

    const leftWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: verticalWallShape,
    });
    leftWall.position.set(-halfWidth - wallThickness, TRAY_WALL_HEIGHT, 0);
    world.addBody(leftWall);

    const rightWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: verticalWallShape,
    });
    rightWall.position.set(halfWidth + wallThickness, TRAY_WALL_HEIGHT, 0);
    world.addBody(rightWall);

    const backWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
    });
    backWall.position.set(0, TRAY_WALL_HEIGHT, -halfDepth - wallThickness);
    world.addBody(backWall);

    const frontWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
    });
    frontWall.position.set(0, TRAY_WALL_HEIGHT, halfDepth + wallThickness);
    world.addBody(frontWall);

    return { world, halfWidth, halfDepth };
}

export type RollOptions = {
    onStep?: () => void;
};

export function roll(tray: Tray, dice: PhysicsDie[], options?: RollOptions): number[] {
    const { world, halfWidth, halfDepth } = tray;

    for (const die of dice) {
        throwDie(die, halfWidth, halfDepth);
        world.addBody(die.body);
    }

    const maxSteps = MAX_SIMULATION_TIME / TIME_STEP;
    for (let step = 0; step < maxSteps; step++) {
        world.step(TIME_STEP);
        options?.onStep?.();

        if (dice.every(isSettled)) {
            break;
        }
    }

    return dice.map((die) => die.readFace());
}
