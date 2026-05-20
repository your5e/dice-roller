import { calculate, type Step } from "./calculate";
import { rollDice } from "./dice";
import { type Modifier, type ParsedDice, parse } from "./notation";
import { createTray, type Tray } from "./physics/tray";
import {
    createStage,
    type DiceGroup,
    getTrayDimensions,
    markDieDropped,
    removeDice,
    type Stage,
    setCameraSize,
    throwDice,
} from "./renderer";

function getDroppedIndices(values: number[], modifiers: Modifier[]): number[] {
    let currentIndices = values.map((_, i) => i);
    let currentValues = [...values];

    for (const mod of modifiers) {
        if (
            mod.type === "kh" ||
            mod.type === "kl" ||
            mod.type === "dh" ||
            mod.type === "dl"
        ) {
            const indexed = currentValues.map((value, i) => ({
                value,
                originalIndex: currentIndices[i],
            }));
            indexed.sort((a, b) => a.value - b.value);

            let keptIndices: number[];
            if (mod.type === "kh") {
                keptIndices = indexed.slice(-mod.value).map((x) => x.originalIndex);
            } else if (mod.type === "kl") {
                keptIndices = indexed.slice(0, mod.value).map((x) => x.originalIndex);
            } else if (mod.type === "dh") {
                keptIndices = indexed.slice(0, -mod.value).map((x) => x.originalIndex);
            } else {
                keptIndices = indexed.slice(mod.value).map((x) => x.originalIndex);
            }

            const keptSet = new Set(keptIndices);
            currentIndices = currentIndices.filter((i) => keptSet.has(i));
            currentValues = currentIndices.map((i) => values[i]);
        }
    }

    const keptSet = new Set(currentIndices);
    return values.map((_, i) => i).filter((i) => !keptSet.has(i));
}

type Expression = {
    notation: string;
    label?: string;
    steps: Step[];
    total: number;
};

type RollResult = {
    notation: string;
    total: number;
    label_totals: Record<string, number>;
    expressions: Expression[];
};

type RollCallback = (result: RollResult) => void;

let currentTray: Tray | undefined;
let currentStage: Stage | undefined;
let onRollCallback: RollCallback = () => {};

function buildExpressionNotation(expr: ParsedDice): string {
    let notation = "";
    if (expr.label !== undefined) {
        notation += `${expr.label}:`;
    }
    notation += `${expr.count}d${expr.sides}`;
    for (const mod of expr.modifiers) {
        notation += `${mod.type}${mod.value}`;
    }
    if (expr.bonus > 0) {
        notation += `+${expr.bonus}`;
    } else if (expr.bonus < 0) {
        notation += `${expr.bonus}`;
    }
    return notation;
}

function buildResult(
    notation: string,
    parsedExpressions: (ParsedDice | null)[],
    facesByIndex: Map<number, number[]>,
): RollResult {
    let total = 0;
    const label_totals: Record<string, number> = {};
    const expressions: Expression[] = [];

    for (let i = 0; i < parsedExpressions.length; i++) {
        const expr = parsedExpressions[i];
        if (expr === null) {
            continue;
        }

        const faces = facesByIndex.get(i);
        if (!faces) {
            continue;
        }

        const steps: Step[] = [];
        const diceNotation = `${expr.count}d${expr.sides}`;
        steps.push({ [diceNotation]: [...faces] });

        const result = calculate(
            faces,
            expr.modifiers,
            expr.bonus,
            () => rollDice(1, expr.sides)[0],
        );
        steps.push(...result.steps);

        if (expr.bonus !== 0) {
            steps.push({ bonus: expr.bonus });
        }

        const exprTotal = result.total;
        total += exprTotal;

        const labelKey = expr.label ?? "";
        label_totals[labelKey] = (label_totals[labelKey] ?? 0) + exprTotal;

        const expression: Expression = {
            notation: buildExpressionNotation(expr),
            steps,
            total: exprTotal,
        };
        if (expr.label !== undefined) {
            expression.label = expr.label;
        }
        expressions.push(expression);
    }

    return { notation, total, label_totals, expressions };
}

export function roll(input: string): RollResult;
export function roll(input: string, options: { sync: true }): Promise<RollResult>;
export function roll(
    input: string,
    options?: { sync?: boolean },
): RollResult | Promise<RollResult> {
    if (!currentTray) {
        throw new Error("No tray: call tray() before rolling");
    }

    const expressions = parse(input);

    type IndexedExpr = { index: number; expr: NonNullable<(typeof expressions)[0]> };
    const animated: IndexedExpr[] = [];

    for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (expr === null) {
            continue;
        }
        animated.push({ index: i, expr });
    }

    const groups: DiceGroup[] = animated.map(({ expr }) => ({
        count: expr.count,
        sides: expr.sides,
        label: expr.label,
    }));

    const trayForSimulation = currentTray;
    const stageForSimulation = currentStage;

    const runSimulation = async (): Promise<RollResult> => {
        const facesByIndex = new Map<number, number[]>();
        const result = await throwDice(trayForSimulation, groups, {
            stage: stageForSimulation,
        });

        if ("cancelled" in result) {
            return buildResult(input, expressions, facesByIndex);
        }

        for (let i = 0; i < animated.length; i++) {
            facesByIndex.set(animated[i].index, result.faces[i]);
        }

        const markDropped: Promise<void>[] = [];
        let diceOffset = 0;
        for (let i = 0; i < animated.length; i++) {
            const { expr } = animated[i];
            const faces = result.faces[i];
            const droppedIndices = getDroppedIndices(faces, expr.modifiers);
            for (const idx of droppedIndices) {
                markDropped.push(markDieDropped(result.dice[diceOffset + idx]));
            }
            diceOffset += expr.count;
        }
        await Promise.all(markDropped);

        const rollResult = buildResult(input, expressions, facesByIndex);
        onRollCallback(rollResult);
        return rollResult;
    };

    if (options?.sync) {
        return runSimulation();
    }

    runSimulation();
    return buildResult(input, expressions, new Map());
}

export function tray(options: string): Stage;
export function tray(options?: { halfWidth: number; halfDepth: number }): Tray;
export function tray(
    options?: string | { halfWidth: number; halfDepth: number },
): Tray | Stage {
    currentTray?.simulation?.cancel();
    if (typeof options === "string") {
        const container = document.querySelector(options);
        if (!(container instanceof HTMLElement)) {
            throw new Error(`Element not found: ${options}`);
        }
        const aspect = container.clientWidth / container.clientHeight;
        const { halfWidth, halfDepth } = getTrayDimensions(aspect, 10);
        currentTray = createTray(halfWidth, halfDepth);
        currentStage = createStage(container, currentTray);
        return currentStage;
    }
    if (options) {
        currentTray = createTray(options.halfWidth, options.halfDepth);
    } else {
        const { halfWidth, halfDepth } = getTrayDimensions(1, 10);
        currentTray = createTray(halfWidth, halfDepth);
    }

    return currentTray;
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
                roll(expression);
            });
        } else {
            element.addEventListener("click", () => {
                const expression =
                    element.getAttribute("data-roll") || element.textContent || "";
                roll(expression);
            });
        }
    }
}

export { createD4 } from "./geometries/d4";
export { createD6 } from "./geometries/d6";
export { createD8 } from "./geometries/d8";
export { createD10, createPercentile } from "./geometries/d10";
export { createD12 } from "./geometries/d12";
export { createD20 } from "./geometries/d20";
export type { Stage } from "./renderer";
export { D4DebugTexture } from "./textures/d4";
export { D6DebugTexture } from "./textures/d6";
export { D8DebugTexture } from "./textures/d8";
export { D10DebugTexture, DPercentileDebugTexture } from "./textures/d10";
export { D12DebugTexture } from "./textures/d12";
export { D20DebugTexture } from "./textures/d20";
export { removeDice, setCameraSize };
