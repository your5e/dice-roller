Using Three.js for rendering. The canvas is sized and positioned to fill
whatever element the roller is bound to — could be the full page body or a
small dice box image.

@queue

- [X] scene, camera above looking down, light from upper-left
- [X] animation loop, 60fps ideal, drop frames as needed
- [X] integrate renderer into example_roller.html, using a placeholder cube
      which can be rotated by hand

# Visual appearance

- [X] create the necessary mesh to show numbers on the d20
        - be able to choose the colour of faces and numbers
        - investigate default textures in three.js
- [X] create template UV sprite image for artists to make more detailed
      patterned dice
- [X] make reusable spanning tree unfolding class
- [X] document how to make another die
- [X] simple visualiser for the basic polygon to ensure the FACES data
      structure is as desired
- [ ] flatten the camera? telephoto effect?
- [ ] slight black lines, co-ordinate drift?

# Remaining dice

- [ ] d4 texture and net template
- [X] d6 texture and net template
- [ ] d8 texture and net template
- [ ] d10 texture and net template
- [X] d12 texture and net template
- [ ] d00 texture and net template

# Monitoring

- [ ] monitor frame drops
