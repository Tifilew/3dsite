import * as THREE from "three";
import { buildBotanicalProps, BotanicalPropsSystem } from "./botanicalProps";
import { buildRidgeMeshes, RidgeGroupResult } from "./buildRidgeMeshes";
import { buildMistAndLight, MistAndLightSystem } from "./mistAndLight";
import {
  MeadowPalette,
  MeadowPaletteOverrides,
  MeadowPreset,
  resolveMeadowPalette,
} from "./palette";
import { clamp01, computeScrollArrival, createRidgeSpecs } from "./terrainMath";

export interface MeadowSceneOptions {
  container: HTMLElement;
  preset?: MeadowPreset;
  paletteOverrides?: MeadowPaletteOverrides;
  seed?: number;
  ridgeCount?: number;
  botanicalCount?: number;
  reducedMotion?: boolean;
  prefersDark?: boolean;
}

export class MeadowSceneController {
  private readonly container: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly ridges: RidgeGroupResult;
  private readonly atmosphere: MistAndLightSystem;
  private readonly botanicals: BotanicalPropsSystem;

  private currentPalette: MeadowPalette;
  private preset: MeadowPreset;
  private paletteOverrides?: MeadowPaletteOverrides;
  private prefersDark: boolean;
  private reducedMotion: boolean;
  private isVisible = true;
  private isDisposed = false;

  private width = 1;
  private height = 1;

  private targetPointerX = 0;
  private targetPointerY = 0;
  private smoothPointerX = 0;
  private smoothPointerY = 0;

  private targetArrival = 0.65;
  private smoothArrival = 0.65;

  private rafId: number | null = null;
  private startTimeMs = performance.now();
  private lastFrameMs = performance.now();

  constructor(options: MeadowSceneOptions) {
    this.container = options.container;
    this.preset = options.preset ?? "auto";
    this.paletteOverrides = options.paletteOverrides;
    this.prefersDark = options.prefersDark ?? false;
    this.reducedMotion = options.reducedMotion ?? false;

    const seed = options.seed ?? 42;
    const ridgeCount = options.ridgeCount ?? 6;
    const botanicalCount = options.botanicalCount ?? 22;

    this.currentPalette = resolveMeadowPalette(
      this.preset,
      this.paletteOverrides,
      this.prefersDark
    );

    this.scene = new THREE.Scene();
    this.scene.name = "MeadowDaylightScene";
    this.scene.fog = new THREE.FogExp2(this.currentPalette.haze, 0.0115);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    this.camera.position.set(0, 0.25, 14.5);
    this.camera.lookAt(0, -1.35, -18);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = false;

    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    this.container.innerHTML = "";
    this.container.appendChild(canvas);

    this.atmosphere = buildMistAndLight(this.currentPalette, seed);
    this.scene.add(this.atmosphere.ambientLight);
    this.scene.add(this.atmosphere.hemisphereLight);
    this.scene.add(this.atmosphere.softSunLight);
    this.scene.add(this.atmosphere.group);

    const ridgeSpecs = createRidgeSpecs(ridgeCount, seed);
    this.ridges = buildRidgeMeshes(ridgeSpecs, this.currentPalette, seed);
    this.scene.add(this.ridges.group);

    this.botanicals = buildBotanicalProps(this.currentPalette, seed, botanicalCount);
    this.scene.add(this.botanicals.group);

    this.resize();
    this.updateScrollArrival();
    this.renderSingleFrame(0);
    this.startLoop();
  }

  public resize(): void {
    if (this.isDisposed) return;

    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || this.container.clientWidth || window.innerWidth || 1));
    const h = Math.max(1, Math.round(rect.height || this.container.clientHeight || 420));

    this.width = w;
    this.height = h;

    const isCompactViewport = w < 640;
    this.camera.fov = isCompactViewport ? 48 : 42;
    this.camera.position.z = isCompactViewport ? 17.5 : 14.5;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const maxDpr = isCompactViewport ? 1.75 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);

    this.updateScrollArrival();
    if (!this.rafId || this.reducedMotion) {
      this.renderSingleFrame(0);
    }
  }

  public setPointerNormalized(nx: number, ny: number): void {
    this.targetPointerX = Math.max(-1, Math.min(1, nx));
    this.targetPointerY = Math.max(-1, Math.min(1, ny));
  }

  public setScrollArrival(arrival01: number): void {
    this.targetArrival = clamp01(arrival01);
    if (this.reducedMotion) {
      this.smoothArrival = this.targetArrival;
      this.renderSingleFrame(0);
    }
  }

  public updateScrollArrival(): void {
    if (this.isDisposed) return;
    const rect = this.container.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    const arrival = computeScrollArrival(rect.top, rect.height, vh);
    this.setScrollArrival(arrival);
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) {
      this.smoothPointerX = this.targetPointerX;
      this.smoothPointerY = this.targetPointerY;
      this.smoothArrival = this.targetArrival;
      this.renderSingleFrame(0);
    }
  }

  public setThemeConfig(
    preset?: MeadowPreset,
    paletteOverrides?: MeadowPaletteOverrides,
    prefersDark?: boolean
  ): void {
    if (preset !== undefined) this.preset = preset;
    if (paletteOverrides !== undefined) this.paletteOverrides = paletteOverrides;
    if (prefersDark !== undefined) this.prefersDark = prefersDark;

    this.currentPalette = resolveMeadowPalette(
      this.preset,
      this.paletteOverrides,
      this.prefersDark
    );

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(this.currentPalette.haze);
    } else {
      this.scene.fog = new THREE.FogExp2(this.currentPalette.haze, 0.0115);
    }

    this.atmosphere.applyPalette(this.currentPalette);
    this.ridges.applyPalette(this.currentPalette);
    this.botanicals.applyPalette(this.currentPalette);

    this.renderSingleFrame(0);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible && !this.isDisposed) {
      this.lastFrameMs = performance.now();
      this.updateScrollArrival();
      this.renderSingleFrame(0);
    }
  }

  private renderSingleFrame(dtSec: number): void {
    if (this.isDisposed) return;

    const elapsedSec = (performance.now() - this.startTimeMs) * 0.001;
    const damping = this.reducedMotion ? 1 : 1 - Math.exp(-Math.max(0.001, dtSec) * 6.5);

    this.smoothPointerX += (this.targetPointerX - this.smoothPointerX) * damping;
    this.smoothPointerY += (this.targetPointerY - this.smoothPointerY) * damping;
    this.smoothArrival += (this.targetArrival - this.smoothArrival) * damping;

    const camBaseZ = this.width < 640 ? 17.5 : 14.5;
    const camX = this.reducedMotion ? 0 : this.smoothPointerX * 0.55;
    const camY =
      (this.reducedMotion ? 0 : this.smoothPointerY * 0.25) +
      0.25 +
      (this.smoothArrival - 0.5) * 0.4;

    this.camera.position.set(camX, camY, camBaseZ);
    this.camera.lookAt(camX * 0.45, -1.35 + (this.smoothArrival - 0.5) * 0.35, -18);

    this.atmosphere.update(
      elapsedSec,
      this.smoothArrival,
      this.smoothPointerX,
      this.smoothPointerY,
      this.reducedMotion
    );

    this.ridges.updateMotion(
      elapsedSec,
      this.smoothArrival,
      this.smoothPointerX,
      this.smoothPointerY,
      this.reducedMotion
    );

    this.botanicals.update(
      elapsedSec,
      this.smoothArrival,
      this.smoothPointerX,
      this.smoothPointerY,
      this.reducedMotion
    );

    this.renderer.render(this.scene, this.camera);
  }

  private startLoop(): void {
    const tick = (nowMs: number) => {
      if (this.isDisposed) return;
      this.rafId = window.requestAnimationFrame(tick);

      if (!this.isVisible) {
        this.lastFrameMs = nowMs;
        return;
      }

      const rawDt = (nowMs - this.lastFrameMs) * 0.001;
      this.lastFrameMs = nowMs;
      const dtSec = Math.min(0.1, Math.max(0.001, rawDt));

      this.renderSingleFrame(dtSec);
    };

    this.rafId = window.requestAnimationFrame(tick);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.ridges.dispose();
    this.atmosphere.dispose();
    this.botanicals.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}