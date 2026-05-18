import { type Step, calculate } from "./calculate";
import type { DebugDieType } from "./debug";
import { rollDice } from "./dice";
import { type ParsedDice, parse } from "./notation";
import {
    type TrayState,
    createTray,
    roll as rollInTray,
    setDebugDie as setDebugDieInTray,
} from "./renderer";

type RollResult = {
    notation: string;
    steps: Step[];
    labels: Record<string, number>;
    total: number;
};

type RollCallback = (result: RollResult) => void;

let activeTray: TrayState | null = null;
let onRollCallback: RollCallback = (result) => console.log(result);

function buildResult(
    notation: string,
    expressions: (ParsedDice | null)[],
    facesByIndex: Map<number, number[]>,
): RollResult {
    let total = 0;
    const steps: Step[] = [];
    const labels: Record<string, number> = {};

    for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (expr === null) {
            continue;
        }

        const faces = facesByIndex.get(i);
        if (!faces) {
            continue;
        }

        const diceNotation = `${expr.count}d${expr.sides}`;
        steps.push({ [diceNotation]: [...faces] });

        const result = calculate(
            faces,
            expr.modifiers,
            expr.bonus,
            () => rollDice(1, expr.sides)[0],
        );
        total += result.total;
        steps.push(...result.steps);

        if (expr.label) {
            labels[expr.label] = (labels[expr.label] ?? 0) + result.total;
        }
    }

    return { notation, steps, labels, total };
}

export function roll(input: string): RollResult {
    const expressions = parse(input);
    const facesByIndex = new Map<number, number[]>();

    for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (expr !== null) {
            facesByIndex.set(i, rollDice(expr.count, expr.sides));
        }
    }

    return buildResult(input, expressions, facesByIndex);
}

const animatedDice = new Set([4, 6, 8, 10, 12, 20, 100]);

function rollWithPhysics(input: string): void {
    const expressions = parse(input);

    if (!activeTray) {
        onRollCallback(roll(input));
        return;
    }

    // roll mathematical dice first to enable quick exit if no physical rolls
    type IndexedExpr = { index: number; expr: NonNullable<(typeof expressions)[0]> };
    const animated: IndexedExpr[] = [];
    const facesByIndex = new Map<number, number[]>();

    for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (expr === null) {
            continue;
        }
        if (animatedDice.has(expr.sides)) {
            animated.push({ index: i, expr });
        } else {
            facesByIndex.set(i, rollDice(expr.count, expr.sides));
        }
    }

    if (animated.length === 0) {
        onRollCallback(buildResult(input, expressions, facesByIndex));
        return;
    }

    // physical rolls
    const groups = animated.map(({ expr }) => ({
        count: expr.count,
        sides: expr.sides,
    }));
    rollInTray(activeTray, groups).then((groupedFaces) => {
        for (let i = 0; i < animated.length; i++) {
            facesByIndex.set(animated[i].index, groupedFaces[i]);
        }
        onRollCallback(buildResult(input, expressions, facesByIndex));
    });
}

export function tray(selector: string): TrayState {
    const container = document.querySelector(selector);
    if (!(container instanceof HTMLElement)) {
        throw new Error(`Element not found: ${selector}`);
    }
    activeTray = createTray(container);
    return activeTray;
}

export function onRoll(callback: RollCallback): void {
    onRollCallback = callback;
}

export function bind(selector: string): void {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
        if (element instanceof HTMLFormElement) {
            const input = element.querySelector("input");
            element.addEventListener("submit", (e) => {
                e.preventDefault();
                const expression = input?.value || "";
                rollWithPhysics(expression);
            });
        } else {
            element.addEventListener("click", () => {
                const expression =
                    element.getAttribute("data-roll") || element.textContent || "";
                rollWithPhysics(expression);
            });
        }
    }
}

export function setDebugDie(sides: DebugDieType): void {
    if (activeTray) {
        setDebugDieInTray(activeTray, sides);
    }
}

export type { DebugDieType } from "./debug";
export type { TrayState } from "./renderer";
