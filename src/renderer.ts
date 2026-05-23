import * as CANNON from "cannon-es";
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
import { GHOST_COLOURS, type TextureOptions } from "./textures/dice";

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

export async function throwDice(
    physicsTray: Tray,
    indicesToThrow: number[],
    options?: ThrowOptions,
): Promise<number[] | { cancelled: true }> {
    const stage = options?.stage;
    const whichSide = options?.whichSide ?? Math.random() < 0.5;
    const dice = physicsTray.dice;
    const throwSet = new Set(indicesToThrow);

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

    // build faces array: keepers keep their face, thrown get new faces
    const allFaces: number[] = [];
    let thrownIndex = 0;
    for (let i = 0; i < dice.length; i++) {
        if (throwSet.has(i)) {
            allFaces.push(result.faces[thrownIndex++]);
        } else {
            allFaces.push(dice[i].physics.readFace());
        }
    }
    return allFaces;
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

export async function applyGhostTexture(die: Die): Promise<void> {
    const material = die.mesh.material as THREE.MeshPhysicalMaterial;
    material.transparent = true;
    material.alphaTest = 0.25;
    const options: TextureOptions = { ...GHOST_COLOURS };
    if (die.icon) {
        options.icon = die.icon;
    }
    await die.replaceTexture(options);
}

type ParkingDie = {
    die: Die;
    flatHalfWidth: number;
    startPos: CANNON.Vec3;
    targetPos: CANNON.Vec3;
    startQuat: THREE.Quaternion;
    targetQuat: THREE.Quaternion;
    progress: number;
};

const PARKED_SCALE = 0.65;
export const PARKING_GAP = 0.15;
export const PARKING_MARGIN = 0.5;

export type ParkedDie = { label?: string; x: number; z: number; halfWidth: number };
type DieToPark = { label?: string; halfWidth: number };
export type RowReservation = { label?: string; z: number };

export function reserveRows(
    tray: { halfWidth: number; halfDepth: number },
    groups: Array<{ label?: string; count: number; halfWidth: number }>,
): RowReservation[] {
    const leftEdge = -tray.halfWidth + PARKING_MARGIN;
    const rightBoundary = tray.halfWidth - PARKING_MARGIN;
    const rowWidth = rightBoundary - leftEdge;
    const frontEdge = tray.halfDepth - PARKING_MARGIN;

    const rows: RowReservation[] = [];
    let currentFront = frontEdge;

    for (const group of groups) {
        const dieWidth = group.halfWidth * 2;
        const dicePerRow = Math.floor(
            (rowWidth + PARKING_GAP) / (dieWidth + PARKING_GAP),
        );
        const rowsNeeded = Math.ceil(group.count / dicePerRow);

        for (let i = 0; i < rowsNeeded; i++) {
            const rowZ = currentFront - group.halfWidth;
            rows.push({ label: group.label, z: rowZ });
            currentFront = rowZ - group.halfWidth - PARKING_GAP;
        }
    }

    return rows;
}

export function parkingPosition(
    tray: { halfWidth: number; halfDepth: number },
    existing: ParkedDie[],
    die: DieToPark,
    rows: RowReservation[],
): { x: number; z: number } {
    const leftEdge = -tray.halfWidth + PARKING_MARGIN;
    const rightBoundary = tray.halfWidth - PARKING_MARGIN;

    const myRows = rows.filter((r) => r.label === die.label);

    for (const row of myRows) {
        const diceOnRow = existing.filter(
            (e) => e.label === die.label && Math.abs(e.z - row.z) < 0.3,
        );

        let nextX = leftEdge;
        for (const e of diceOnRow) {
            const rightEdge = e.x + e.halfWidth + PARKING_GAP;
            if (rightEdge > nextX) {
                nextX = rightEdge;
            }
        }

        if (nextX + die.halfWidth * 2 <= rightBoundary) {
            return { x: nextX + die.halfWidth, z: row.z };
        }
    }

    throw new Error("No space in reserved rows");
}

function flatHalfWidth(die: Die, quaternion: THREE.Quaternion): number {
    const shape = die.physics.body.shapes[0] as CANNON.ConvexPolyhedron;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const v of shape.vertices) {
        const rotated = new THREE.Vector3(v.x, v.y, v.z).applyQuaternion(quaternion);
        minX = Math.min(minX, rotated.x);
        maxX = Math.max(maxX, rotated.x);
    }
    return (maxX - minX) / 2;
}

function maxFlatHalfWidth(die: Die): number {
    let max = 0;
    for (const face of die.physics.faces) {
        const quat = die.orientToFace(face.value);
        const hw = flatHalfWidth(die, quat);
        if (hw > max) max = hw;
    }
    return max * PARKED_SCALE;
}

export async function parkDice(
    dice: Die[],
    keepIndices: Set<number>,
    physicsTray: Tray,
    stage?: Stage,
): Promise<void> {
    const parking: ParkingDie[] = [];

    for (let i = 0; i < dice.length; i++) {
        if (keepIndices.has(i)) continue;

        const die = dice[i];
        const body = die.physics.body;

        if (!physicsTray.world.bodies.includes(body)) continue;
        physicsTray.world.removeBody(body);

        if (stage) {
            const startQuat = new THREE.Quaternion(
                body.quaternion.x,
                body.quaternion.y,
                body.quaternion.z,
                body.quaternion.w,
            );
            const targetQuat = die.orientToFace(die.readResult());
            parking.push({
                die,
                flatHalfWidth: flatHalfWidth(die, targetQuat) * PARKED_SCALE,
                startPos: body.position.clone(),
                targetPos: new CANNON.Vec3(0, 0, 0),
                startQuat,
                targetQuat,
                progress: 0,
            });
        }
    }

    if (parking.length === 0) return;

    // calculate row reservations from the dice being kept
    const reservationGroups = new Map<
        string | undefined,
        { count: number; halfWidth: number }
    >();
    for (let i = 0; i < dice.length; i++) {
        if (keepIndices.has(i)) continue;
        const die = dice[i];
        const hw = maxFlatHalfWidth(die);
        const existing = reservationGroups.get(die.label);
        if (existing) {
            existing.count++;
            existing.halfWidth = Math.max(existing.halfWidth, hw);
        } else {
            reservationGroups.set(die.label, { count: 1, halfWidth: hw });
        }
    }
    const tray = {
        halfWidth: physicsTray.halfWidth,
        halfDepth: physicsTray.halfDepth,
    };
    const reservations = reserveRows(
        tray,
        Array.from(reservationGroups.entries()).map(([label, g]) => ({
            label,
            count: g.count,
            halfWidth: g.halfWidth,
        })),
    );

    const existing: ParkedDie[] = [];
    for (const die of dice) {
        if (die.parked && !parking.some((p) => p.die === die)) {
            existing.push({ ...die.parked, label: die.label });
        }
    }

    for (const p of parking) {
        const pos = parkingPosition(
            tray,
            existing,
            { label: p.die.label, halfWidth: p.flatHalfWidth },
            reservations,
        );
        p.targetPos.set(pos.x, p.flatHalfWidth, pos.z);
        p.die.parked = { x: pos.x, z: pos.z, halfWidth: p.flatHalfWidth };
        existing.push({ ...p.die.parked, label: p.die.label });
    }

    await Promise.all(parking.map((p) => applyGhostTexture(p.die)));

    while (parking.some((p) => p.progress < 1)) {
        for (const p of parking) {
            stepParking(p);
            syncDie(p.die);
            applyParkingScale(p);
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
}

const PARK_DURATION = 1;
const PARK_STEPS = PARK_DURATION / (1 / 60);

function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function stepParking(parking: ParkingDie): void {
    parking.progress = Math.min(1, parking.progress + 1 / PARK_STEPS);
    const t = easeInOut(parking.progress);
    const body = parking.die.physics.body;
    body.position.set(
        parking.startPos.x + (parking.targetPos.x - parking.startPos.x) * t,
        parking.startPos.y + (parking.targetPos.y - parking.startPos.y) * t,
        parking.startPos.z + (parking.targetPos.z - parking.startPos.z) * t,
    );
    const slerpedQuat = parking.startQuat.clone().slerp(parking.targetQuat, t);
    body.quaternion.set(slerpedQuat.x, slerpedQuat.y, slerpedQuat.z, slerpedQuat.w);
}

function applyParkingScale(parking: ParkingDie): void {
    const t = easeInOut(parking.progress);
    const scale = 1 + (PARKED_SCALE - 1) * t;
    parking.die.mesh.scale.set(scale, scale, scale);
}
