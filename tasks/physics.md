Using Cannon-es for physics simulation.

The d100 is a classic two-die percentile: one showing 0–9 (units), one showing
00–90 (tens).

Each die is a polyhedron which needs:

- **Vertices** - the corner coordinates for each shape
- **Faces** - which vertices form each face, plus which number it shows
- **Chamfering** - bevelling the edges so dice don't look sharp
- **Normals** - for detecting which face points upward after rolling

Create a floor plane with normal gravity, bounded by four walls. Dice collide
with each other as well as the boundaries. Each die is rolled with a random
initial velocity and spin.

- [ ] animate the simulation until all dice settle, reading the results
- [ ] test with a monte carlo simulation to ensure fairness
