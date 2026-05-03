Dice notation supported:

- `XdY` — roll X dice with Y sides, eg `1d20`, `6d8`
- `klN` — keep lowest N, eg `2d20kl1` (disadvantage)
- `khN` — keep highest N, eg `2d20kh1` (advantage)
- `dlN` — drop lowest N, eg `4d6dl1` (ability score generation)
- `dhN` — drop highest N, eg `4d6dh1`
- `rbN` — reroll once if below N, eg `1d20rb2` (can't roll a 1 the first time)
- `rrbN` — reroll recursively if below N, eg `1d20rrb2` (can't ever roll a 1)
- `mN` — minimum N, eg `1d20m10` (any number 1–9 is treated as a 10)
- `+N` / `-N` — arithmetic modifier applied to the final result, eg `2d8+4`

Final result is always the total of all dice rolled after modifiers are
applied. Modifiers are applied left to right:

- `4d6rb2kh3` — roll 4d6, reroll any 1s, then keep highest 3
- `4d6kh3rb2` — roll 4d6, keep highest 3, then reroll any 1s in that three

Order matters because if you rolled all 1s on the first roll, rerolling all
four dice before discarding gives more opportunity for high values than discarding
one of the 1s before rerolling only 3.

- [X] create notation parser
- [X] create the dice roller
- [ ] create test webpage with common 5e rolls, some as element text, some as
      elements with a `data-roll` attribute
- [ ] clicking any roll gives the calculated result in console
