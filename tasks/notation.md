Dice notation supported:

- `label:` — prefix to an expression, eg `slashing:2d6+3 fire:2d6` used
  for annotating different expressions (eg damage types), or grouping related
  rolls
- `XdY` — roll X dice with Y sides, eg `1d20`, `6d8`
- `+N` / `-N` — arithmetic modifier applied to the final result, eg `2d8+4`
- `klN` — keep lowest N, eg `2d20kl1` (disadvantage)
- `khN` — keep highest N, eg `2d20kh1` (advantage)
- `dlN` — drop lowest N, eg `4d6dl1` (ability score generation)
- `dhN` — drop highest N, eg `4d6dh1`
- `rbN` — reroll once if below N, eg `1d20rb2` (can't roll a 1 the first time)
- `rmN` — reroll until a minimum of N, eg `1d20rm2` (can't ever roll a 1)
- `mN` — minimum N, eg `1d20m10` (any number 1–9 is treated as a 10)
- `rmtN` — reroll until a minimum total of N, eg `4d6dl1rmt6` rolls a
  character's ability score, ensuring it is at least a 6; this option can be
  applied to more than one expression at once:
    - on an expression: `4d6dl1rmt6` rerolls that individual group
    - on a label: `fire:rmt8` rerolls all dice expressions labelled `fire`,
      and the wildcard `*:rmt70` rerolls everything in the notation

Final result is always the total of all dice rolled after modifiers are
applied. Modifiers are applied left to right:

- `4d6rb2kh3` — roll 4d6, reroll any 1s, then keep highest 3
- `4d6kh3rb2` — roll 4d6, keep highest 3, then reroll any 1s in that three

Order matters because if you rolled all 1s on the first roll, rerolling all
four dice before discarding gives more opportunity for high values than discarding
one of the 1s before rerolling only 3.

- [X] create notation parser
- [X] create the dice roller
- [X] create test webpage with common 5e rolls, some as element text, some as
      elements with a `data-roll` attribute
- [X] clicking any roll gives the calculated result in console

Mixed damage types need separate totals reported — a Flame Tongue sword deals
slashing damage plus fire damage. Distinguishing the types in the
result is needed to apply resistances/vulnerabilities correctly. Add
`label:` before the expression to name that part of the roll.

- [X] support labelled dice groups in notation and roll result

Rerolling not just individual dice but groups is supported.

- [ ] create new character (4d6dl1 for six stats) should reroll all 24 dice if
      the total of kept dice is below a threshold
- [X] create new character stat (4d6dl1) and reroll all 4 dice if the total
      after dropping is below 6
