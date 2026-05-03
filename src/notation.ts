const VALID_DICE = new Set([4, 6, 8, 10, 12, 20, 100]);

export type Modifier = {
    type: "kh" | "kl" | "dl" | "dh" | "rb" | "rm" | "m";
    value: number;
};

export type ParsedDice = {
    count: number;
    sides: number;
    modifiers: Modifier[];
    bonus: number;
};

export function parse(input: string): (ParsedDice | null)[] {
    const expressions = input.trim().split(/\s+/);
    if (expressions.length === 1 && expressions[0] === "") {
        return [];
    }
    return expressions.map(parseExpression);
}

function parseExpression(expression: string): ParsedDice | null {
    const diceMatch = expression.match(/^(\d+)d(\d+)/i);
    if (!diceMatch) {
        return null;
    }

    const count = Number.parseInt(diceMatch[1], 10);
    const sides = Number.parseInt(diceMatch[2], 10);

    if (count < 1 || !VALID_DICE.has(sides)) {
        return null;
    }

    let remainder = expression.slice(diceMatch[0].length);
    const modifiers: Modifier[] = [];
    let bonus = 0;
    let remaining = count;
    let bonusStarted = false;

    while (remainder.length > 0) {
        const modMatch = remainder.match(/^(kh|kl|dl|dh|rb|rm|m)(\d+)/i);
        if (modMatch) {
            if (bonusStarted) {
                return null;
            }

            const type = modMatch[1].toLowerCase() as Modifier["type"];
            const value = Number.parseInt(modMatch[2], 10);

            if (!validateModifier(type, value, remaining, sides)) {
                return null;
            }

            if (type === "kh" || type === "kl") {
                remaining = value;
            } else if (type === "dl" || type === "dh") {
                remaining -= value;
            }

            modifiers.push({ type, value });
            remainder = remainder.slice(modMatch[0].length);
            continue;
        }

        const bonusMatch = remainder.match(/^([+-])(\d+)/);
        if (bonusMatch) {
            bonusStarted = true;
            const sign = bonusMatch[1] === "+" ? 1 : -1;
            const value = Number.parseInt(bonusMatch[2], 10);
            bonus += sign * value;
            remainder = remainder.slice(bonusMatch[0].length);
            continue;
        }

        return null;
    }

    return { count, sides, modifiers, bonus };
}

function validateModifier(
    type: Modifier["type"],
    value: number,
    remaining: number,
    sides: number,
): boolean {
    switch (type) {
        case "kh":
        case "kl":
            return value >= 1 && value <= remaining;
        case "dl":
        case "dh":
            return value >= 1 && value < remaining;
        case "rb":
        case "rm":
        case "m":
            return value >= 1 && value <= sides;
    }
}
