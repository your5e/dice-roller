Draw in layers across the texture, not haphazardly.

Each texture should have places where they can inject, so they can be composed
together; so for faces, crowns and strips:

- background colour layer (fill the face)
- background grain (stippling, patterns, marks)
- foreground decoration (anything that sits above the grain)
- foreground numeral
- finish (sparkle, highlights, anything that sits on the numbers)

- [X] refactor the drawing

# reusable tools

Function `drawCircle` to draw a circle on a surface as though laying down a
circular sticker, extending across the edge of the current surface and onto
neighbouring surfaces, until the entire circle is drawn.

The sticker has a constant radius, not relative to the face, strip, or crown
currently being drawn upon. For a flat "sticker" wrapping around an edge, the
arc continues with the same curvature as edges are developable surfaces.

But a flat sticker cannot cross a vertex without bunching up, so arcs drawn
over crowns will need to take into account a deficit from the wedge angle.

- [X] calculate deficits
- [X] method to draw whilst clipping to the current surface limits
- [#] implement arc drawing using constant radius and computed centre
      (draws entire polys with callback, not just arcs)
- [X] propogate from surface to neighbouring surfaces
