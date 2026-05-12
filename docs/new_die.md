# Adding a New Die

## First, terminology

To set out the words that should be used in the codebase that otherwise would
have multiple meanings (a square has four edges, a cube has six edges...)

Conceptual:
- **body** is the basic polyhedral shape of a die
- **face** is the numbered face of a die
- **chamfer** is the splitting of each vertex on the body into one position
  per adjacent face, to create a more rounded shape for the 3d engine
- **strip** is the rectangle between faces after a die body has been chamfered
- **crown** is the n-sided polygon created at the vertex of the original body,
  after it has been chamfered

2D:
- **canvas** a rectangular bitmap of pixels
- **point** is an x,y coordinate on a canvas (2d space)
- **edge** is a straight line from point to point, one part of a polygon
- **rotation** is the angle that a shape on the canvas is drawn at, where 0º
  points to the right
- **stance** is the direction _on the drawn face_ that the numeral is angled
  to, which is additive to its **rotation**
- **texture** the full drawn canvas of all faces, crowns, and strips needed
  for the die

3D:
- **vertex** is an x,y,z coordinate in 3d space
- **surface** is a flat plane made of three or more **vertex**
- **normal** a vector perpendicular to a surface, pointing outward
- **geometry** a collection of surfaces that make a discrete 3d object
- **material** the texture plus tinting, reflectivity, etc
- **mesh** the geometry plus the material
- **quaternion** is the orientation/rotation (pitch, yaw, roll) of the 3d
  object in space


## Structure

Each die is split across three files:

- `bodies/dX.ts` defines the 3D polyhedron
- `textures/dX.ts` creates the 2D canvas net that decorates the polyhedron
- `geometries/dX.ts` wires the polyhedron and textures together

To create a new die, first build the body and debug texture. Until the texture
is laid out correctly, there is no point advancing to the 3d geometry. Focus
on connecting as many faces as possible in the image. Number orientation comes
after making the layout correct. This requires a visual inspection, no easily
written tests can confirm this.

After the canvas is correct, lay it on the 3d rendering geometry. Once all
three files are ready, final testing is in `example_roller.html` by setting it
as the default debug die and again inspecting visually.


## bodies/dX.ts

This file defines the pure 3D geometric shape of the die.

- `DIE_SCALE` — ratio of this die's face edge length to the d6's reference
  1-unit face edge length
- `VERTICES` are the corners of the polyhedron shape
- `FACES` — details which vertices connect into faces, assigning them their
  numbers and the priority order in which they are drawn in the canvas. Each
  contains:
    - `value` — the number shown on this face
    - `vertices` — listed _anti-clockwise_ for correct 3d rendering
    - `stance` — which edge (0 to n-1) the number sits above when drawn;
      adjustable so that each number can face in any direction.
- `FACE_VERTICES`, `FACE_STANCE` are derived lookups


## textures/dX.ts

```typescript
class D{n}Texture extends DieTexture {
    protected faceVertices = FACE_VERTICES;
    protected faces = FACES;

    // override base class properties for colours, fonts, size, etc.
    protected faceColour: string;
    protected fontFamily = "Comic Sans";

    constructor() {
        super();
        this.buildLayoutData();
    }

    // derived measurement (die-specific)
    protected get edgeLength(): number;   // derived from circumradius

    // canvas dimensions (calculated from layout)
    get width(): number;
    get height(): number;

    // implement to populate layout data (others are in base class)
    protected buildFaceLayout(): void;

    // calculate 2D point positions (strips derived in base class)
    protected calculateFacePoints(face: number): Point[];
    protected calculateCrownPoints(vertex: number): Point[];

    // render to canvas (strips and crowns are in base class)
    protected drawFaces(ctx: CanvasRenderingContext2D): void;

    // map 3D adjacency to 2D layout
    protected get2DEdgeIndex(face: number, adjFace: number): number;
    get2DStartIndex(face: number): number;
}
```

### Derived Measurements

All measurements scale from `circumradius`:

1. **`circumradius`** — base class getter (default 100), the distance from
   face centre to point in canvas pixels
2. **`edgeLength`** — derived from circumradius using geometry (abstract,
   each die implements based on its face polygon)
3. **`stripWidth`** — chamfer strip width, `edgeLength × CHAMFER` (in base class)
4. **`margin`** — canvas padding, `stripWidth + 5` (in base class)
5. **`width`, `height`** — canvas dimensions, calculated from how faces tile
   plus margins and gaps

Changing circumradius scales the entire texture proportionally.


### Face Layout

Each die needs its own method for arranging faces on the canvas. The layout
should form a connected net (like a papercraft template) with as many shared
edges as possible, so artists decorating the template can see how adjacent
faces relate on the 3D shape. Think about an optimal layout first.

Whatever the approach, you need to track each face's position and rotation,
drawing to the defined order in `FACES`; `buildFaceLayout()` determines where
each face sits on the canvas.

The 3D geometry is chamfered — each face is shrunk, which creates three types
of polygon to be drawn and matching UV co-ordinates. You will need to provide
die-specific `calculateFacePoints` and `calculateCrownPoints`.

The strips and crowns are each associated with more than one face, so the
first drawn face "owns" them and is responsible for their position in the
canvas net.


### Face Rotation

The drawing of the polygon and the orientation of the number within are
independent. The polygon should be rotated correctly to the 2D canvas,
the number uses the `stance` property to orient _within_ the face.


### The Three Texture Classes

Each die requires at least these three texture subclasses:

- **`D{n}Texture`** — the default appearance in the roller (e.g. d20 is
  orange with white text).
- **`D{n}TemplateTexture`** — used to draw a template PNG for others to
  decorate for custom dice appearances.
- **`D{n}DebugTexture`** — used to ensure the 2D and 3D textures are aligned
  using registration markers. Implement these three methods:
    - `decorateCrowns` — fill each crown polygon using
      `getCrownColour`
    - `decorateStrips` — draw an angled tick mark across each strip using
      `getStripColour`, offset from the midpoint by `stripWidth / edgeLength`
      ratio, spaced to match the same lines in `decorateFaces`; the angle
      helps detect accidentally reflected textures
    - `decorateFaces(ctx)` — for each face, draw lines toward its edges and
      crowns using the same colour methods:
        - **strip lines**: from halfway along the face toward the edge point,
          ending at the face boundary offset by `stripWidth / edgeLength` —
          this meets the tick mark from `decorateStrips`
        - **crown lines**: from the crown point to 30% toward the centre,
          using `getCrownColour`


## geometries/dX.ts

This file wires the body and texture together. Copy an existing geometry file
and update the imports and class names.

```typescript
const geometryCache = new Map<number, THREE.BufferGeometry>();
const d{n}Texture = new D{n}Texture();

class D{n} extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;

    defaultOrientation(): THREE.Quaternion {
        return ...
    }
}

async function createD{n}(size = 1, texture?: THREE.Texture): Promise<D{n}> {
    return createDie(D{n}, DIE_SCALE, VERTICES, FACES, d{n}Texture, geometryCache, size, texture);
}
```

`defaultOrientation()` controls how the die appears at rest in the tray
(used in the debug feature of `example_roller.html`).
