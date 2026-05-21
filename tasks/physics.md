Using Cannon-es for physics simulation. Cannon-es bodies use the same source
geometry, three.js embellishes with chamfering which is not required for the
simulation.

@queue
- [X] simulate a tray for rolling dice, and prove one or more will roll around,
      settle, and the result of the top faces is returned
- [X] renderer integration: visualise the roll in the tray, report result when settled
- [X] "throw" dice into the tray from the side, not drop from above
- [X] align the tray to the available space in the web page
- [X] portrait rolling for mobile
- [X] improve the mass of the dice, they seem a bit soft
- [ ] allow mouse/finger swipe to control throw direction and force
- [X] detect cocked dice (no face sufficiently horizontal) and reroll them
- [X] dropped dice go away (how?)
- [ ] rerolled dice get actually rerolled
- [ ] dice that skip the walls are rerolled
- [ ] dice that jiggle too much are rerolled?
- [X] monte carlo fairness test
- [ ] extend the max run time on more complex roll simulations
