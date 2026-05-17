import { type Step, calculate } from "./calculate";
import type { DebugDieType } from "./debug";
import { rollDice } from "./dice";
import { parse } from "./notation";
import {
    type TrayState,
    createTray,
    roll as rollInTray,
    setDebugDie as setDebugDieInTray,
} from "./renderer";

type RollResult = {
    notation: string;
    steps: Step[];
    total: number;
};

type RollCallback = (result: RollResult) => void;

let activeTray: TrayState | null = null;
let onRollCallback: RollCallback = (result) => console.log(result);

export function roll(input: string): RollResult {
    const expressions = parse(input);
    let total = 0;
    const steps: Step[] = [];

    for (const expr of expressions) {
        if (expr === null) {
            continue;
        }

        const diceNotation = `${expr.count}d${expr.sides}`;
        const dice = rollDice(expr.count, expr.sides);
        steps.push({ [diceNotation]: [...dice] });

        const result = calculate(
            dice,
            expr.modifiers,
            expr.bonus,
            () => rollDice(1, expr.sides)[0],
        );
        total += result.total;
        steps.push(...result.steps);
    }

    return { notation: input, steps, total };
}

const animatedDice = new Set([4, 6, 8, 10, 12, 20]);

function rollWithPhysics(input: string): void {
    const expressions = parse(input);

    if (!activeTray) {
        onRollCallback(roll(input));
        return;
    }

    // separate out the physical rolls we can do, the rest are mathematical
    type IndexedExpr = { index: number; expr: NonNullable<(typeof expressions)[0]> };
    const animated: IndexedExpr[] = [];
    const mathematical: IndexedExpr[] = [];

    for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (expr === null) {
            continue;
        }
        if (animatedDice.has(expr.sides)) {
            animated.push({ index: i, expr });
        } else {
            mathematical.push({ index: i, expr });
        }
    }

    // roll mathematically first, in order to quick exit if no physical rolls
    type MathResult = { faces: number[]; calcResult: ReturnType<typeof calculate> };
    const mathResults = new Map<number, MathResult>();
    for (const { index, expr } of mathematical) {
        const faces = rollDice(expr.count, expr.sides);
        const calcResult = calculate(
            faces,
            expr.modifiers,
            expr.bonus,
            () => rollDice(1, expr.sides)[0],
        );
        mathResults.set(index, { faces, calcResult });
    }
    if (animated.length === 0) {
        onRollCallback(roll(input));
        return;
    }

    // physical rolls
    const groups = animated.map(({ expr }) => ({
        count: expr.count,
        sides: expr.sides,
    }));
    rollInTray(activeTray, groups).then((groupedFaces) => {
        let total = 0;
        const steps: Step[] = [];

        // Combine results in original order
        let animatedIndex = 0;
        for (let i = 0; i < expressions.length; i++) {
            const expr = expressions[i];
            if (expr === null) {
                continue;
            }

            const diceNotation = `${expr.count}d${expr.sides}`;
            const mathResult = mathResults.get(i);

            if (mathResult) {
                steps.push({ [diceNotation]: mathResult.faces });
                total += mathResult.calcResult.total;
                steps.push(...mathResult.calcResult.steps);
            } else {
                const faces = groupedFaces[animatedIndex++];
                steps.push({ [diceNotation]: faces });
                const calcResult = calculate(
                    faces,
                    expr.modifiers,
                    expr.bonus,
                    () => Math.floor(Math.random() * expr.sides) + 1,
                );
                total += calcResult.total;
                steps.push(...calcResult.steps);
            }
        }

        onRollCallback({ notation: input, steps, total });
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
