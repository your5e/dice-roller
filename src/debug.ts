import type * as CANNON from "cannon-es";
import * as THREE from "three";
import { createD6 } from "./geometries/d6";
import { createD8 } from "./geometries/d8";
import { createD10 } from "./geometries/d10";
import { createD12 } from "./geometries/d12";
import { createD20 } from "./geometries/d20";
import type { Die } from "./geometries/dice";
import { D6DebugTexture } from "./textures/d6";
import { D8DebugTexture } from "./textures/d8";
import { D10DebugTexture } from "./textures/d10";
import { D12DebugTexture } from "./textures/d12";
import { D20DebugTexture } from "./textures/d20";

export type DebugDieType = 6 | 8 | 10 | 12 | 20;

const RESUME_DELAY = 2000;
const ROTATE_DURATION = 2000;
const PAUSE_DURATION = 1000;

export class DebugDieController {
    private die: Die | null = null;
    private sides: DebugDieType = 12;

    private dragging = false;
    private lastDragEnd = 0;
    private targetFace = 0;
    private startQuaternion: THREE.Quaternion | null = null;
    private targetQuaternion: THREE.Quaternion | null = null;
    private animationStart = 0;
    private pausing = false;
    private autoRotate = false;
    private splash: HTMLElement | null = null;
    private faceSelect: HTMLSelectElement | null = null;
    private autoRotateCheckbox: HTMLInputElement | null = null;

    private onDieChange: ((sides: DebugDieType) => void) | null = null;

    get mesh(): THREE.Mesh | null {
        return this.die?.mesh ?? null;
    }

    setOnDieChange(callback: (sides: DebugDieType) => void): void {
        this.onDieChange = callback;
    }

    setupControls(container: HTMLElement): void {
        const dieTypes: DebugDieType[] = [6, 8, 10, 12, 20];
        for (const sides of dieTypes) {
            const button = document.createElement("button");
            button.textContent = `d${sides}`;
            button.addEventListener("click", () => {
                this.sides = sides;
                this.updateFaceSelect();
                if (this.onDieChange) this.onDieChange(sides);
            });
            container.appendChild(button);
        }

        this.faceSelect = document.createElement("select");
        this.faceSelect.addEventListener("change", (e) => {
            this.setFace(Number((e.target as HTMLSelectElement).value));
        });
        container.appendChild(this.faceSelect);
        this.updateFaceSelect();

        const label = document.createElement("label");
        this.autoRotateCheckbox = document.createElement("input");
        this.autoRotateCheckbox.type = "checkbox";
        this.autoRotateCheckbox.checked = this.autoRotate;
        this.autoRotateCheckbox.addEventListener("change", (e) => {
            this.setAutoRotate((e.target as HTMLInputElement).checked);
        });
        label.appendChild(this.autoRotateCheckbox);
        label.appendChild(document.createTextNode(" Auto-rotate"));
        container.appendChild(label);

        this.setAutoRotate(true);
    }

    setAutoRotate(enabled: boolean): void {
        this.autoRotate = enabled;
        if (enabled && this.die) {
            this.targetFace = 0;
            this.pausing = true;
            this.animationStart = performance.now();
        }
        this.syncUI();
    }

    getSides(): DebugDieType {
        return this.sides;
    }

    setFace(face: number): void {
        if (!this.die) return;
        if (face < 1 || face > this.sides) return;

        this.startQuaternion = this.die.mesh.quaternion.clone();
        this.targetQuaternion = this.getQuaternionForFace(face);
        this.targetFace = face;
        this.animationStart = performance.now();
        this.pausing = false;
        this.syncUI();
    }

    async create(sides: DebugDieType = 10): Promise<THREE.Mesh> {
        this.sides = sides;
        this.die = await this.createDieOfType(sides);
        this.die.mesh.position.y = 1;
        this.targetQuaternion = this.die.defaultOrientation();
        if (this.targetQuaternion) {
            this.die.mesh.quaternion.copy(this.targetQuaternion);
        }
        this.targetFace = 0;
        if (this.autoRotate) {
            this.pausing = true;
            this.animationStart = performance.now();
        }
        this.updateFaceSelect();
        return this.die.mesh;
    }

    setupInteraction(container: HTMLElement): void {
        if (!this.die) return;
        const mesh = this.die.mesh;
        let lastX = 0;
        let lastY = 0;

        this.splash = document.createElement("div");
        this.splash.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 24px;
            font-weight: bold;
            color: #fff;
            opacity: 0.7;
            font-family: system-ui, sans-serif;
            pointer-events: none;
        `;
        container.appendChild(this.splash);

        container.addEventListener("mousedown", (e) => {
            this.dragging = true;
            this.startQuaternion = null;
            this.targetQuaternion = null;
            if (this.autoRotate) {
                this.setAutoRotate(false);
            }
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener("mousemove", (e) => {
            if (!this.dragging) return;

            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;

            const rotZ = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 0, 1),
                -deltaX * 0.01,
            );
            const rotX = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0),
                deltaY * 0.01,
            );

            mesh.quaternion.premultiply(rotZ).premultiply(rotX);

            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener("mouseup", () => {
            if (this.dragging) {
                this.dragging = false;
                this.lastDragEnd = performance.now();
            }
        });
    }

    update(): void {
        if (!this.die) return;
        const mesh = this.die.mesh;

        if (this.splash) {
            this.splash.textContent = String(this.readFaceUp());
        }

        if (this.dragging) return;

        const now = performance.now();

        if (
            this.autoRotate &&
            this.lastDragEnd > 0 &&
            now - this.lastDragEnd < RESUME_DELAY
        ) {
            this.targetFace = this.readFaceUp();
            this.targetQuaternion = null;
            this.pausing = true;
            this.animationStart = now;
            return;
        }

        const elapsed = now - this.animationStart;

        if (this.pausing) {
            if (this.autoRotate && elapsed >= PAUSE_DURATION) {
                const faceCount = this.die.physics.faces.length;
                this.targetFace = (this.targetFace % faceCount) + 1;
                this.startQuaternion = mesh.quaternion.clone();
                this.targetQuaternion = this.getQuaternionForFace(this.targetFace);
                this.animationStart = now;
                this.pausing = false;
                this.syncUI();
            }
        } else {
            if (this.startQuaternion && this.targetQuaternion) {
                const t = Math.min(elapsed / ROTATE_DURATION, 1);
                const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
                mesh.quaternion
                    .copy(this.startQuaternion)
                    .slerp(this.targetQuaternion, eased);

                if (t >= 1) {
                    mesh.quaternion.copy(this.targetQuaternion);
                    this.pausing = true;
                    this.animationStart = now;
                }
            }
        }
    }

    remove(scene: THREE.Scene): void {
        if (this.die) {
            scene.remove(this.die.mesh);
        }
        if (this.splash) {
            this.splash.remove();
            this.splash = null;
        }
        this.die = null;
    }

    private updateFaceSelect(): void {
        if (!this.faceSelect) return;
        this.faceSelect.innerHTML = "";
        for (let i = 1; i <= this.sides; i++) {
            const option = document.createElement("option");
            option.value = String(i);
            option.textContent = String(i);
            this.faceSelect.appendChild(option);
        }
        this.faceSelect.value = String(this.targetFace || 1);
    }

    private syncUI(): void {
        if (this.faceSelect) {
            this.faceSelect.value = String(this.targetFace || 1);
        }
        if (this.autoRotateCheckbox) {
            this.autoRotateCheckbox.checked = this.autoRotate;
        }
    }

    private async createDieOfType(sides: DebugDieType): Promise<Die> {
        switch (sides) {
            case 6: {
                const texture = await new D6DebugTexture().createTexture();
                return await createD6(1, texture);
            }
            case 8: {
                const texture = await new D8DebugTexture().createTexture();
                return await createD8(1, texture);
            }
            case 10: {
                const texture = await new D10DebugTexture().createTexture();
                return await createD10(1, texture);
            }
            case 12: {
                const texture = await new D12DebugTexture().createTexture();
                return await createD12(1, texture);
            }
            case 20: {
                const texture = await new D20DebugTexture().createTexture();
                return await createD20(1, texture);
            }
        }
    }

    private getQuaternionForFace(faceValue: number): THREE.Quaternion | null {
        if (!this.die) return null;
        return this.die.orientToFace(faceValue);
    }

    private readFaceUp(): number {
        if (!this.die) return 0;

        const faces = this.die.physics.faces;
        const up = new THREE.Vector3(0, 1, 0);
        let bestValue = faces[0].value;
        let bestDot = Number.NEGATIVE_INFINITY;

        for (const face of faces) {
            const body = this.die.physics.body;
            const shape = body.shapes[0] as CANNON.ConvexPolyhedron;
            const verts = shape.vertices;

            const a = verts[face.vertices[0]];
            const b = verts[face.vertices[1]];
            const c = verts[face.vertices[2]];

            const ab = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
            const ac = new THREE.Vector3(c.x - a.x, c.y - a.y, c.z - a.z);
            const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();

            normal.applyQuaternion(this.die.mesh.quaternion);

            const dot = normal.dot(up);
            if (dot > bestDot) {
                bestDot = dot;
                bestValue = face.value;
            }
        }

        return bestValue;
    }
}
