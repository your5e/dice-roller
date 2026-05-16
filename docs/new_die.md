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

## The standard die unit

The length of a new die's primary edge is a ratio against the edge of the
standard die unit, the d6. A d6 is considered to be "one unit" and everything
is sized relative to it.



## Structure

Each die is split across three files, which follows the broad method of
implementing them:

- `bodies/dX.ts` defines the 3D polyhedron
- `textures/dX.ts` creates the 2D canvas net that decorates the polyhedron
- `geometries/dX.ts` wires the polyhedron and textures together

To create a new die, first build the body and debug texture. Until the
texture is laid out correctly, there is no point advancing to the 3d
geometry. Focus on connecting as many faces as possible in the image. This
requires a visual inspection, it is very hard to write tests that can
determine this automatically.

After the canvas is correct, lay it on the 3d rendering geometry. Once all
three files are ready, final testing is in `example_roller.html` by setting it
as the default debug die and again inspecting visually.

Lastly, change the number stance for more pleasing "randomness" of faces.



## bodies/dX.ts

First, you need the basic polyhedral defined as a 3D body:

```typescript
import * as THREE from "three";
import type { DieFaces } from "../geometries/chamfer";

// the d6 is our reference die edge length, everything is relative to it
export const DIE_SCALE = 1.0;

export const VERTICES: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, 0),
    ...
];

export const FACES: DieFaces = [
    { value: 1, vertices: [0, 0, 0], stance: 0 },
    ...
];

export const FACE_VERTICES: Record<number, number[]> = Object.fromEntries(
    FACES.map((face) => [face.value, face.vertices]),
);

export const FACE_STANCE: Record<number, number> = Object.fromEntries(
    FACES.map((face) => [face.value, face.stance]),
);
```

You need to define the vertices of the shape and construct the faces from
those vertices. The vertices in each face must be listed anti-clockwise to
render correctly in 3D space. Use `visualiser.html` to preview and debug the
polyhedron (it shows winding direction with green and red edges and an arrow):

The distance between vertexes creates the edge length, which must be 2.000 for
the die to end up being properly sized against the standard die unit.

```bash
npx vite src/bodies
open http://localhost:5173/visualiser.html
```



## textures/dX.ts

Second, create the textures, most of which should be boilerplate. Set the
rotation of the first face placed, the calculation for the edgeLength,
override getShapeFontScale if needed, and the colours.

Each die must have the three default textures, but can provide more

- _DXTexture_ — what is rolled as standard
- _DXTemplateTexture_ — a flat grey PNG exported for people to use to
  create manually decorated die
- _DXDebugTexture_ — used when checking the roller 3D code

```typescript
import { FACES, FACE_VERTICES, VERTICES } from "../bodies/dX";
import { DebugMixin, DieTexture, TemplateMixin } from "./dice";
import { Unfoldable } from "./unfold";

export class DXTexture extends Unfoldable(DieTexture) {
    protected faces = FACES;
    protected vertices = VERTICES;
    protected faceVertices = FACE_VERTICES;
    protected faceColour = "#e07000";
    protected stripColour = "#e07000";
    protected crownColour = "#e07000";

    get startRotation(): number {
        return 0;
    }

    protected get edgeLength(): number {
        return this.pixelDensity * Math.sqrt(3);
    }

    protected override getShapeFontScale(): number {
        return 0.75;
    }

    constructor() {
        super();
        this.buildLayoutData();
    }
}

export class DXTemplateTexture extends TemplateMixin(DXTexture) {}
export class DXDebugTexture extends DebugMixin(DXTexture) {}
```

### New textures

If you are creating a new texture, note that all measurements scale from
`pixelDensity`. When the value is larger, the resulting canvas PNG will
be larger, the die itself as rendered on the web page does not change. It
is a quality dial, not a size dial, that is DIE_SCALE in the body.

### Face placement

Faces are placed on the canvas by walking the order in `FACES`. Each face
is placed against the edge it shares with the most-recently placed face
by default. You can set `protected placeReverse = false;` on the texture
to place faces against the first-placed texture by default, or you can
set the `adjacent` property on the individual face in `FACES` to concretely
define where it is placed:

```typescript
{ value: 4, vertices: [1, 13, 15, 5, 9], stance: 3, adjacent: 12 },
```



## geometries/dX.ts

This file wires the body and texture together. Copy an existing geometry file
and update the imports and class names.

```typescript
import type * as THREE from "three";
import { DIE_SCALE, FACES, FACE_STANCE, FACE_VERTICES, VERTICES } from "../bodies/dX";
import { DXTexture } from "../textures/dX";
import { Die, createDie } from "./dice";

const geometryCache = new Map<number, THREE.BufferGeometry>();
const dXTexture = new DXTexture();

export class DX extends Die {
    protected faceVertices = FACE_VERTICES;
    protected meshVertices = VERTICES;
    protected faceStance = FACE_STANCE;
}

export async function createDX(size = 1, texture?: THREE.Texture): Promise<DX> {
    return createDie(
        DX,
        DIE_SCALE,
        VERTICES,
        FACES,
        dXTexture,
        geometryCache,
        size,
        texture,
    );
}
```
