import * as CANNON from "cannon-es";
import * as THREE from "three";
import type { Die } from "./geometries/dice";
import type { Tray } from "./physics/tray";
import { syncDie } from "./renderer";
import { GHOST_COLOURS, type TextureOptions } from "./textures/dice";

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

export function resultPosition(
    tray: { halfWidth: number; halfDepth: number },
    existing: ParkedDie[],
    die: DieToPark,
    rows: RowReservation[],
    countForLabel: number,
): { x: number; z: number } {
    const leftEdge = -tray.halfWidth + PARKING_MARGIN;
    const rightBoundary = tray.halfWidth - PARKING_MARGIN;
    const rowWidth = rightBoundary - leftEdge;

    const myRows = rows.filter((r) => r.label === die.label);
    const dieWidth = die.halfWidth * 2;
    const dicePerRow = Math.floor((rowWidth + PARKING_GAP) / (dieWidth + PARKING_GAP));

    for (let rowIndex = 0; rowIndex < myRows.length; rowIndex++) {
        const row = myRows[rowIndex];
        const diceOnRow = existing.filter(
            (e) => e.label === die.label && Math.abs(e.z - row.z) < 0.3,
        );

        const diceOnThisRow = Math.min(
            dicePerRow,
            countForLabel - rowIndex * dicePerRow,
        );
        const rowTotalWidth =
            diceOnThisRow * dieWidth + (diceOnThisRow - 1) * PARKING_GAP;
        const rowStartX = -rowTotalWidth / 2 + die.halfWidth;

        if (diceOnRow.length < diceOnThisRow) {
            const x = rowStartX + diceOnRow.length * (dieWidth + PARKING_GAP);
            return { x, z: row.z };
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

function maxFlatHalfWidthFull(die: Die): number {
    let max = 0;
    for (const face of die.physics.faces) {
        // valueless faces (the d2 coin rim) are never a resting result
        if (face.value === 0) {
            continue;
        }
        const quat = die.orientToFace(face.value);
        const hw = flatHalfWidth(die, quat);
        if (hw > max) max = hw;
    }
    return max;
}

function maxFlatHalfWidth(die: Die): number {
    return maxFlatHalfWidthFull(die) * PARKED_SCALE;
}

export function reserveRows(
    tray: { halfWidth: number; halfDepth: number },
    dice: Die[],
): RowReservation[] {
    const groups = new Map<string | undefined, { count: number; halfWidth: number }>();
    for (const die of dice) {
        const hw = maxFlatHalfWidth(die);
        const existing = groups.get(die.label);
        if (existing) {
            existing.count++;
            existing.halfWidth = Math.max(existing.halfWidth, hw);
        } else {
            groups.set(die.label, { count: 1, halfWidth: hw });
        }
    }

    const leftEdge = -tray.halfWidth + PARKING_MARGIN;
    const rightBoundary = tray.halfWidth - PARKING_MARGIN;
    const rowWidth = rightBoundary - leftEdge;
    const frontEdge = tray.halfDepth - PARKING_MARGIN;

    const rows: RowReservation[] = [];
    let currentFront = frontEdge;

    for (const [label, group] of groups) {
        const dieWidth = group.halfWidth * 2;
        const dicePerRow = Math.floor(
            (rowWidth + PARKING_GAP) / (dieWidth + PARKING_GAP),
        );
        const rowsNeeded = Math.ceil(group.count / dicePerRow);

        for (let i = 0; i < rowsNeeded; i++) {
            const rowZ = currentFront - group.halfWidth;
            rows.push({ label, z: rowZ });
            currentFront = rowZ - group.halfWidth - PARKING_GAP;
        }
    }

    return rows;
}

export async function parkDice(
    dice: Die[],
    keepIndices: Set<number>,
    physicsTray: Tray,
    reservations: RowReservation[],
    stage?: { scene: THREE.Scene },
): Promise<void> {
    const topark: Die[] = [];

    for (let i = 0; i < dice.length; i++) {
        if (keepIndices.has(i)) continue;

        const die = dice[i];
        const body = die.physics.body;

        const inWorld = physicsTray.world.bodies.includes(body);
        if (!inWorld) continue;
        physicsTray.world.removeBody(body);
        topark.push(die);
    }

    if (topark.length === 0) return;

    const tray = {
        halfWidth: physicsTray.halfWidth,
        halfDepth: physicsTray.halfDepth,
    };

    const existing: ParkedDie[] = [];
    for (const die of dice) {
        if (die.parked && !topark.includes(die)) {
            existing.push({ ...die.parked, label: die.label });
        }
    }

    const parking: ParkingDie[] = [];
    for (const die of topark) {
        const targetQuat = die.orientToFace(die.readResult());
        const hw = flatHalfWidth(die, targetQuat) * PARKED_SCALE;
        const pos = parkingPosition(
            tray,
            existing,
            { label: die.label, halfWidth: hw },
            reservations,
        );
        die.parked = { x: pos.x, z: pos.z, halfWidth: hw };
        existing.push({ ...die.parked, label: die.label });

        if (stage) {
            const body = die.physics.body;
            parking.push({
                die,
                flatHalfWidth: hw,
                startPos: body.position.clone(),
                targetPos: new CANNON.Vec3(pos.x, hw, pos.z),
                startQuat: new THREE.Quaternion(
                    body.quaternion.x,
                    body.quaternion.y,
                    body.quaternion.z,
                    body.quaternion.w,
                ),
                targetQuat,
                progress: 0,
            });
        }
    }

    await Promise.all(topark.map((die) => applyGhostTexture(die)));

    // only animate if there is a stage
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

type ResultDie = {
    die: Die;
    flatHalfWidth: number;
    startPos: CANNON.Vec3;
    targetPos: CANNON.Vec3;
    startQuat: THREE.Quaternion;
    targetQuat: THREE.Quaternion;
    startScale: number;
    progress: number;
};

async function restoreNormalTexture(die: Die): Promise<void> {
    const material = die.mesh.material as THREE.MeshPhysicalMaterial;
    material.transparent = false;
    material.alphaTest = 0;
    await die.replaceTexture(die.originalTextureOptions ?? {});
}

type ResultGroup = {
    label: string | undefined;
    count: number;
    halfWidth: number;
    dicePerRow: number;
    rowsNeeded: number;
};

function resultLayout(
    tray: { halfWidth: number; halfDepth: number },
    dice: Die[],
): { groups: ResultGroup[]; rows: { label: string | undefined; z: number }[] } {
    const groupMap = new Map<
        string | undefined,
        { count: number; halfWidth: number }
    >();
    for (const die of dice) {
        const hw = maxFlatHalfWidthFull(die);
        const existing = groupMap.get(die.label);
        if (existing) {
            existing.count++;
            existing.halfWidth = Math.max(existing.halfWidth, hw);
        } else {
            groupMap.set(die.label, { count: 1, halfWidth: hw });
        }
    }

    const rowWidth = (tray.halfWidth - PARKING_MARGIN) * 2;
    const groups: ResultGroup[] = [];
    let totalHeight = 0;

    for (const [label, group] of groupMap) {
        const dieWidth = group.halfWidth * 2;
        const dicePerRow = Math.max(
            1,
            Math.floor((rowWidth + PARKING_GAP) / (dieWidth + PARKING_GAP)),
        );
        const rowsNeeded = Math.ceil(group.count / dicePerRow);
        groups.push({
            label,
            count: group.count,
            halfWidth: group.halfWidth,
            dicePerRow,
            rowsNeeded,
        });
        totalHeight +=
            rowsNeeded * group.halfWidth * 2 + (rowsNeeded - 1) * PARKING_GAP;
    }

    if (groups.length > 1) {
        totalHeight += (groups.length - 1) * PARKING_GAP;
    }

    const rows: { label: string | undefined; z: number }[] = [];
    let currentZ = -totalHeight / 2;

    for (const group of groups) {
        for (let i = 0; i < group.rowsNeeded; i++) {
            currentZ += group.halfWidth;
            rows.push({ label: group.label, z: currentZ });
            currentZ += group.halfWidth + PARKING_GAP;
        }
    }

    return { groups, rows };
}

export async function presentResults(
    dice: Die[],
    physicsTray: Tray,
    _reservations: RowReservation[],
    stage?: { scene: THREE.Scene },
): Promise<void> {
    const parkedDice = dice.filter((d) => d.parked);
    if (parkedDice.length === 0) return;

    const tray = {
        halfWidth: physicsTray.halfWidth,
        halfDepth: physicsTray.halfDepth,
    };

    const restoring: Promise<void>[] = [];
    for (const die of dice) {
        if (die.parked && !die.dropped) {
            restoring.push(restoreNormalTexture(die));
        }
    }
    await Promise.all(restoring);

    const { groups, rows } = resultLayout(tray, dice);
    const groupMap = new Map(groups.map((g) => [g.label, g]));

    // sort by label (in group order), then value, then kept->dropped
    const labelOrder = new Map(groups.map((g, i) => [g.label, i]));
    const sortedDice = [...dice].sort((a, b) => {
        const labelDiff =
            (labelOrder.get(a.label) ?? 0) - (labelOrder.get(b.label) ?? 0);
        if (labelDiff !== 0) return labelDiff;
        const valueDiff = b.readResult() - a.readResult();
        if (valueDiff !== 0) return valueDiff;
        return (a.dropped ? 1 : 0) - (b.dropped ? 1 : 0);
    });

    const existing: ParkedDie[] = [];
    const presenting: ResultDie[] = [];

    for (const die of sortedDice) {
        const targetQuat = die.orientToFace(die.readResult());
        const hwFull = flatHalfWidth(die, targetQuat);
        const group = groupMap.get(die.label);
        if (!group) {
            throw new Error(`No group for label: ${die.label}`);
        }
        const pos = resultPosition(
            tray,
            existing,
            { label: die.label, halfWidth: group.halfWidth },
            rows,
            group.count,
        );

        die.result = { x: pos.x, z: pos.z, halfWidth: group.halfWidth };
        existing.push({ ...die.result, label: die.label });

        if (stage) {
            const body = die.physics.body;
            presenting.push({
                die,
                flatHalfWidth: hwFull,
                startPos: body.position.clone(),
                targetPos: new CANNON.Vec3(pos.x, hwFull, pos.z),
                startQuat: new THREE.Quaternion(
                    body.quaternion.x,
                    body.quaternion.y,
                    body.quaternion.z,
                    body.quaternion.w,
                ),
                targetQuat,
                startScale: die.mesh.scale.x,
                progress: 0,
            });
        }
    }

    while (presenting.some((p) => p.progress < 1)) {
        for (const p of presenting) {
            stepResult(p);
            syncDie(p.die);
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
}

function stepResult(result: ResultDie): void {
    result.progress = Math.min(1, result.progress + 1 / PARK_STEPS);
    const t = easeInOut(result.progress);
    const body = result.die.physics.body;
    body.position.set(
        result.startPos.x + (result.targetPos.x - result.startPos.x) * t,
        result.startPos.y + (result.targetPos.y - result.startPos.y) * t,
        result.startPos.z + (result.targetPos.z - result.startPos.z) * t,
    );
    const slerpedQuat = result.startQuat.clone().slerp(result.targetQuat, t);
    body.quaternion.set(slerpedQuat.x, slerpedQuat.y, slerpedQuat.z, slerpedQuat.w);

    const scale = result.startScale + (1 - result.startScale) * t;
    result.die.mesh.scale.set(scale, scale, scale);
}
