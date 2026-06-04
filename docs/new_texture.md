# Creating a new texture

## Basic colouration

```typescript
export function NewTextureMixin<T extends DieTextureConstructor>(Base: T) {
    return class extends Base {
        bgColour = "#004225";
        fgColour = "#ffffff";
    };
}
```

The simplest textures just set colour properties:

- `faceColour` is the fill colour for faces
- `stripColour` is the fill colour for strips (the lines between faces)
- `crownColour` is the fill colour for crowns (the vertices where strips meet)
- `bgColour` is a shorthand to set the same fill colour on faces, strips, and
  crowns
- `numeralColour` is the colour used to draw numbers
- `numeralOutlineColour` is the colour used to outline drawn numbers
- `iconColour` is the colour used to draw icons
- `iconOutlineColour` is the colour used to outline drawn icons
- `fgColour` is a shorthand to set the same colour for numbers and icons
- `fgOutlineColour` is a shorthand to set the same outline colour for numbers
  and icons


## Layers

To have more control and draw patterns on the dice, they are built up using
layers. Each method is called once per face/strip/crown.

- **data** — called before any drawing, used to pre-compute structure that
  your draw methods will need; no default action
    - `designData()`
- **background** — the base of the die; the default action is to apply a solid
  colour
    - `drawFaceBackground(ctx, face, data)`
    - `drawStripBackground(ctx, key, data)`
    - `drawCrownBackground(ctx, vertex, data)`
- **grain** — apply a texture to the base; no default action
    - `drawFaceGrain(ctx, face, data)`
    - `drawStripGrain(ctx, key, data)`
    - `drawCrownGrain(ctx, vertex, data)`
- **decoration** — apply a decoration on top of the background + grain before
  numbers and icons are drawn; no default action
    - `drawFaceDecoration(ctx, face, data)`
    - `drawStripDecoration(ctx, key, data)`
    - `drawCrownDecoration(ctx, vertex, data)`
- **icon** — draw icons on the faces; no default action
    - `drawFaceIcon(ctx, face, data)`
- **numeral** — draw the numbers on the faces; no default action (Unfoldable
  mixin provides a solid colour and optional outline in [Varela Round][vr])
    - `drawFaceNumeral(ctx, face, data)`
- **finish** — draw any final touches on top of the whole die; no default
  action
    - `drawFaceFinish(ctx, face, data)`
    - `drawStripFinish(ctx, key, data)`
    - `drawCrownFinish(ctx, vertex, data)`

[vr]:https://github.com/librefonts/varelaround

For example, the Kintsugi texture uses a solid green fill, but overrides
the grain layer to add the golden repair lines so they sit under the numbers.


## Procedural generation

Textures making use of randomness should still be deterministic — given a seed
value, the pattern should always come out the same so the person rolling sees
the same dice each time. Variation in designs, but not unique every roll.

The base class provides `seededRandom()`, and to use it you must pass the
`seed` option to the texture upon initialisation.

### Simplex noise

For spatially coherent patterns (wood grain, marble veins), use the seeded
simplex noise generator:

```typescript
const noise = this.simplex.noise(x * scale, y * scale);
```

### Closed loops

If you need random paths across multiple faces of a die, use
`findAllClosedLoops()` which will randomly walk across faces until it returns
to the origin. It is capped at two loops per face to avoid a mess of patterns,
and will not return an unclosed loop. Each loop crosses between faces at 1/4,
1/2, or 3/4 of the way across the edge, and no point is used twice.

For example, this is used by the Kintsugi texture to create crack patterns
that are whole, not just a random crack that tails off to nothing.


## Utilities

The base `DieTexture` class provides several helpers that might be useful.

### Drawing

- `drawNumeral(ctx, value, x, y, fontPx, fontFamily, colour, underlineColour,
  outlineColour?)` — draws a numeral with optional outline, auto-underlines
  6 and 9
- `drawIcon(ctx, icon, x, y, size, colour, outlineColour?)` — draws an icon
  centred at (x, y); import from `../icons`
- `stippleArea(ctx, polygon, baseWidth, colour, spacingMultiplier,
  sizeMultiplier)` — fills a polygon with random stippled dots
- `computeEdgeBezierSamples(from, to, startEdgeDir, endEdgeDir, faceRadius,
  isSymmetric)` — returns `EdgeBezierData` with samples (points + tangents)
  for a smooth curve between two edge points; useful for drawing lines along
  closed loops
- `debugDrawBezier(ctx, data, curveIndex)` — draws debug visualisation of a
  bezier curve's control points
- `getDebugColour(index)` — returns `{ hex, name }` from a palette of 15
  colours chosen to maximise visual distinction

### Geometry and topology

Each region type has pre-computed layout data available:

- `this.faceData` — Map of face number to `{ points, uvs }`
- `this.stripData` — Map of edge key to `{ points, uvsByFace }`
- `this.crownData` — Map of vertex index to `{ points, uvs, faceOrder }`

Points include `x`, `y`, and `latitude` (0–1 value for position along the
die's vertical axis.

Helper functions include:

- `stripKey(faceA, faceB)` — canonical string key for the edge between two faces
- `getAdjacentFaces(face)` — array of face numbers sharing an edge with `face`
- `areAdjacent(faceA, faceB)` — true if the faces share an edge
- `get2DEdgeIndex(face, adjFace)` — index of the edge within `face`'s polygon
- `getEdgeDirection(face, adjFace)` — unit vector along the edge in canvas space
- `edgeTargetToCanvas(target)` — converts `{ face, adjFace, t }` to canvas `{ x, y }`
- `perpendicular(dx, dy)` — returns unit vector perpendicular to `(dx, dy)`
- `pointInPolygon(point, polygon)` — true if the point is inside the polygon
- `findSharedVertex(vertices, edgeIdx1, edgeIdx2)` — vertex shared by two edges, or null
- `edgeAngle(p1, p2)` — degrees
