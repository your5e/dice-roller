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
