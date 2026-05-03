import { calculate } from "./calculate";
import { rollDice } from "./dice";
import { parse } from "./notation";

type RollResult = {
    kept: number[];
    total: number;
};

export function roll(input: string): RollResult {
    const expressions = parse(input);
    let total = 0;
    const kept: number[] = [];

    for (const expr of expressions) {
        if (expr === null) {
            throw new Error(`Invalid dice expression: ${input}`);
        }

        const dice = rollDice(expr.count, expr.sides);
        const result = calculate(
            dice,
            expr.modifiers,
            expr.bonus,
            () => rollDice(1, expr.sides)[0],
        );
        total += result.total;
        kept.push(...result.kept);
    }

    return { kept, total };
}

export function tray(_selector: string): void {}

export function bind(_selector: string): void {}
