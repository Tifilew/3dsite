import * as THREE from "three";
import { MeadowPalette } from "./palette";
import {
  clamp01,
  createNoiseGrid,
  evaluateRidgeCrestY,
  evaluateRidgeSeam,
  evaluateRidgeSlopeX,
  evaluateSoftSlopeLight,
  RidgeLayerSpec,
  sampleNoiseGrid,
} from "./terrainMath";

export interface RidgeMeshEntry {
  spec: RidgeLayerSpec;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  baseY: number;
  baseZ: number;
  baseX: number;
  litColor: THREE.Color;
  shadowColor: THREE.Color;
  hazeColor: THREE.Color;
  /** Initial rise offset when arriving in view. */
  riseOffsetY: number;
}

export interface RidgeGroupResult {
  group: THREE.Group;
  entries: RidgeMeshEntry[];
  applyPalette: (palette: MeadowPalette) => void;
  updateMotion: (
    elapsedSec: number,
    arrivalProgress: number,
    pointerX: number,
    pointerY: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

/**
 * Builds layered 3D terrain ridge strips with smooth dome crests,
 * gentle back-to-front depth tilt, soft slope shading, grass micro-variation,
 * and progressive aerial haze toward the horizon.
 */
export function buildRidgeMeshes(
  specs: RidgeLayerSpec[],
  palette: MeadowPalette,
  seed = 42
): RidgeGroupResult {
  const group = new THREE.Group();
  group.name = "MeadowRidgeGroup";

  const noise = createNoiseGrid(seed + 101, 256, 32);
  const width = 96;
  const cols = 192;
  const rows = 28;
  const skirtDepth = 16;

  const entries: RidgeMeshEntry[] = [];

  specs.forEach((spec, idx) => {
    const q = spec.depthFactor;
    const geometry = new THREE.PlaneGeometry(width, skirtDepth, cols, rows);
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);

    const tone = palette.ridges[idx] ?? palette.ridges[palette.ridges.length - 1];
    const litColor = new THREE.Color(tone.lit);
    const shadowColor = new THREE.Color(tone.shadow);
    const hazeColor = new THREE.Color(palette.haze);
    const tmpColor = new THREE.Color();
    const tmpLit = new THREE.Color();
    const tmpShadow = new THREE.Color();

    const patchAmp = 0.14 + 0.12 * q;
    const clumpAmp = 0.05 + 0.08 * q;
    const grainAmp = 0.03 + 0.05 * q;
    const laneOffset = q * 73.5 + idx * 19.3;

    const writeVertexColors = (
      pLit: THREE.Color,
      pShadow: THREE.Color,
      pHaze: THREE.Color
    ) => {
      for (let r = 0; r <= rows; r++) {
        // v = 0 at top row (crest), v = 1 at bottom row (deep skirt).
        const v = r / rows;
        const depthBelowCrest = Math.pow(v, 1.35) * spec.slopeDepth * 2.4;

        for (let c = 0; c <= cols; c++) {
          const u = c / cols;
          const x = (u - 0.5) * width;
          const crestY = evaluateRidgeCrestY(spec, x);
          const slopeX = evaluateRidgeSlopeX(spec, x);
          const seam = evaluateRidgeSeam(spec, x);

          // Gentle convex curve down the face so the hill recedes softly.
          const y = crestY - Math.pow(v, 1.18) * skirtDepth;
          // Subtle back-slope tilt along Z for real 3D overlap between ridges.
          const zCurve = -Math.pow(v, 1.25) * (1.6 + (1 - q) * 2.2);

          const idxVert = r * (cols + 1) + c;
          posAttr.setXYZ(idxVert, x, y, zCurve);

          const lightVal = evaluateSoftSlopeLight(slopeX, depthBelowCrest, spec.slopeDepth);
          const creaseFactor = 1 - seam * 0.24 * (1 - v * 0.65);
          const depthDarken = 1 - clamp01(v * 0.22);

          tmpLit.copy(pLit);
          tmpShadow.copy(pShadow);
          tmpColor.copy(tmpShadow).lerp(tmpLit, lightVal);
          tmpColor.multiplyScalar(creaseFactor * depthDarken);

          // Procedural grass patch & clump variation (stronger on nearer ridges).
          const patchSample =
            sampleNoiseGrid(noise, x * 0.08 + laneOffset, depthBelowCrest * 0.18 + v * 12) - 0.5;
          const clumpSample =
            sampleNoiseGrid(noise, x * 0.42 + 41.2, depthBelowCrest * 1.45 + laneOffset) - 0.5;

          // Deterministic high-frequency micro-grain.
          const hashSeed = Math.imul(c + 7919, 374761393) ^ Math.imul(r + 104729, 668265263);
          const grainUnit = (((hashSeed ^ (hashSeed >>> 13)) * 1274126177) >>> 0) / 4294967296 - 0.5;

          const textureFactor =
            1 +
            patchSample * patchAmp * (1 - v * 0.5) +
            clumpSample * clumpAmp * (1 - v * 0.65) +
            grainUnit * grainAmp * (1 - v * 0.75);

          tmpColor.multiplyScalar(textureFactor);

          // Progressive aerial haze: stronger in distance and slightly deeper down valleys.
          const localHaze = clamp01(
            spec.hazeAmount +
              0.08 * (1 - q) * Math.exp(-depthBelowCrest / 2.2) +
              0.12 * (1 - q) * clamp01(v)
          );
          tmpColor.lerp(pHaze, localHaze);

          colors[idxVert * 3] = clamp01(tmpColor.r);
          colors[idxVert * 3 + 1] = clamp01(tmpColor.g);
          colors[idxVert * 3 + 2] = clamp01(tmpColor.b);
        }
      }

      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      posAttr.needsUpdate = true;
    };

    writeVertexColors(litColor, shadowColor, hazeColor);

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `MeadowRidge_${idx + 1}`;
    mesh.position.set(0, 0, spec.zPos);
    mesh.renderOrder = 2 + idx;

    // Far ridges rise slightly earlier; near ridges settle with a touch more travel.
    const riseOffsetY = -5.5 - q * 3.5;

    group.add(mesh);

    entries.push({
      spec,
      mesh,
      geometry,
      material,
      baseY: 0,
      baseZ: spec.zPos,
      baseX: 0,
      litColor,
      shadowColor,
      hazeColor,
      riseOffsetY,
    });
  });

  const applyPalette = (nextPalette: MeadowPalette) => {
    entries.forEach((entry, idx) => {
      const tone = nextPalette.ridges[idx] ?? nextPalette.ridges[nextPalette.ridges.length - 1];
      entry.litColor.set(tone.lit);
      entry.shadowColor.set(tone.shadow);
      entry.hazeColor.set(nextPalette.haze);

      const posAttr = entry.geometry.attributes.position as THREE.BufferAttribute;
      const colorAttr = entry.geometry.attributes.color as THREE.BufferAttribute;
      const arr = colorAttr.array as Float32Array;

      const q = entry.spec.depthFactor;
      const patchAmp = 0.14 + 0.12 * q;
      const clumpAmp = 0.05 + 0.08 * q;
      const grainAmp = 0.03 + 0.05 * q;
      const laneOffset = q * 73.5 + idx * 19.3;

      const tmpColor = new THREE.Color();
      const tmpLit = new THREE.Color();
      const tmpShadow = new THREE.Color();

      for (let r = 0; r <= rows; r++) {
        const v = r / rows;
        const depthBelowCrest = Math.pow(v, 1.35) * entry.spec.slopeDepth * 2.4;

        for (let c = 0; c <= cols; c++) {
          const x = (c / cols - 0.5) * width;
          const crestY = evaluateRidgeCrestY(entry.spec, x);
          const slopeX = evaluateRidgeSlopeX(entry.spec, x);
          const seam = evaluateRidgeSeam(entry.spec, x);

          const lightVal = evaluateSoftSlopeLight(slopeX, depthBelowCrest, entry.spec.slopeDepth);
          const creaseFactor = 1 - seam * 0.24 * (1 - v * 0.65);
          const depthDarken = 1 - clamp01(v * 0.22);

          tmpLit.copy(entry.litColor);
          tmpShadow.copy(entry.shadowColor);
          tmpColor.copy(tmpShadow).lerp(tmpLit, lightVal);
          tmpColor.multiplyScalar(creaseFactor * depthDarken);

          const patchSample =
            sampleNoiseGrid(noise, x * 0.08 + laneOffset, depthBelowCrest * 0.18 + v * 12) - 0.5;
          const clumpSample =
            sampleNoiseGrid(noise, x * 0.42 + 41.2, depthBelowCrest * 1.45 + laneOffset) - 0.5;

          const hashSeed = Math.imul(c + 7919, 374761393) ^ Math.imul(r + 104729, 668265263);
          const grainUnit = (((hashSeed ^ (hashSeed >>> 13)) * 1274126177) >>> 0) / 4294967296 - 0.5;

          const textureFactor =
            1 +
            patchSample * patchAmp * (1 - v * 0.5) +
            clumpSample * clumpAmp * (1 - v * 0.65) +
            grainUnit * grainAmp * (1 - v * 0.75);

          tmpColor.multiplyScalar(textureFactor);

          const localHaze = clamp01(
            entry.spec.hazeAmount +
              0.08 * (1 - q) * Math.exp(-depthBelowCrest / 2.2) +
              0.12 * (1 - q) * clamp01(v)
          );
          tmpColor.lerp(entry.hazeColor, localHaze);

          const idxVert = r * (cols + 1) + c;
          arr[idxVert * 3] = clamp01(tmpColor.r);
          arr[idxVert * 3 + 1] = clamp01(tmpColor.g);
          arr[idxVert * 3 + 2] = clamp01(tmpColor.b);
        }
      }

      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
    });
  };

  const updateMotion = (
    elapsedSec: number,
    arrivalProgress: number,
    pointerX: number,
    pointerY: number,
    reducedMotion: boolean
  ) => {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const q = entry.spec.depthFactor;

      // Staggered arrival from back (q = 0) to front (q = 1).
      const staggerStart = (1 - q) * 0.18;
      const localArrival = reducedMotion
        ? 1
        : clamp01((arrivalProgress - staggerStart) / Math.max(0.25, 1 - staggerStart));
      const easedArrival = 1 - Math.pow(1 - localArrival, 4);

      const riseY = (1 - easedArrival) * entry.riseOffsetY;
      // Subtle vertical scroll settle: nearer hills shift slightly more.
      const scrollLift = reducedMotion ? 0 : (arrivalProgress - 0.5) * (0.45 + q * 1.15);

      const parallaxX = reducedMotion ? 0 : pointerX * entry.spec.parallaxScale * 1.45;
      const parallaxY = reducedMotion ? 0 : pointerY * entry.spec.parallaxScale * 0.42;

      // Very gentle breathing sway in the breeze.
      const breeze = reducedMotion
        ? 0
        : Math.sin(elapsedSec * 0.42 + i * 0.9) * (0.03 + q * 0.04);

      entry.mesh.position.x = entry.baseX + parallaxX;
      entry.mesh.position.y = entry.baseY + riseY + scrollLift + parallaxY + breeze;
      entry.mesh.position.z = entry.baseZ;
    }
  };

  const dispose = () => {
    for (const entry of entries) {
      entry.geometry.dispose();
      entry.material.dispose();
    }
    entries.length = 0;
  };

  return {
    group,
    entries,
    applyPalette,
    updateMotion,
    dispose,
  };
}