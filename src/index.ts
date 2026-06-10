import { calculate, type Step } from "./calculate";
import { getLabelStyles, isDamageLabel } from "./labels";
import {
    type ConstraintExpression,
    type DiceExpression,
    type Expression,
    type Modifier,
    parse,
} from "./notation";
import {
    createTray,
    packDice,
    resizeToFitDice,
    type TextureStyle,
    type Tray,
} from "./physics/tray";
import {
    applyGhostTexture,
    parkDice,
    presentResults,
    reserveRows,
} from "./presentation";
import {
    createDie,
    createStage,
    type DiceGroup,
    type DiceWrapper,
    getTrayDimensions,
    removeDice,
    resizeCamera,
    type Stage,
    setCameraSize,
    syncDie,
    throwDice,
} from "./renderer";

function isDiceExpression(expr: Expression): expr is DiceExpression {
    return "count" in expr;
}

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

type ResultExpression = {
    notation: string;
    label?: string;
    steps: Step[];
    total: number;
};

export type DiceCreationResult = {
    wrappersPerExpr: DiceWrapper[][];
    wrapperPhysicalStarts: number[][];
};

type TextureOptions = Parameters<typeof createDie>[2];

function buildTextureOptions(
    label: string | undefined,
    labelStyles: Map<
        string,
        ReturnType<typeof getLabelStyles> extends Map<string, infer V> ? V : never
    >,
): TextureOptions | undefined {
    if (!label) return undefined;
    const style = labelStyles.get(label);
    if (!style) return undefined;
    return {
        bgColour: style.colour,
        fgColour: style.fgColour,
        iconColour: style.iconColour,
        iconScale: style.iconScale,
        icon: style.icon,
    };
}

async function applyLabelStyle(
    die: import("./geometries/dice").Die,
    label: string | undefined,
    textureOptions: TextureOptions | undefined,
    useSelectedStyle: boolean,
): Promise<void> {
    die.label = label;
    die.icon = textureOptions?.icon;
    die.originalTextureOptions = textureOptions;
    if (!useSelectedStyle && textureOptions) {
        await die.replaceTexture(textureOptions);
    }
}

async function createRollDice(groups: DiceGroup[]): Promise<DiceCreationResult> {
    const labels = groups.map((g) => g.label).filter((l): l is string => !!l);
    const labelStyles = getLabelStyles(labels);
    const wrappersPerExpr: DiceWrapper[][] = [];
    const wrapperPhysicalStarts: number[][] = [];
    let physicalIndex = 0;

    for (const { count, sides, label } of groups) {
        const override = label
            ? isDamageLabel(label)
                ? (currentTray?.overrideDamageColours ?? false)
                : (currentTray?.overrideColours ?? false)
            : false;
        // override: use selected texture, ignoring label styling
        // no override: use standard texture with label styling
        const labelOptions = buildTextureOptions(label, labelStyles);
        const baseOptions = override ? undefined : labelOptions;
        const textureOptions =
            currentTray?.seed !== undefined
                ? { ...baseOptions, seed: currentTray.seed }
                : baseOptions;
        const useSelectedStyle = !label || override;
        const textureStyle = useSelectedStyle
            ? (currentTray?.textureStyle ?? "standard")
            : "standard";
        const exprWrappers: DiceWrapper[] = [];
        const exprStarts: number[] = [];
        for (let i = 0; i < count; i++) {
            const wrapper = await createDie(sides, textureStyle, textureOptions);
            exprWrappers.push(wrapper);
            exprStarts.push(physicalIndex);
            for (const die of wrapper.dice) {
                await applyLabelStyle(die, label, textureOptions, useSelectedStyle);
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
    expressions: ResultExpression[];
};

type RollCallback = (result: RollResult) => void;

let currentTray: Tray | undefined;
let currentStage: Stage | undefined;
let onRollCallback: RollCallback = () => {};

export type RollOptions = {
    dice?: DiceCreationResult;
};

export function roll(input: string, options?: RollOptions): Promise<RollResult> {
    if (!currentTray) {
        throw new Error("No tray: call tray() before rolling");
    }

    const expressions = parse(input);

    type IndexedDice = { index: number; expr: DiceExpression };
    type IndexedConstraint = { index: number; expr: ConstraintExpression };
    const diceExprs: IndexedDice[] = [];
    const constraints: IndexedConstraint[] = [];

    for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        if (expr === null) {
            continue;
        }
        if (isDiceExpression(expr)) {
            diceExprs.push({ index: i, expr });
        } else {
            constraints.push({ index: i, expr });
        }
    }

    const groups: DiceGroup[] = diceExprs.map(({ expr }) => ({
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

        const diceCalculators = diceExprs.map(({ expr }) => calculate(expr));
        const constraintCalculators = constraints.map(({ expr }) => calculate(expr));

        // cancel any in-progress simulation and clear old dice
        if (trayForSimulation.simulation) {
            await trayForSimulation.simulation.cancel();
        }
        if (trayForSimulation.generation !== myGeneration) return cancelled();
        removeDice(trayForSimulation, stageForSimulation);

        const { wrappersPerExpr, wrapperPhysicalStarts } =
            options?.dice ?? (await createRollDice(groups));
        if (trayForSimulation.generation !== myGeneration) return cancelled();

        // assign labels and textures to custom dice
        if (options?.dice) {
            const labels = diceExprs
                .map((a) => a.expr.label)
                .filter((l): l is string => !!l);
            const labelStyles = getLabelStyles(labels);

            for (let i = 0; i < wrappersPerExpr.length; i++) {
                const label = diceExprs[i].expr.label;
                const textureOptions = buildTextureOptions(label, labelStyles);
                for (const wrapper of wrappersPerExpr[i]) {
                    for (const die of wrapper.dice) {
                        await applyLabelStyle(die, label, textureOptions, false);
                    }
                }
            }
        }

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

        const parkingReservations = reserveRows(
            trayForSimulation,
            trayForSimulation.dice,
        );

        // helper to get indices that need rolling
        const getRollIndices = (): number[] => {
            const indices: number[] = [];
            for (let i = 0; i < diceCalculators.length; i++) {
                const state = diceCalculators[i].state();
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

        // roll loop with constraint checking
        let constraintsSatisfied = false;
        while (!constraintsSatisfied) {
            // roll all dice that need rolling
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

                for (let i = 0; i < diceCalculators.length; i++) {
                    const state = diceCalculators[i].state();
                    if (state.type === "roll") {
                        const values = state.indices.map((localIdx) =>
                            wrappersPerExpr[i][localIdx].readResult(),
                        );
                        diceCalculators[i].provide(values);
                    }
                }

                rollIndices = getRollIndices();
                if (rollIndices.length > 0) {
                    const keepSet = new Set(rollIndices);
                    await parkDice(
                        trayForSimulation.dice,
                        keepSet,
                        trayForSimulation,
                        parkingReservations,
                        stageForSimulation,
                    );
                    const physicsDice = rollIndices.map(
                        (i) => trayForSimulation.dice[i].physics,
                    );
                    packDice(physicsDice);
                }
            }

            // calculate label totals from dice
            const currentLabelTotals: Record<string, number> = {};
            for (let i = 0; i < diceExprs.length; i++) {
                const state = diceCalculators[i].state();
                if (state.type !== "done") {
                    throw new Error("Calculator not done after roll loop");
                }
                const labelKey = diceExprs[i].expr.label ?? "";
                currentLabelTotals[labelKey] =
                    (currentLabelTotals[labelKey] ?? 0) + state.total;
            }

            // check constraints
            constraintsSatisfied = true;
            for (let i = 0; i < constraints.length; i++) {
                const constraint = constraints[i].expr;
                const calc = constraintCalculators[i];

                // calculate total for this constraint's label
                let total: number;
                if (constraint.label === "*") {
                    total = Object.values(currentLabelTotals).reduce(
                        (a, b) => a + b,
                        0,
                    );
                } else {
                    total = currentLabelTotals[constraint.label] ?? 0;
                }

                calc.provide([total]);
                const state = calc.state();

                if (state.type === "reset") {
                    constraintsSatisfied = false;
                    // reset dice calculators matching this label
                    for (let j = 0; j < diceExprs.length; j++) {
                        const diceLabel = diceExprs[j].expr.label ?? "";
                        if (
                            constraint.label === "*" ||
                            diceLabel === constraint.label
                        ) {
                            diceCalculators[j] = calculate(diceExprs[j].expr);
                        }
                    }
                    // park done dice, reroll reset ones
                    const resetIndices = getRollIndices();
                    if (resetIndices.length > 0) {
                        const keepSet = new Set(resetIndices);
                        await parkDice(
                            trayForSimulation.dice,
                            keepSet,
                            trayForSimulation,
                            parkingReservations,
                            stageForSimulation,
                        );
                        const physicsDice = resetIndices.map(
                            (i) => trayForSimulation.dice[i].physics,
                        );
                        packDice(physicsDice);
                    }
                    break;
                }
            }
        }

        // Process results
        let total = 0;
        const label_totals: Record<string, number> = {};
        const resultExpressions: ResultExpression[] = [];
        const finalFaces: number[][] = [];

        for (let i = 0; i < diceExprs.length; i++) {
            const { expr } = diceExprs[i];
            const state = diceCalculators[i].state();
            if (state.type !== "done") {
                throw new Error("Calculator not done after roll loop");
            }

            total += state.total;

            const labelKey = expr.label ?? "";
            label_totals[labelKey] = (label_totals[labelKey] ?? 0) + state.total;

            const expression: ResultExpression = {
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
        for (let i = 0; i < diceExprs.length; i++) {
            const faces = finalFaces[i];
            const droppedIndices = getDroppedIndices(
                faces,
                diceExprs[i].expr.modifiers,
            );
            for (const idx of droppedIndices) {
                for (const die of wrappersPerExpr[i][idx].dice) {
                    die.dropped = true;
                    ghosting.push(applyGhostTexture(die));
                }
            }
        }
        await Promise.all(ghosting);

        await presentResults(
            trayForSimulation.dice,
            trayForSimulation,
            parkingReservations,
            stageForSimulation,
        );

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

export type TrayOptions = {
    seed?: number;
};

export function tray(selector: string, options?: TrayOptions): Stage;
export function tray(options?: { halfWidth: number; halfDepth: number }): Tray;
export function tray(
    selectorOrOptions?: string | { halfWidth: number; halfDepth: number },
    options?: TrayOptions,
): Tray | Stage {
    currentTray?.simulation?.cancel();
    if (typeof selectorOrOptions === "string") {
        const container = document.querySelector(selectorOrOptions);
        if (!(container instanceof HTMLElement)) {
            throw new Error(`Element not found: ${selectorOrOptions}`);
        }
        const aspect = container.clientWidth / container.clientHeight;
        const { halfWidth, halfDepth } = getTrayDimensions(aspect, 10);
        currentTray = createTray(halfWidth, halfDepth, undefined, options?.seed);
        currentStage = createStage(container, currentTray);
        return currentStage;
    }
    if (selectorOrOptions) {
        currentTray = createTray(
            selectorOrOptions.halfWidth,
            selectorOrOptions.halfDepth,
        );
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

export function texture(
    style: TextureStyle,
    options?: { asColours?: boolean; asDamage?: boolean },
): void {
    if (!currentTray) {
        throw new Error("No tray: call tray() before setting texture");
    }
    currentTray.textureStyle = style;
    if (options?.asColours !== undefined) {
        currentTray.overrideColours = options.asColours;
    }
    if (options?.asDamage !== undefined) {
        currentTray.overrideDamageColours = options.asDamage;
    }
}

export * as THREE from "three";
export { createD4 } from "./geometries/d4";
export { createD6 } from "./geometries/d6";
export { createD8 } from "./geometries/d8";
export { createD10, createPercentile, D10, DPercentile } from "./geometries/d10";
export { createD12 } from "./geometries/d12";
export { createD20 } from "./geometries/d20";
export { createDieBody, DEFAULT_DICE_CONFIG, type DiceConfig } from "./physics/dice";
export {
    applyFullThrow,
    applyGentleThrow,
    createTray,
    DEFAULT_TRAY_CONFIG,
    offsetToEdge,
    packDice,
    simulateThrow,
    type TextureStyle,
    type ThrowOptions,
    TIME_STEP,
    type TrayConfig,
} from "./physics/tray";
export { createStage, type DiceWrapper, type Stage } from "./renderer";
export {
    D4DebugTexture,
    D4KintsugiTexture,
    D4NightSkyTexture,
    D4PrideTexture,
    D4Texture,
} from "./textures/d4";
export {
    D6DebugTexture,
    D6KintsugiTexture,
    D6NightSkyTexture,
    D6PrideTexture,
    D6Texture,
} from "./textures/d6";
export {
    D8DebugTexture,
    D8KintsugiTexture,
    D8NightSkyTexture,
    D8PrideTexture,
    D8Texture,
} from "./textures/d8";
export {
    D10DebugTexture,
    D10KintsugiTexture,
    D10NightSkyTexture,
    D10PrideTexture,
    D10Texture,
    DPercentileDebugTexture,
    DPercentileKintsugiTexture,
    DPercentileNightSkyTexture,
    DPercentilePrideTexture,
    DPercentileTexture,
} from "./textures/d10";
export {
    D12DebugTexture,
    D12KintsugiTexture,
    D12NightSkyTexture,
    D12PrideTexture,
    D12Texture,
} from "./textures/d12";
export {
    D20DebugTexture,
    D20KintsugiTexture,
    D20NightSkyTexture,
    D20PrideTexture,
    D20Texture,
} from "./textures/d20";
export { getTrayDimensions, removeDice, resizeCamera, setCameraSize, syncDie };
