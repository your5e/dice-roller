import * as CANNON from "cannon-es";
import type { PhysicsDie } from "./dice";

// wall tall enough to contain bouncing dice
const TRAY_WALL_HEIGHT = 12;
export const WALL_THICKNESS = 0.5;

export const SETTLE_THRESHOLD = 0.01;
export const TIME_STEP = 1 / 60;

// should settle within 5 seconds, so 10 gives a margin for error
const MAX_SIMULATION_TIME = 10;

export const diceMaterial = new CANNON.Material("dice");
const trayMaterial = new CANNON.Material("tray");

export function isSettled(die: PhysicsDie): boolean {
    const speed = die.body.velocity.length();
    const angularSpeed = die.body.angularVelocity.length();
    return speed < SETTLE_THRESHOLD && angularSpeed < SETTLE_THRESHOLD;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function bodiesOverlap(a: CANNON.Body, b: CANNON.Body, world: CANNON.World): boolean {
    a.updateAABB();
    b.updateAABB();

    const contacts: CANNON.ContactEquation[] = [];
    world.narrowphase.getContacts([a], [b], world, contacts, [], [], []);

    return contacts.length > 0;
}

export function packDice(dice: PhysicsDie[], world: CANNON.World): void {
    let lastRadius = 0;

    for (let i = 0; i < dice.length; i++) {
        const die = dice[i];
        die.body.quaternion.setFromEuler(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
        );

        const angle = i * GOLDEN_ANGLE;
        let radius = lastRadius;
        for (let attempt = 0; attempt < 100; attempt++) {
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);
            die.body.position.set(x, 2, z);
            if (
                !dice
                    .slice(0, i)
                    .some((other) => bodiesOverlap(die.body, other.body, world))
            ) {
                break;
            }
            radius += 0.2;
        }
        lastRadius = Math.max(lastRadius, radius);
    }
}

export function offsetToEdge(
    dice: PhysicsDie[],
    halfWidth: number,
    fromLeft: boolean,
): void {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const die of dice) {
        const pos = die.body.position;
        const r = (die.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
        minX = Math.min(minX, pos.x - r);
        maxX = Math.max(maxX, pos.x + r);
        minZ = Math.min(minZ, pos.z - r);
        maxZ = Math.max(maxZ, pos.z + r);
    }

    const offsetX = fromLeft ? -halfWidth - minX + 0.2 : halfWidth - maxX - 0.2;
    const offsetZ = -(minZ + maxZ) / 2;

    for (const die of dice) {
        const pos = die.body.position;
        die.body.position.set(pos.x + offsetX, pos.y, pos.z + offsetZ);
    }
}

export function applyThrowVelocity(
    die: PhysicsDie,
    fromLeft: boolean,
    halfWidth: number,
): void {
    const baseAngle = fromLeft ? 0 : Math.PI;
    const throwAngle = baseAngle + (Math.random() - 0.5) * (Math.PI / 3);
    const throwSpeed = 10 + Math.random() * 4;

    die.body.velocity.set(
        Math.cos(throwAngle) * throwSpeed,
        -2 - Math.random() * 4,
        Math.sin(throwAngle) * throwSpeed,
    );

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
        allowSleep: true,
    });
    const solver = new CANNON.SplitSolver(new CANNON.GSSolver());
    solver.iterations = 16;
    world.solver = solver;

    // friction: 0 = ice, 0.5 = wood, 1.0 = rubber
    // restitution: 0 = clay, 0.5 = wood, 1.0 = superball
    world.addContactMaterial(
        new CANNON.ContactMaterial(trayMaterial, diceMaterial, {
            friction: 0.5,
            restitution: 0.3,
        }),
    );
    world.addContactMaterial(
        new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
            friction: 0.3,
            restitution: 0.2,
        }),
    );

    const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: trayMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const verticalWallShape = new CANNON.Box(
        new CANNON.Vec3(WALL_THICKNESS, TRAY_WALL_HEIGHT, halfDepth),
    );
    const horizontalWallShape = new CANNON.Box(
        new CANNON.Vec3(halfWidth, TRAY_WALL_HEIGHT, WALL_THICKNESS),
    );

    const leftWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: verticalWallShape,
        material: trayMaterial,
    });
    leftWall.position.set(-halfWidth - WALL_THICKNESS, TRAY_WALL_HEIGHT, 0);
    world.addBody(leftWall);

    const rightWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: verticalWallShape,
        material: trayMaterial,
    });
    rightWall.position.set(halfWidth + WALL_THICKNESS, TRAY_WALL_HEIGHT, 0);
    world.addBody(rightWall);

    const backWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
        material: trayMaterial,
    });
    backWall.position.set(0, TRAY_WALL_HEIGHT, -halfDepth - WALL_THICKNESS);
    world.addBody(backWall);

    const frontWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
        material: trayMaterial,
    });
    frontWall.position.set(0, TRAY_WALL_HEIGHT, halfDepth + WALL_THICKNESS);
    world.addBody(frontWall);

    return { world, halfWidth, halfDepth };
}

export type RollOptions = {
    onStep?: () => void;
};

export function roll(tray: Tray, dice: PhysicsDie[], options?: RollOptions): number[] {
    const { world, halfWidth } = tray;
    const fromLeft = Math.random() < 0.5;

    packDice(dice, world);
    offsetToEdge(dice, halfWidth, fromLeft);
    for (const die of dice) {
        applyThrowVelocity(die, fromLeft, halfWidth);
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
