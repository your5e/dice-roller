import * as THREE from "three";
import { createD6 } from "./geometries/d6";

type TrayState = {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    cube: THREE.Mesh;
    isDragging: boolean;
    previousMousePosition: { x: number; y: number };
    animationId: number | null;
};

export function createTray(container: HTMLElement): TrayState {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // top-down camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3, 0);
    camera.lookAt(0, 0, 0);

    // light from top-left
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-1, 1, 0);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // d6 die
    const { mesh: cube } = createD6(1, 0.1);
    scene.add(cube);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const state: TrayState = {
        renderer,
        scene,
        camera,
        cube,
        isDragging: false,
        previousMousePosition: { x: 0, y: 0 },
        animationId: null,
    };

    setupDragRotation(state, renderer.domElement);
    startAnimationLoop(state);

    return state;
}

function setupDragRotation(state: TrayState, canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", (e) => {
        state.isDragging = true;
        state.previousMousePosition = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
        if (!state.isDragging) {
            return;
        }

        state.cube.rotation.y += (e.clientX - state.previousMousePosition.x) * 0.01;
        state.cube.rotation.x += (e.clientY - state.previousMousePosition.y) * 0.01;
        state.previousMousePosition = {
            x: e.clientX,
            y: e.clientY,
        };
    });
    canvas.addEventListener("pointerup", () => {
        state.isDragging = false;
    });
    canvas.addEventListener("pointercancel", () => {
        state.isDragging = false;
    });
}

function startAnimationLoop(state: TrayState): void {
    function animate(): void {
        state.animationId = requestAnimationFrame(animate);
        state.renderer.render(state.scene, state.camera);
    }
    animate();
}
