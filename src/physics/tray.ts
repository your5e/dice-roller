import * as CANNON from "cannon-es";
import type { Die } from "../geometries/dice";
import type { PhysicsDie } from "./dice";

// wall tall enough to contain bouncing dice
const TRAY_WALL_HEIGHT = 12;
export const WALL_THICKNESS = 0.5;

export const SETTLE_THRESHOLD = 0.01;
export const TIME_STEP = 1 / 60;
export const COCKED_THRESHOLD = 0.98;

let lastYield = 0;

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

export function boundingSpheresOverlap(a: CANNON.Body, b: CANNON.Body): boolean {
    // bounding spheres touch corners; inscribed spheres touch faces
    // ratio varies by shape (0.58 for cubes, 0.79 for icosahedra)
    // 0.85 allows tighter packing with margin for random orientations
    const scale = 0.85;
    const radiusA = (a.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
    const radiusB = (b.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
    const distance = a.position.distanceTo(b.position);
    return distance < (radiusA + radiusB) * scale;
}

function shuffledIndices(length: number): number[] {
    // distribute the difference dice requested throughout the initial position
    const indices = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}

export function packDice(dice: PhysicsDie[]): void {
    const placementOrder = shuffledIndices(dice.length);
    const placed: PhysicsDie[] = [];
    let lastRadius = 0;
    for (let i = 0; i < dice.length; i++) {
        const die = dice[placementOrder[i]];
        die.body.quaternion.copy(randomQuaternion());

        const angle = i * GOLDEN_ANGLE;
        let radius = lastRadius;
        while (true) {
            const x = radius * Math.cos(angle);
            const z = radius * Math.sin(angle);
            die.body.position.set(x, 2, z);
            let overlaps = false;
            for (let j = placed.length - 1; j >= 0; j--) {
                if (boundingSpheresOverlap(die.body, placed[j].body)) {
                    overlaps = true;
                    break;
                }
            }
            if (!overlaps) {
                break;
            }
            radius += 0.05;
        }
        placed.push(die);
        lastRadius = radius;
    }
}

export function getPackedBounds(dice: PhysicsDie[]): {
    halfWidth: number;
    halfDepth: number;
} {
    let maxX = 0;
    let maxZ = 0;

    for (const die of dice) {
        const pos = die.body.position;
        const r = (die.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
        maxX = Math.max(maxX, Math.abs(pos.x) + r);
        maxZ = Math.max(maxZ, Math.abs(pos.z) + r);
    }

    return { halfWidth: maxX, halfDepth: maxZ };
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
        offsetZ = whichSide ? tray.halfDepth - maxZ : -tray.halfDepth - minZ;
    } else {
        offsetX = whichSide ? -tray.halfWidth - minX : tray.halfWidth - maxX;
        offsetZ = -(minZ + maxZ) / 2;
    }

    for (const die of dice) {
        const pos = die.body.position;
        die.body.position.set(pos.x + offsetX, pos.y, pos.z + offsetZ);
    }
}

function getThrowAngle(tray: Tray, whichSide: boolean, spread: number): number {
    const isPortrait = tray.halfDepth > tray.halfWidth;
    const baseAngle = isPortrait
        ? whichSide
            ? -Math.PI / 2
            : Math.PI / 2
        : whichSide
          ? 0
          : Math.PI;
    return baseAngle + (Math.random() - 0.5) * spread;
}

export function applyFullThrow(
    die: PhysicsDie,
    tray: Tray,
    whichSide: boolean,
    positionRank: number,
    total: number,
): void {
    const isPortrait = tray.halfDepth > tray.halfWidth;
    const throwAngle = getThrowAngle(tray, whichSide, Math.PI / 2);

    // aim for most dice thrown to reach the far wall...
    const pos = die.body.position;
    const distance = isPortrait
        ? Math.abs((whichSide ? -tray.halfDepth : tray.halfDepth) - pos.z)
        : Math.abs((whichSide ? tray.halfWidth : -tray.halfWidth) - pos.x);

    // ...but taper the velocity off when lots of dice are rolled, so we don't
    // end up with a pile of dice on the far wall
    const baseK = 1.65;
    const taperStrength = total > 6 ? Math.min(0.55, 0.15 + (total - 7) / 20) : 0;
    const taper = 1 - taperStrength + positionRank * taperStrength;
    const k = baseK * taper;

    // always with a soupçon of randomness
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

function applyGentleThrow(die: PhysicsDie, tray: Tray, whichSide: boolean): void {
    const isPortrait = tray.halfDepth > tray.halfWidth;
    const throwAngle = getThrowAngle(tray, whichSide, Math.PI / 4);

    // aim to stop at the midpoint (not pass it)
    const pos = die.body.position;
    const distance = isPortrait ? Math.abs(pos.z) : Math.abs(pos.x);
    const k = 1.1;
    const perturbation = 0.8 + Math.random() * 0.4;
    const throwSpeed = k * distance * perturbation;

    die.body.velocity.set(
        Math.cos(throwAngle) * throwSpeed,
        -2 - Math.random() * 4,
        Math.sin(throwAngle) * throwSpeed,
    );

    die.body.angularVelocity.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
    );
}

type ReturningDie = {
    die: PhysicsDie;
    targetPos: CANNON.Vec3;
    progress: number;
    whichSide: boolean;
};

const POP_DURATION = 0.15;
const POP_STEPS = POP_DURATION / TIME_STEP;

function getRerollTarget(tray: Tray, whichSide: boolean): CANNON.Vec3 {
    const isPortrait = tray.halfDepth > tray.halfWidth;
    const edgeHalf = isPortrait ? tray.halfWidth : tray.halfDepth;
    const side = Math.random() < 0.5 ? -1 : 1;
    const offset = side * (0.2 + Math.random() * 0.7) * edgeHalf;

    if (isPortrait) {
        return new CANNON.Vec3(
            offset,
            2,
            whichSide ? -tray.halfDepth + 0.5 : tray.halfDepth - 0.5,
        );
    }
    return new CANNON.Vec3(
        whichSide ? -tray.halfWidth + 0.5 : tray.halfWidth - 0.5,
        2,
        offset,
    );
}

function startReturn(die: PhysicsDie, tray: Tray, whichSide: boolean): ReturningDie {
    die.body.type = CANNON.Body.KINEMATIC;
    die.body.velocity.setZero();
    die.body.angularVelocity.setZero();

    return {
        die,
        targetPos: getRerollTarget(tray, whichSide),
        progress: 0,
        whichSide,
    };
}

function stepReturn(returning: ReturningDie): boolean {
    returning.progress += 1 / POP_STEPS;
    returning.die.liftProgress = Math.min(returning.progress, 1);
    return returning.progress >= 1;
}

function launchReroll(returning: ReturningDie, tray: Tray): void {
    const { die, whichSide } = returning;

    die.liftProgress = 0;
    die.body.type = CANNON.Body.DYNAMIC;
    die.body.position.copy(returning.targetPos);
    die.body.quaternion.copy(randomQuaternion());
    die.body.wakeUp();

    applyGentleThrow(die, tray, whichSide);
}

export type Simulation = {
    cancel: () => Promise<void>;
    result: Promise<SimulateResult>;
};

export type Tray = {
    world: CANNON.World;
    halfWidth: number;
    halfDepth: number;
    initialHalfWidth: number;
    initialHalfDepth: number;
    walls: CANNON.Body[];
    dice: Die[];
    simulation: Simulation | undefined;
    generation: number;
    isDropping: boolean;
};

function createWalls(halfWidth: number, halfDepth: number): CANNON.Body[] {
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

    const rightWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: verticalWallShape,
        material: wallMaterial,
    });
    rightWall.position.set(halfWidth + WALL_THICKNESS, TRAY_WALL_HEIGHT, 0);

    const backWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
        material: wallMaterial,
    });
    backWall.position.set(0, TRAY_WALL_HEIGHT, -halfDepth - WALL_THICKNESS);

    const frontWall = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: horizontalWallShape,
        material: wallMaterial,
    });
    frontWall.position.set(0, TRAY_WALL_HEIGHT, halfDepth + WALL_THICKNESS);

    return [leftWall, rightWall, backWall, frontWall];
}

export function createTray(halfWidth: number, halfDepth: number): Tray {
    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -20, 0),
        allowSleep: true,
    });

    // fewer iterations, faster steps, overlapping dice have a tendency to jitter
    // more iterations, slower steps, cleaner collisions, faster settling
    const solver = new CANNON.SplitSolver(new CANNON.GSSolver());
    solver.iterations = 10;
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

    const walls = createWalls(halfWidth, halfDepth);
    for (const wall of walls) {
        world.addBody(wall);
    }

    return {
        world,
        halfWidth,
        halfDepth,
        initialHalfWidth: halfWidth,
        initialHalfDepth: halfDepth,
        walls,
        dice: [],
        simulation: undefined,
        generation: 0,
        isDropping: false,
    };
}

export function resizeTray(tray: Tray, halfWidth: number, halfDepth: number): void {
    for (const wall of tray.walls) {
        tray.world.removeBody(wall);
    }

    tray.walls = createWalls(halfWidth, halfDepth);
    for (const wall of tray.walls) {
        tray.world.addBody(wall);
    }

    tray.halfWidth = halfWidth;
    tray.halfDepth = halfDepth;
}

export function resizeToFitDice(tray: Tray, dice: PhysicsDie[]): void {
    const bounds = getPackedBounds(dice);
    const aspect = tray.initialHalfWidth / tray.initialHalfDepth;
    const isPortrait = tray.initialHalfDepth > tray.initialHalfWidth;

    // the dice about to be thrown must fit in one half of the tray
    const effectiveHalfWidth = isPortrait ? bounds.halfWidth : bounds.halfWidth * 2;
    const effectiveHalfDepth = isPortrait ? bounds.halfDepth * 2 : bounds.halfDepth;

    const size = Math.max(
        effectiveHalfWidth / Math.sqrt(aspect),
        effectiveHalfDepth * Math.sqrt(aspect),
    );
    const halfWidth = Math.max(tray.initialHalfWidth, size * Math.sqrt(aspect));
    const halfDepth = Math.max(tray.initialHalfDepth, size / Math.sqrt(aspect));
    resizeTray(tray, halfWidth, halfDepth);
}

export type SimulateOptions = {
    onStep?: () => void | Promise<void>;
    whichSide?: boolean;
    rerollCocked?: boolean;
};

export type SimulateStats = {
    elapsed: number;
    frames: number;
    physicsDrops: number;
    renderDrops: number;
};

export type SimulateResult =
    | { faces: number[]; rerollCount: number; stats: SimulateStats }
    | { cancelled: true };

export function simulateThrow(
    tray: Tray,
    dice: PhysicsDie[],
    options?: SimulateOptions,
): Simulation {
    const { world } = tray;

    let cancelled = false;

    const result = (async (): Promise<SimulateResult> => {
        // yield -- allow cancel to be called before simulation starts
        await Promise.resolve();

        const simulationStart = performance.now();

        let rerollCount = 0;
        let physicsSteps = 0;
        const side = options?.whichSide ?? Math.random() < 0.5;
        const returning: ReturningDie[] = [];
        const maxSteps = Math.round(MAX_SIMULATION_TIME / TIME_STEP);
        const timeStepMs = TIME_STEP * 1000;
        const minRenderInterval = 6;
        let lastRenderStep = 0;
        let shouldRender = true;
        let physicsDrops = 0;
        let renderDrops = 0;

        function stepPhysics(): void {
            world.step(TIME_STEP);

            // animate returning dice
            for (let i = returning.length - 1; i >= 0; i--) {
                if (stepReturn(returning[i])) {
                    launchReroll(returning[i], tray);
                    returning.splice(i, 1);
                }
            }
        }

        let allSettled = false;
        while (true) {
            if (cancelled) {
                return { cancelled: true };
            }

            stepPhysics();
            physicsSteps++;
            const simulatedTime = physicsSteps * timeStepMs;
            const wallClockElapsed = performance.now() - simulationStart;

            if (options?.onStep) {
                const stepsSinceRender = physicsSteps - lastRenderStep;
                const mustRender = stepsSinceRender >= minRenderInterval;
                tray.isDropping = stepsSinceRender >= 6;

                // check after physics: are we over time?
                const overTimeAfterPhysics = wallClockElapsed > simulatedTime;
                if (overTimeAfterPhysics) {
                    shouldRender = false;
                    physicsDrops++;
                }

                // skip when the render or physics sim is over budget for 60fps
                // animation, but always render every sixth frame for an approximation
                // of 10fps, as something visibly happening is better than nothing
                // even if it slows further
                if (shouldRender || mustRender) {
                    lastRenderStep = physicsSteps;
                    await options.onStep();

                    // check after render: are we now over time?
                    const overTimeAfterRender =
                        performance.now() - simulationStart > simulatedTime;
                    if (overTimeAfterRender) {
                        shouldRender = false;
                        renderDrops++;
                    } else {
                        shouldRender = true;
                    }
                } else if (!overTimeAfterPhysics) {
                    // didn't render, but physics is on time - render next frame
                    shouldRender = true;
                }
            } else {
                // headless mode - run as fast as possible
                if (Date.now() - lastYield >= 100) {
                    // yield every 100ms -- allows timeouts in tests to actually stop tests
                    lastYield = Date.now();
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            allSettled = true;
            for (const die of dice) {
                // skip dice that are returning to throw position
                if (returning.some((r) => r.die === die)) {
                    allSettled = false;
                    continue;
                }
                if (!isSettled(die)) {
                    allSettled = false;
                    continue;
                }
                const radius = (die.body.shapes[0] as CANNON.ConvexPolyhedron)
                    .boundingSphereRadius;
                const tooHigh = die.body.position.y > radius * 1.5;
                const rerollCocked = options?.rerollCocked ?? true;
                if (tooHigh || (rerollCocked && die.isCocked(COCKED_THRESHOLD))) {
                    rerollCount++;
                    returning.push(startReturn(die, tray, side));
                    allSettled = false;
                }
            }

            if (allSettled || physicsSteps >= maxSteps) {
                break;
            }
        }

        const elapsed = performance.now() - simulationStart;
        const stats: SimulateStats = {
            elapsed,
            frames: physicsSteps,
            physicsDrops,
            renderDrops,
        };

        return { faces: dice.map((die) => die.readFace()), rerollCount, stats };
    })();

    return {
        cancel: async () => {
            cancelled = true;
            await result;
        },
        result,
    };
}
