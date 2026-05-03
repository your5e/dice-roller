import { type Step, calculate } from "./calculate";
import { rollDice } from "./dice";
import { parse } from "./notation";
import { createTray } from "./renderer";

type RollResult = {
    notation: string;
    steps: Step[];
    total: number;
};

export function roll(input: string): RollResult {
    const expressions = parse(input);
    let total = 0;
    const steps: Step[] = [];

    for (const expr of expressions) {
        if (expr === null) {
            throw new Error(`Invalid dice expression: ${input}`);
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

export function tray(selector: string): void {
    const container = document.querySelector(selector);
    if (!(container instanceof HTMLElement)) {
        throw new Error(`Element not found: ${selector}`);
    }
    createTray(container);
}

export function bind(selector: string): void {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
        element.addEventListener("click", () => {
            const expression =
                element.getAttribute("data-roll") || element.textContent || "";
            const result = roll(expression);
            console.log(result);
        });
    }
}
