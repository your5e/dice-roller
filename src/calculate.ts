import type { Modifier } from "./notation";

type Result = {
    kept: number[];
    total: number;
};

export function calculate(
    dice: number[],
    modifiers: Modifier[],
    bonus: number,
    rerollFn: () => number,
): Result {
    let current = [...dice];

    for (const modifier of modifiers) {
        current = applyModifier(current, modifier, rerollFn);
    }

    const total = current.reduce((a, b) => a + b, 0) + bonus;
    return { kept: current, total };
}

function applyModifier(
    dice: number[],
    modifier: Modifier,
    rerollFn: () => number,
): number[] {
    switch (modifier.type) {
        case "kh":
            return keepHighest(dice, modifier.value);
        case "kl":
            return keepLowest(dice, modifier.value);
        case "dh":
            return dropHighest(dice, modifier.value);
        case "dl":
            return dropLowest(dice, modifier.value);
        case "rb":
            return rerollOnce(dice, modifier.value, rerollFn);
        case "rm":
            return rerollUntil(dice, modifier.value, rerollFn);
        case "m":
            return applyMinimum(dice, modifier.value);
    }
}

function keepHighest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const keepIndices = new Set(
        indexed.slice(-count).map((item) => item.index),
    );
    return dice.filter((_, index) => keepIndices.has(index));
}

function keepLowest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const keepIndices = new Set(
        indexed.slice(0, count).map((item) => item.index),
    );
    return dice.filter((_, index) => keepIndices.has(index));
}

function dropHighest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const dropIndices = new Set(
        indexed.slice(-count).map((item) => item.index),
    );
    return dice.filter((_, index) => !dropIndices.has(index));
}

function dropLowest(dice: number[], count: number): number[] {
    const indexed = dice.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const dropIndices = new Set(
        indexed.slice(0, count).map((item) => item.index),
    );
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
): number[] {
    return dice.map((value) => {
        let current = value;
        while (current < threshold) {
            current = rerollFn();
        }
        return current;
    });
}

function applyMinimum(dice: number[], threshold: number): number[] {
    return dice.map((value) => (value < threshold ? threshold : value));
}
