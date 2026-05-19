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
const floorMaterial = new CANNON.Material("floor");
const wallMaterial = new CANNON.Material("wall");

export function isSettled(die: PhysicsDie): boolean {
    const speed = die.body.velocity.length();
    const angularSpeed = die.body.angularVelocity.length();
    return speed < SETTLE_THRESHOLD && angularSpeed < SETTLE_THRESHOLD;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Shoemake's uniform random quaternion
// https://en.wikipedia.org/wiki/3D_rotation_group#Uniform_random_sampling
function randomQuaternion(): CANNON.Quaternion {
    const u1 = Math.random();
    const u2 = Math.random() * Math.PI * 2;
    const u3 = Math.random() * Math.PI * 2;
    const sqrt1MinusU1 = Math.sqrt(1 - u1);
    const sqrtU1 = Math.sqrt(u1);
    return new CANNON.Quaternion(
        sqrt1MinusU1 * Math.sin(u2),
        sqrt1MinusU1 * Math.cos(u2),
        sqrtU1 * Math.sin(u3),
        sqrtU1 * Math.cos(u3),
    );
}

export function bodiesOverlap(
    a: CANNON.Body,
    b: CANNON.Body,
    world: CANNON.World,
): boolean {
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
        die.body.quaternion.copy(randomQuaternion());

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

export function offsetToEdge(dice: PhysicsDie[], tray: Tray, whichSide: boolean): void {
    const isPortrait = tray.halfDepth > tray.halfWidth;
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

    let offsetX: number;
    let offsetZ: number;
    if (isPortrait) {
        offsetX = -(minX + maxX) / 2;
        offsetZ = whichSide
            ? tray.halfDepth - maxZ - 0.2
            : -tray.halfDepth - minZ + 0.2;
    } else {
        offsetX = whichSide
            ? -tray.halfWidth - minX + 0.2
            : tray.halfWidth - maxX - 0.2;
        offsetZ = -(minZ + maxZ) / 2;
    }

    for (const die of dice) {
        const pos = die.body.position;
        die.body.position.set(pos.x + offsetX, pos.y, pos.z + offsetZ);
    }
}

export function applyThrowVelocity(
    die: PhysicsDie,
    tray: Tray,
    whichSide: boolean,
): void {
    const isPortrait = tray.halfDepth > tray.halfWidth;
    const baseAngle = isPortrait
        ? whichSide
            ? -Math.PI / 2
            : Math.PI / 2
        : whichSide
          ? 0
          : Math.PI;
    const throwAngle = baseAngle + (Math.random() - 0.5) * (Math.PI / 2);

    // Calculate distance to far wall, use it to determine throw speed
    const pos = die.body.position;
    const distance = isPortrait
        ? Math.abs((whichSide ? -tray.halfDepth : tray.halfDepth) - pos.z)
        : Math.abs((whichSide ? tray.halfWidth : -tray.halfWidth) - pos.x);
    const k = 1.5;
    const perturbation = 0.8 + Math.random() * 0.4;
    const throwSpeed = k * distance * perturbation;

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
        gravity: new CANNON.Vec3(0, -20, 0),
        allowSleep: true,
    });
    const solver = new CANNON.SplitSolver(new CANNON.GSSolver());
    solver.iterations = 16;
    world.solver = solver;

    // friction: 0 = ice, 0.5 = wood, 1.0 = rubber
    // restitution: 0 = clay, 0.5 = wood, 1.0 = superball
    world.addContactMaterial(
        new CANNON.ContactMaterial(floorMaterial, diceMaterial, {
            friction: 0.5,
            restitution: 0.3,
        }),
    );
    world.addContactMaterial(
        new CANNON.ContactMaterial(wallMaterial, diceMaterial, {
            friction: 0.3,
            restitution: 0.8,
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
        material: floorMaterial,
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
        material: wallMaterial,
    });
    leftWall.position.set(-halfWidth - WALL_THICKNESS, TRAY_WALL_HEIGHT, 0);
    world.addBody(leftWall);

    const rightWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: verticalWallShape,
        material: wallMaterial,
    });
    rightWall.position.set(halfWidth + WALL_THICKNESS, TRAY_WALL_HEIGHT, 0);
    world.addBody(rightWall);

    const backWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
        material: wallMaterial,
    });
    backWall.position.set(0, TRAY_WALL_HEIGHT, -halfDepth - WALL_THICKNESS);
    world.addBody(backWall);

    const frontWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
        material: wallMaterial,
    });
    frontWall.position.set(0, TRAY_WALL_HEIGHT, halfDepth + WALL_THICKNESS);
    world.addBody(frontWall);

    return { world, halfWidth, halfDepth };
}

export type RollOptions = {
    onStep?: () => void;
};

export function roll(tray: Tray, dice: PhysicsDie[], options?: RollOptions): number[] {
    const { world } = tray;
    const whichSide = Math.random() < 0.5;

    packDice(dice, world);
    offsetToEdge(dice, tray, whichSide);

    for (const die of dice) {
        applyThrowVelocity(die, tray, whichSide);
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
