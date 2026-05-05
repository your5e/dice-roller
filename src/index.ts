import { type Step, calculate } from "./calculate";
import { rollDice } from "./dice";
import { parse } from "./notation";
import { type TrayState, createTray, roll as rollInTray } from "./renderer";

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

function rollWithPhysics(input: string): void {
    const expressions = parse(input);

    // Check if this is a single d6 expression we can animate
    if (activeTray && expressions.length === 1 && expressions[0]?.sides === 6) {
        const expr = expressions[0];
        const diceNotation = `${expr.count}d6`;

        rollInTray(activeTray, expr.count).then((faces) => {
            const calcResult = calculate(
                faces,
                expr.modifiers,
                expr.bonus,
                () => Math.floor(Math.random() * 6) + 1,
            );

            onRollCallback({
                notation: input,
                steps: [{ [diceNotation]: faces }, ...calcResult.steps],
                total: calcResult.total,
            });
        });
    } else {
        // Fall back to random roll for non-d6 or multi-expression
        onRollCallback(roll(input));
    }
}

export function tray(selector: string): void {
    const container = document.querySelector(selector);
    if (!(container instanceof HTMLElement)) {
        throw new Error(`Element not found: ${selector}`);
    }
    activeTray = createTray(container);
}

export function onRoll(callback: RollCallback): void {
    onRollCallback = callback;
}

export function bind(selector: string): void {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
        element.addEventListener("click", () => {
            const expression =
                element.getAttribute("data-roll") || element.textContent || "";
            rollWithPhysics(expression);
        });
    }
}
