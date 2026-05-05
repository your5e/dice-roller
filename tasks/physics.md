Using Cannon-es for physics simulation. Cannon-es bodies use the same source
geometry, three.js embellishes with chamfering which is not required for the
simulation.

@queue
- [X] simulate a tray for rolling dice, and prove one or more will roll around,
      settle, and the result of the top faces is returned
- [X] renderer integration: visualise the roll in the tray, report result when settled
- [ ] "throw" dice into the tray from the side, not drop from above
- [ ] detect cocked dice (no face sufficiently horizontal) and reroll them
- [ ] monte carlo fairness test
