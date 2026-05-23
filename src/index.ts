import { calculate, type Step } from "./calculate";
import { getLabelStyles } from "./labels";
import { type Modifier, parse } from "./notation";
import { createTray, packDice, resizeToFitDice, type Tray } from "./physics/tray";
import {
    applyGhostTexture,
    createDie,
    createStage,
    type DiceGroup,
    type DiceWrapper,
    getTrayDimensions,
    parkDice,
    removeDice,
    resizeCamera,
    type Stage,
    setCameraSize,
    syncDie,
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

type DiceCreationResult = {
    wrappersPerExpr: DiceWrapper[][];
    wrapperPhysicalStarts: number[][];
};

async function createRollDice(groups: DiceGroup[]): Promise<DiceCreationResult> {
    const labels = groups.map((g) => g.label).filter((l): l is string => !!l);
    const labelStyles = getLabelStyles(labels);
    const wrappersPerExpr: DiceWrapper[][] = [];
    const wrapperPhysicalStarts: number[][] = [];
    let physicalIndex = 0;

    for (const { count, sides, label } of groups) {
        let textureOptions: Parameters<typeof createDie>[1];
        if (label) {
            const style = labelStyles.get(label);
            if (!style) throw new Error(`No style for label "${label}"`);
            textureOptions = {
                bgColour: style.colour,
                fgColour: style.fgColour,
                iconColour: style.iconColour,
                iconScale: style.iconScale,
                icon: style.icon,
            };
        }
        const exprWrappers: DiceWrapper[] = [];
        const exprStarts: number[] = [];
        for (let i = 0; i < count; i++) {
            const wrapper = await createDie(sides, textureOptions);
            exprWrappers.push(wrapper);
            exprStarts.push(physicalIndex);
            for (const die of wrapper.dice) {
                die.label = label;
                die.icon = textureOptions?.icon;
                physicalIndex++;
            }
        }
        wrappersPerExpr.push(exprWrappers);
        wrapperPhysicalStarts.push(exprStarts);
    }

    return { wrappersPerExpr, wrapperPhysicalStarts };
}

function addDiceToTray(
    wrappersPerExpr: DiceWrapper[][],
    tray: Tray,
    stage: Stage | undefined,
): void {
    for (const wrappers of wrappersPerExpr) {
        for (const wrapper of wrappers) {
            for (const die of wrapper.dice) {
                tray.world.addBody(die.physics.body);
                tray.dice.push(die);
                if (stage) {
                    stage.scene.add(die.mesh);
                    syncDie(die);
                }
            }
        }
    }
}

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

export function roll(input: string): Promise<RollResult> {
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
        const myGeneration = ++trayForSimulation.generation;
        const cancelled = (): RollResult => ({
            notation: input,
            total: 0,
            label_totals: {},
            expressions: [],
        });

        const calculators = animated.map(({ expr }) => calculate(expr));

        // cancel any in-progress simulation and clear old dice
        if (trayForSimulation.simulation) {
            await trayForSimulation.simulation.cancel();
        }
        if (trayForSimulation.generation !== myGeneration) return cancelled();
        removeDice(trayForSimulation, stageForSimulation);

        const { wrappersPerExpr, wrapperPhysicalStarts } = await createRollDice(groups);
        if (trayForSimulation.generation !== myGeneration) return cancelled();
        addDiceToTray(wrappersPerExpr, trayForSimulation, stageForSimulation);

        if (trayForSimulation.dice.length === 0) {
            const emptyResult: RollResult = {
                notation: input,
                total: 0,
                label_totals: {},
                expressions: [],
            };
            onRollCallback(emptyResult);
            return emptyResult;
        }

        // pack dice and resize tray
        const allPhysicsDice = trayForSimulation.dice.map((d) => d.physics);
        packDice(allPhysicsDice);
        resizeToFitDice(trayForSimulation, allPhysicsDice);
        if (stageForSimulation) {
            resizeCamera(
                stageForSimulation,
                trayForSimulation.halfWidth,
                trayForSimulation.halfDepth,
            );
        }

        // helper to get indices that need rolling
        const getRollIndices = (): number[] => {
            const indices: number[] = [];
            for (let i = 0; i < calculators.length; i++) {
                const state = calculators[i].state();
                if (state.type === "roll") {
                    for (const localIdx of state.indices) {
                        const wrapper = wrappersPerExpr[i][localIdx];
                        const startIdx = wrapperPhysicalStarts[i][localIdx];
                        for (let j = 0; j < wrapper.dice.length; j++) {
                            indices.push(startIdx + j);
                        }
                    }
                }
            }
            return indices;
        };

        // roll loop
        let rollIndices = getRollIndices();
        while (rollIndices.length > 0) {
            const result = await throwDice(trayForSimulation, rollIndices, {
                stage: stageForSimulation,
            });

            if ("cancelled" in result) {
                const emptyResult: RollResult = {
                    notation: input,
                    total: 0,
                    label_totals: {},
                    expressions: [],
                };
                onRollCallback(emptyResult);
                return emptyResult;
            }

            for (let i = 0; i < calculators.length; i++) {
                const state = calculators[i].state();
                if (state.type === "roll") {
                    const values = state.indices.map((localIdx) =>
                        wrappersPerExpr[i][localIdx].readResult(),
                    );
                    calculators[i].provide(values);
                }
            }

            rollIndices = getRollIndices();
            if (rollIndices.length > 0) {
                const keepSet = new Set(rollIndices);
                await parkDice(
                    trayForSimulation.dice,
                    keepSet,
                    trayForSimulation,
                    stageForSimulation,
                );
                const physicsDice = rollIndices.map(
                    (i) => trayForSimulation.dice[i].physics,
                );
                packDice(physicsDice);
            }
        }

        // Process results
        let total = 0;
        const label_totals: Record<string, number> = {};
        const resultExpressions: Expression[] = [];
        const finalFaces: number[][] = [];

        for (let i = 0; i < animated.length; i++) {
            const { expr } = animated[i];
            const state = calculators[i].state();
            if (state.type !== "done") {
                throw new Error("Calculator not done after roll loop");
            }

            total += state.total;

            const labelKey = expr.label ?? "";
            label_totals[labelKey] = (label_totals[labelKey] ?? 0) + state.total;

            const expression: Expression = {
                notation: expr.expression,
                steps: state.steps,
                total: state.total,
            };
            if (state.label !== undefined) {
                expression.label = state.label;
            }
            resultExpressions.push(expression);

            // Track final faces for dropped dice marking
            const currentFaces = wrappersPerExpr[i].map((w) => w.readResult());
            finalFaces.push(currentFaces);
        }

        // Ghost dropped dice
        const ghosting: Promise<void>[] = [];
        for (let i = 0; i < animated.length; i++) {
            const faces = finalFaces[i];
            const droppedIndices = getDroppedIndices(faces, animated[i].expr.modifiers);
            for (const idx of droppedIndices) {
                for (const die of wrappersPerExpr[i][idx].dice) {
                    ghosting.push(applyGhostTexture(die));
                }
            }
        }
        await Promise.all(ghosting);

        const rollResult: RollResult = {
            notation: input,
            total,
            label_totals,
            expressions: resultExpressions,
        };
        onRollCallback(rollResult);
        return rollResult;
    };

    return runSimulation();
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

export * as THREE from "three";
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
