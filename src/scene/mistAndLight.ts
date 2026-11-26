import * as THREE from "three";
import { MeadowPalette } from "./palette";
import { clamp01, createNoiseGrid, sampleNoiseGrid } from "./terrainMath";

export interface MistBandEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  baseX: number;
  baseY: number;
  baseZ: number;
  depthFactor: number;
  speed: number;
  phase: number;
  baseOpacity: number;
}

export interface MistAndLightSystem {
  group: THREE.Group;
  ambientLight: THREE.AmbientLight;
  hemisphereLight: THREE.HemisphereLight;
  softSunLight: THREE.DirectionalLight;
  skyMesh: THREE.Mesh;
  groundMesh: THREE.Mesh;
  mistBands: MistBandEntry[];
  applyPalette: (palette: MeadowPalette) => void;
  update: (
    elapsedSec: number,
    arrivalProgress: number,
    pointerX: number,
    pointerY: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

function createSkyGradientTexture(topHex: string, horizonHex: string, glowHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, topHex);
    grad.addColorStop(0.58, horizonHex);
    grad.addColorStop(0.82, glowHex);
    grad.addColorStop(1, horizonHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMistBandTexture(
  noiseGrid: Float32Array,
  tintHex: string,
  bandIndex: number
): THREE.CanvasTexture {
  const width = 256;
  const height = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const tintColor = new THREE.Color(tintHex);

  const rBase = Math.round(clamp01(tintColor.r) * 255);
  const gBase = Math.round(clamp01(tintColor.g) * 255);
  const bBase = Math.round(clamp01(tintColor.b) * 255);

  if (ctx) {
    const img = ctx.createImageData(width, height);
    const data = img.data;
    const shiftU = bandIndex * 47.3;
    const shiftV = bandIndex * 29.7;

    for (let y = 0; y < height; y++) {
      const vNorm = y / Math.max(1, height - 1);
      // Soft vertical feathering so mist never has hard edges.
      const vertEnvelope = Math.sin(Math.PI * clamp01(vNorm));
      const bell = Math.pow(vertEnvelope, 1.55);

      for (let x = 0; x < width; x++) {
        const uNorm = x / width;
        // Seamless horizontal tiling via periodic noise sampling.
        const angle = uNorm * Math.PI * 2;
        const nx = 18 + Math.cos(angle) * 6.5 + shiftU;
        const ny = 18 + Math.sin(angle) * 6.5 + shiftV;

        const nBroad = sampleNoiseGrid(noiseGrid, nx * 0.65, ny * 0.65 + vNorm * 14);
        const nDetail = sampleNoiseGrid(noiseGrid, nx * 1.9 + 13.1, ny * 1.9 + vNorm * 28);
        const density = clamp01((nBroad * 0.68 + nDetail * 0.32 - 0.34) * 2.35);

        const idx = (y * width + x) * 4;
        data[idx] = rBase;
        data[idx + 1] = gBase;
        data[idx + 2] = bBase;
        data[idx + 3] = Math.round(clamp01(density * bell) * 255);
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates diffused atmospheric lighting, sky gradient backdrop,
 * deep botanical ground transition, and drifting valley mist bands.
 * Avoids harsh studio spotlights or sharp shadow casters.
 */
export function buildMistAndLight(palette: MeadowPalette, seed = 42): MistAndLightSystem {
  const group = new THREE.Group();
  group.name = "MeadowAtmosphereGroup";

  // Soft, diffused lighting without hard directional shadows.
  const ambientLight = new THREE.AmbientLight(palette.ambientLight, 0.72);
  ambientLight.name = "SoftAmbientLight";

  const hemisphereLight = new THREE.HemisphereLight(
    palette.skyTop,
    palette.ground,
    0.68
  );
  hemisphereLight.name = "SkyGroundHemisphereLight";

  // Gentle low-intensity sky bias light (castShadow intentionally false).
  const softSunLight = new THREE.DirectionalLight(palette.glow, 0.32);
  softSunLight.position.set(8, 14, 12);
  softSunLight.castShadow = false;
  softSunLight.name = "GentleSkyBiasLight";

  // Sky backdrop plane behind all ridges.
  let skyTexture = createSkyGradientTexture(
    palette.skyTop,
    palette.skyHorizon,
    palette.glow
  );
  const skyGeometry = new THREE.PlaneGeometry(180, 72);
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  skyMesh.name = "MeadowSkyBackdrop";
  skyMesh.position.set(0, 12, -62);
  skyMesh.renderOrder = 0;

  // Deep botanical ground plane anchoring the lower frame where UI sits.
  const groundGeometry = new THREE.PlaneGeometry(180, 48);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.ground),
    depthWrite: true,
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.name = "MeadowGroundPlane";
  groundMesh.position.set(0, -10.8, -14);
  groundMesh.renderOrder = 1;

  // Drifting mist bands nestled between ridge valleys.
  const noiseGrid = createNoiseGrid(seed + 509, 256, 32);
  const bandCount = 5;
  const mistBands: MistBandEntry[] = [];

  for (let i = 0; i < bandCount; i++) {
    const q = i / Math.max(1, bandCount - 1);
    const zPos = -44 + q * 36;
    const yPos = -3.4 - q * 1.4 + (i % 2 === 0 ? 0.35 : -0.25);
    const bandWidth = 96;
    const bandHeight = 4.2 + q * 2.2;
    const baseOpacity = (0.28 - q * 0.12) * (palette.night ? 0.85 : 1);

    const tex = createMistBandTexture(noiseGrid, palette.mistTint, i);
    const geom = new THREE.PlaneGeometry(bandWidth, bandHeight);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `ValleyMistBand_${i + 1}`;
    mesh.position.set(0, yPos, zPos);
    mesh.renderOrder = 2 + i;

    group.add(mesh);

    mistBands.push({
      mesh,
      material: mat,
      baseX: 0,
      baseY: yPos,
      baseZ: zPos,
      depthFactor: q,
      speed: (0.018 + (1 - q) * 0.022) * (i % 2 === 0 ? 1 : -0.85),
      phase: i * 1.37,
      baseOpacity,
    });
  }

  group.add(skyMesh);
  group.add(groundMesh);

  let currentPalette = palette;

  const applyPalette = (nextPalette: MeadowPalette) => {
    currentPalette = nextPalette;

    ambientLight.color.set(nextPalette.ambientLight);
    hemisphereLight.color.set(nextPalette.skyTop);
    hemisphereLight.groundColor.set(nextPalette.ground);
    softSunLight.color.set(nextPalette.glow);

    skyTexture.dispose();
    skyTexture = createSkyGradientTexture(
      nextPalette.skyTop,
      nextPalette.skyHorizon,
      nextPalette.glow
    );
    skyMaterial.map = skyTexture;
    skyMaterial.needsUpdate = true;

    groundMaterial.color.set(nextPalette.ground);

    mistBands.forEach((band, idx) => {
      if (band.material.map) {
        band.material.map.dispose();
      }
      const nextTex = createMistBandTexture(noiseGrid, nextPalette.mistTint, idx);
      band.material.map = nextTex;
      band.baseOpacity = (0.28 - band.depthFactor * 0.12) * (nextPalette.night ? 0.85 : 1);
      band.material.needsUpdate = true;
    });
  };

  const update = (
    elapsedSec: number,
    arrivalProgress: number,
    pointerX: number,
    pointerY: number,
    reducedMotion: boolean
  ) => {
    // Soft light follows pointer gently across the sky without harsh movement.
    const lightShiftX = reducedMotion ? 8 : 8 + pointerX * 7.5;
    const lightShiftY = reducedMotion ? 14 : 14 + pointerY * 3.5;
    softSunLight.position.set(lightShiftX, lightShiftY, 12);

    // Subtle sky & ground shift with scroll and pointer.
    const skyParallaxX = reducedMotion ? 0 : pointerX * 0.65;
    const skyParallaxY = reducedMotion ? 0 : pointerY * 0.35 + (arrivalProgress - 0.5) * 0.8;
    skyMesh.position.x = skyParallaxX;
    skyMesh.position.y = 12 + skyParallaxY;

    groundMesh.position.x = reducedMotion ? 0 : pointerX * 0.9;
    groundMesh.position.y = -10.8 + (reducedMotion ? 0 : (arrivalProgress - 0.5) * 0.6);

    // Fog lifts gently as the scene arrives into view.
    const fogLift = reducedMotion ? 1 : clamp01(0.35 + arrivalProgress * 0.65);

    for (let i = 0; i < mistBands.length; i++) {
      const band = mistBands[i];
      const driftOffset = reducedMotion ? 0 : Math.sin(elapsedSec * band.speed * 6 + band.phase) * 2.4;
      const pointerShift = reducedMotion ? 0 : pointerX * (0.35 + band.depthFactor * 0.85);
      const scrollShiftY = reducedMotion ? 0 : (arrivalProgress - 0.5) * (0.3 + band.depthFactor * 0.7);
      const waveY = reducedMotion ? 0 : Math.cos(elapsedSec * 0.35 + band.phase) * 0.16;

      band.mesh.position.x = band.baseX + driftOffset + pointerShift;
      band.mesh.position.y = band.baseY + scrollShiftY + waveY;
      band.material.opacity = clamp01(
        band.baseOpacity * fogLift * (currentPalette.night ? 0.9 : 1)
      );
    }
  };

  const dispose = () => {
    skyTexture.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    groundGeometry.dispose();
    groundMaterial.dispose();

    for (const band of mistBands) {
      if (band.material.map) {
        band.material.map.dispose();
      }
      band.mesh.geometry.dispose();
      band.material.dispose();
    }
    mistBands.length = 0;
  };

  return {
    group,
    ambientLight,
    hemisphereLight,
    softSunLight,
    skyMesh,
    groundMesh,
    mistBands,
    applyPalette,
    update,
    dispose,
  };
}