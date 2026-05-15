# dice-roller

A 3D physics-based dice roller for the common types of roles in 5e. Rolls the
standard seven polyhedrals (d4, d6, d8, d10, d12, d20, d100), allowing for
common adjustments, such as advantage/disadvantage.


## Usage

```html
<script src="dice-roller.js"></script>
<script>
  DiceRoller.tray('#dice-box');
  DiceRoller.bind('.rollable');
</script>
```

`.tray(elem)` creates the "rolling tray" that the dice will be animated in,
could be a specific element or the entire page.

`.bind(selector)` will make any click on the specified matching elements
trigger a roll in the tray. If the matched elements have the `data-roll`
attribute, that is used for the dice notation, otherwise it is found in
the text of the element.


## Dice notation

The expression of a roll uses a notation. It starts with the die or dice to
roll, `1d20`, `8d6`. Always the number of dice to roll, even when only one,
and the type of die. This can then be modified in various ways.

_**Keeping a subset.**_ When rolling multiple dice and keeping only those that
are high or low enough, such as rolling advantage `2d20kh1`, disadvantage
`2d20kl1`, or ability scores `4d6kh3`. You cannot keep more dice than there
are in the pool, `2d20hk3` is meaningless.

_**Dropping a subset.**_ The inverse of keeping, is dropping. Advantage could
also be written `2d20dl1`, disadvantage `2d20dh1`. Use whichever seems more
natural. You cannot drop all of the dice in the pool, `2d20dl2` is
meaningless.

_**Rerolling.**_ Some dice are rerolled once if they score too low. Halfling
Luck allows rerolling the first d20 in a test if it is a 1, `1d20rb2`.
Rerolling _until_ the result is 2 or more would be `1d20rm2`.

_**Minimum score.**_ Some low rolls can be treated as automatically higher. A
Rogue's Reliable Talent treats any roll of 9 or lower as a 10, `1d20m10`.

_**Modifier.**_ Some rolls have a static value added or subtracted, such as
attack rolls adding your ability and proficiency bonus, `1d20+7`.

Modifiers are applied left-to-right. For example `4d6rb2kh3` would roll four
d6, rerolling any that came up 1 initially, then keep the highest three,
whereas `4d6kh3rb2` would roll, keep the highest 3 and _then_ reroll any that
are a 1. So if the original roll was all 1s, the former notation would give a
better chance of a high total as you reroll all four dice.

Any part of the expression being invalid makes the entire expression invalid.


## Adding a new die

See [docs/new_die.md](docs/new_die.md).
