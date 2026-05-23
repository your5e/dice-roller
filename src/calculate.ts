import type {
    ConstraintExpression,
    DiceExpression,
    Expression,
    Modifier,
} from "./notation";

export type Step = Record<string, number | number[]>;

type NeedsRoll = {
    type: "roll";
    label?: string;
    indices: number[];
    sides: number;
};
type NeedsResult = {
    type: "result";
    label: string;
};
type Done = {
    type: "done";
    label?: string;
    steps: Step[];
    total: number;
};
type NeedsReset = {
    type: "reset";
    label: string;
};
export type CalculatorState = NeedsRoll | NeedsResult | Done | NeedsReset;

export type Calculator = {
    state(): CalculatorState;
    provide(values: number[]): void;
};

function isConstraint(parsed: Expression): parsed is ConstraintExpression {
    return "type" in parsed && parsed.type === "rmt";
}

export function calculate(parsed: Expression): Calculator {
    if (isConstraint(parsed)) {
        return calculateConstraint(parsed);
    }
    return calculateDice(parsed);
}

function calculateConstraint(parsed: ConstraintExpression): Calculator {
    const { label, value } = parsed;
    let satisfied = false;
    let needsReset = false;

    return {
        state(): CalculatorState {
            if (needsReset) {
                return { type: "reset", label };
            }
            if (satisfied) {
                return { type: "done", label, steps: [], total: 0 };
            }
            return { type: "result", label };
        },

        provide(values: number[]): void {
            const total = values[0];
            if (total >= value) {
                satisfied = true;
                needsReset = false;
            } else {
                needsReset = true;
            }
        },
    };
}

function calculateDice(parsed: DiceExpression): Calculator {
    const { count, sides, modifiers, bonus, label } = parsed;

    let dice: number[] | null = null;
    let modifierIndex = 0;
    let pendingReroll: { indices: number[]; modifier: Modifier } | null = null;
    const steps: Step[] = [];

    function advance(current: number[]): number[] | null {
        while (modifierIndex < modifiers.length) {
            const modifier = modifiers[modifierIndex];
            const name = `${modifier.type}${modifier.value}`;

            switch (modifier.type) {
                case "kh":
                    current = keepHighest(current, modifier.value);
                    steps.push({ [name]: [...current] });
                    modifierIndex++;
                    break;

                case "kl":
                    current = keepLowest(current, modifier.value);
                    steps.push({ [name]: [...current] });
                    modifierIndex++;
                    break;

                case "dh":
                    current = dropHighest(current, modifier.value);
                    steps.push({ [name]: [...current] });
                    modifierIndex++;
                    break;

                case "dl":
                    current = dropLowest(current, modifier.value);
                    steps.push({ [name]: [...current] });
                    modifierIndex++;
                    break;

                case "m":
                    current = applyMinimum(current, modifier.value);
                    steps.push({ [name]: [...current] });
                    modifierIndex++;
                    break;

                case "rb":
                case "rm": {
                    const indices = findBelowThreshold(current, modifier.value);
                    if (indices.length > 0) {
                        pendingReroll = { indices, modifier };
                        return current;
                    }
                    steps.push({ [name]: [...current] });
                    modifierIndex++;
                    break;
                }

                case "rmt": {
                    const total = current.reduce((a, b) => a + b, 0);
                    steps.push({ [name]: [...current] });
                    if (total < modifier.value) {
                        modifierIndex = 0;
                        return null;
                    }
                    modifierIndex++;
                    break;
                }
            }
        }
        return current;
    }

    return {
        state(): CalculatorState {
            if (dice === null) {
                const indices = Array.from({ length: count }, (_, i) => i);
                const rollState: NeedsRoll = {
                    type: "roll",
                    sides,
                    indices,
                };
                if (label !== undefined) {
                    rollState.label = label;
                }
                return rollState;
            }

            if (pendingReroll !== null) {
                const rollState: NeedsRoll = {
                    type: "roll",
                    sides,
                    indices: pendingReroll.indices,
                };
                if (label !== undefined) {
                    rollState.label = label;
                }
                return rollState;
            }

            const total = dice.reduce((a, b) => a + b, 0) + bonus;
            const finalSteps = bonus !== 0 ? [...steps, { bonus }] : steps;
            const doneState: Done = {
                type: "done",
                steps: finalSteps,
                total,
            };
            if (label !== undefined) {
                doneState.label = label;
            }
            return doneState;
        },

        provide(values: number[]): void {
            if (dice === null) {
                const diceKey = `${count}d${sides}`;
                steps.push({ [diceKey]: [...values] });
                dice = advance([...values]);
                return;
            }

            if (pendingReroll !== null) {
                const { indices, modifier } = pendingReroll;
                const name = `${modifier.type}${modifier.value}`;

                for (let i = 0; i < indices.length; i++) {
                    dice[indices[i]] = values[i];
                }

                if (modifier.type === "rb") {
                    steps.push({ [name]: [...dice] });
                    modifierIndex++;
                    pendingReroll = null;
                    dice = advance(dice);
                } else if (modifier.type === "rm") {
                    steps.push({ [name]: [...dice] });
                    const newIndices = findBelowThreshold(dice, modifier.value);
                    if (newIndices.length > 0) {
                        pendingReroll = { indices: newIndices, modifier };
                    } else {
                        pendingReroll = null;
                        modifierIndex++;
                        dice = advance(dice);
                    }
                }
            }
        },
    };
}

function findBelowThreshold(dice: number[], threshold: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < dice.length; i++) {
        if (dice[i] < threshold) {
            indices.push(i);
        }
    }
    return indices;
}

function keepHighest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const keepIndices = new Set(indexed.slice(-count).map((item) => item.index));
    return dice.filter((_, index) => keepIndices.has(index));
}

function keepLowest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const keepIndices = new Set(indexed.slice(0, count).map((item) => item.index));
    return dice.filter((_, index) => keepIndices.has(index));
}

function dropHighest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const dropIndices = new Set(indexed.slice(-count).map((item) => item.index));
    return dice.filter((_, index) => !dropIndices.has(index));
}

function dropLowest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const dropIndices = new Set(indexed.slice(0, count).map((item) => item.index));
    return dice.filter((_, index) => !dropIndices.has(index));
}

function applyMinimum(dice: number[], threshold: number): number[] {
    return dice.map((value) => (value < threshold ? threshold : value));
}
