# dice-roller

A 3D physics-based dice roller for the common types of roles in 5e. Rolls the
standard seven polyhedrals (d4, d6, d8, d10, d12, d20, d100), allowing for
common adjustments, such as advantage/disadvantage.

[Try it out.](https://your5e.github.io/dice-roller/)


## Usage

```html
<script src="dice-roller.js"></script>
<script>
  DiceRoller.tray('#dice-box');
  DiceRoller.onRoll(function(result) {
    alert('You rolled ' + result.total);
  });
  DiceRoller.bind('.rollable');
  DiceRoller.roll('2d20kh1+5');
</script>
```

`.tray(selector)` creates the "rolling tray" that the dice will be animated
in. Could be a specific element or the entire page.

`.bind(selector)` makes any click on matching elements trigger a roll in the
tray. If the matched elements have the `data-roll` attribute, that is used
for the dice notation, otherwise it is found in the text of the element.

`.roll(input)` rolls dice with a custom input. If a tray exists, dice are
animated, otherwise results are just simulated physics.

`.onRoll(callback)` sets the callback that receives roll results:

```javascript
{
  notation: 'fire:2d6+3 1d20',
  total: 26,
  label_totals: { fire: 9, '': 17 },
  expressions: [
    {
      notation: 'fire:2d6+3',
      label: 'fire',
      steps: [{ '2d6': [4, 2] }, { bonus: 3 }],
      total: 9
    },
    {
      notation: '1d20',
      steps: [{ '1d20': [17] }],
      total: 17
    }
  ]
}
```


## Dice notation

A dice roll notation is a string, which contains expressions for a group of
dice being rolled, in the format "{number to roll}{of what die}". Roleplaying
games typically refer to a die by the number of faces, so a `d6` is a cubic
die, `d20` is an icosahedral die. The simplest would be to roll one die:
`1d6`. The notation can include many expressions, separated by at least one
space: `2d8 3d6`. Each expression may include any of the following
modifications.

_**Labels.**_ An expression can be labelled, if there is a need to group
different dice together (eg `fire:2d6 fire:1d4`) or to differentiate rolled
dice (eg `fire:1d8 lightning:1d8`). Labels are `a-z` only, case insensitive.

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

_**Reroll expression total.**_ All dice in an expression can be rerolled if
the total is too low, such as for ability score generation using roll-4-drop-1
to enforce a minimum result of 6, use `4d6dl1rmt6`.

_**Reroll group total.**_ All dice across multiple expressions can be rerolled
if the total is too low, such as Matt Mercer's [minimum of 70][mm] rule
which is `str:4d6dl1 dex:... *:rmt70`.

_**Modifier.**_ Some rolls have a static value added or subtracted, such as
attack rolls adding your ability and proficiency bonus, `1d20+7`.

Modifiers are applied left-to-right. For example `4d6rb2kh3` would roll four
d6, rerolling any that came up 1 initially, then keep the highest three,
whereas `4d6kh3rb2` would roll, keep the highest 3 and _then_ reroll any that
are a 1. So if the original roll was all 1s, the former notation would give a
better chance of a high total as you reroll all four dice.

Any part of an expression being invalid makes the entire expression invalid,
but not the full notation. For example, `1d20blep` generates no rolls, but
`1d20blep 2d6` would roll two six-sided dice and return their total.


## Adding a new die

See [docs/new_die.md](docs/new_die.md).
