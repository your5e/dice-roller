import type { Modifier } from "./notation";

export type Step = Record<string, number[]>;

type Result = {
    steps: Step[];
    total: number;
};

type ModifierResult = {
    result: number[];
    steps: Step[];
};

export function calculate(
    dice: number[],
    modifiers: Modifier[],
    bonus: number,
    rerollFn: () => number,
): Result {
    let current = [...dice];
    const steps: Step[] = [];

    for (const modifier of modifiers) {
        const modResult = applyModifier(current, modifier, rerollFn);
        current = modResult.result;
        steps.push(...modResult.steps);
    }

    const total = current.reduce((a, b) => a + b, 0) + bonus;
    return { steps, total };
}

function applyModifier(
    dice: number[],
    modifier: Modifier,
    rerollFn: () => number,
): ModifierResult {
    const name = `${modifier.type}${modifier.value}`;

    switch (modifier.type) {
        case "kh": {
            const result = keepHighest(dice, modifier.value);
            return { result, steps: [{ [name]: result }] };
        }
        case "kl": {
            const result = keepLowest(dice, modifier.value);
            return { result, steps: [{ [name]: result }] };
        }
        case "dh": {
            const result = dropHighest(dice, modifier.value);
            return { result, steps: [{ [name]: result }] };
        }
        case "dl": {
            const result = dropLowest(dice, modifier.value);
            return { result, steps: [{ [name]: result }] };
        }
        case "rb": {
            const result = rerollOnce(dice, modifier.value, rerollFn);
            return { result, steps: [{ [name]: result }] };
        }
        case "rm":
            return rerollUntil(dice, modifier.value, rerollFn, name);
        case "m": {
            const result = applyMinimum(dice, modifier.value);
            return { result, steps: [{ [name]: result }] };
        }
    }
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

function rerollOnce(
    dice: number[],
    threshold: number,
    rerollFn: () => number,
): number[] {
    return dice.map((value) => (value < threshold ? rerollFn() : value));
}

function rerollUntil(
    dice: number[],
    threshold: number,
    rerollFn: () => number,
    name: string,
): ModifierResult {
    const steps: Step[] = [];
    let current = [...dice];

    while (current.some((value) => value < threshold)) {
        current = current.map((value) => (value < threshold ? rerollFn() : value));
        steps.push({ [name]: [...current] });
    }

    return { result: current, steps };
}

function applyMinimum(dice: number[], threshold: number): number[] {
    return dice.map((value) => (value < threshold ? threshold : value));
}
