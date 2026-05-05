import type * as THREE from "three";
import type { PhysicsDie } from "../physics/dice";

export type Die = {
    mesh: THREE.Mesh;
    physics: PhysicsDie;
};
