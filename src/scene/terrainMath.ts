export interface RidgeDome {
  center: number;
  width: number;
  height: number;
}

export interface RidgeWave {
  frequency: number;
  phase: number;
  amplitude: number;
}

export interface RidgeLayerSpec {
  index: number;
  total: number;
  /** 0 for farthest ridge, 1 for nearest ridge. */
  depthFactor: number;
  /** World Z coordinate (negative is further away into the horizon). */
  zPos: number;
  /** Base elevation in world units. */
  baseHeight: number;
  /** Amplitude of domes and waves in world units. */
  amplitude: number;
  domes: RidgeDome[];
  waves: RidgeWave[];
  /** Depth of slope shading transition in world units. */
  slopeDepth: number;
  /** Aerial haze factor (0..1), stronger on distant ridges. */
  hazeAmount: number;
  /** Parallax multiplier for pointer/scroll motion. */
  parallaxScale: number;
  /** Stagger delay factor (0..1) for rise animation. */
  riseOrder: number;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Quartic ease-out for soft, unhurried settling. */
export function easeOutQuart(t: number): number {
  const c = clamp01(t);
  const inv = 1 - c;
  return 1 - inv * inv * inv * inv;
}

/** Deterministic PRNG (mulberry32) returning floats in [0, 1). */
export function createSeededRng(seed: number): () => number {
  let state = (seed | 0) ^ 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable 256x256 2D value noise table in [0, 1). */
export function createNoiseGrid(seed: number, size = 256, cells = 32): Float32Array {
  const rng = createSeededRng(seed * 7919 + 17);
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) {
    lattice[i] = rng();
  }

  const grid = new Float32Array(size * size);
  const step = size / cells;

  for (let y = 0; y < size; y++) {
    const gy = y / step;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const sy = fy * fy * (3 - 2 * fy);
    const row0 = (y0 % cells) * cells;
    const row1 = ((y0 + 1) % cells) * cells;

    for (let x = 0; x < size; x++) {
      const gx = x / step;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const sx = fx * fx * (3 - 2 * fx);
      const col0 = x0 % cells;
      const col1 = (x0 + 1) % cells;

      const a = lattice[row0 + col0] + (lattice[row0 + col1] - lattice[row0 + col0]) * sx;
      const b = lattice[row1 + col0] + (lattice[row1 + col1] - lattice[row1 + col0]) * sx;
      grid[y * size + x] = a + (b - a) * sy;
    }
  }

  return grid;
}

/** Bilinear wrapping sample on a 256x256 noise grid. */
export function sampleNoiseGrid(grid: Float32Array, u: number, v: number): number {
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const fx = u - x0;
  const fy = v - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const xa = ((x0 % 256) + 256) % 256;
  const xb = (xa + 1) % 256;
  const ya = (((y0 % 256) + 256) % 256) * 256;
  const yb = (((ya / 256 + 1) % 256) | 0) * 256;

  const v00 = grid[ya + xa];
  const v10 = grid[ya + xb];
  const v01 = grid[yb + xa];
  const v11 = grid[yb + xb];

  const top = v00 + (v10 - v00) * sx;
  const bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
}

/** Builds deterministic specifications for N overlapping terrain ridges. */
export function createRidgeSpecs(count = 6, seed = 42): RidgeLayerSpec[] {
  const specs: RidgeLayerSpec[] = [];
  const total = Math.max(1, count);

  for (let i = 0; i < total; i++) {
    const depthFactor = total > 1 ? i / (total - 1) : 1;
    const rng = createSeededRng(seed * 977 + i * 131 + 7);
    const domeCount = depthFactor > 0.9 ? 2 : 3 + Math.floor(rng() * 1.6);
    const domes: RidgeDome[] = [];
    const span = 36 / domeCount;
    const lean = i % 2 === 0 ? -1 : 1;

    for (let k = 0; k < domeCount; k++) {
      const center = -18 + (k + 0.15 + rng() * 0.7) * span;
      domes.push({
        center,
        width: (4.5 + rng() * 4.8) * (1 + depthFactor * 0.55),
        height:
          0.45 +
          rng() * 0.42 +
          0.16 * clamp01(0.5 + (center / 18) * lean * 0.6),
      });
    }

    const zPos = -48 + depthFactor * 42;
    const baseHeight = -2.6 - depthFactor * 1.45;
    const amplitude = 3.2 - depthFactor * 1.35;

    specs.push({
      index: i,
      total,
      depthFactor,
      zPos,
      baseHeight,
      amplitude,
      domes,
      waves: [
        { frequency: 0.09 + rng() * 0.06, phase: rng() * Math.PI * 2, amplitude: 0.14 },
        { frequency: 0.24 + rng() * 0.14, phase: rng() * Math.PI * 2, amplitude: 0.05 },
      ],
      slopeDepth: 2.2 + depthFactor * 4.2,
      hazeAmount: 0.04 + 0.52 * Math.pow(1 - depthFactor, 1.65),
      parallaxScale: 0.18 + depthFactor * 0.82,
      riseOrder: depthFactor,
    });
  }

  return specs;
}

/** Evaluates crest elevation Y at world X for a given ridge spec. */
export function evaluateRidgeCrestY(spec: RidgeLayerSpec, worldX: number): number {
  let expSum = 0;
  for (let i = 0; i < spec.domes.length; i++) {
    const dome = spec.domes[i];
    const z = (worldX - dome.center) / dome.width;
    const lobe = dome.height * Math.exp(-z * z);
    expSum += Math.exp(12 * lobe);
  }
  const domeTop = Math.log(Math.max(expSum, 1e-6)) / 12;

  let waveOffset = 0;
  for (let i = 0; i < spec.waves.length; i++) {
    const w = spec.waves[i];
    waveOffset += w.amplitude * Math.sin(worldX * w.frequency + w.phase);
  }

  return spec.baseHeight + spec.amplitude * (domeTop + waveOffset);
}

/** Returns 0..1 indicating proximity to a valley crease between two domes. */
export function evaluateRidgeSeam(spec: RidgeLayerSpec, worldX: number): number {
  let highest = 0;
  let second = 0;

  for (let i = 0; i < spec.domes.length; i++) {
    const dome = spec.domes[i];
    const z = (worldX - dome.center) / dome.width;
    const value = dome.height * Math.exp(-z * z);
    if (value > highest) {
      second = highest;
      highest = value;
    } else if (value > second) {
      second = value;
    }
  }

  if (second <= 0.12) return 0;
  const gap = (highest - second) / 0.08;
  return Math.exp(-gap * gap);
}

/** Computes dy/dx crest slope at world X. */
export function evaluateRidgeSlopeX(spec: RidgeLayerSpec, worldX: number, eps = 0.08): number {
  const yPlus = evaluateRidgeCrestY(spec, worldX + eps);
  const yMinus = evaluateRidgeCrestY(spec, worldX - eps);
  return (yPlus - yMinus) / (2 * eps);
}

/** Computes soft light factor (0..1) from slope and vertical distance below crest. */
export function evaluateSoftSlopeLight(
  slopeX: number,
  depthBelowCrest: number,
  slopeDepth: number,
  lightDir: readonly [number, number, number] = [0.38, 0.76, 0.52]
): number {
  const t = clamp01(depthBelowCrest / Math.max(0.001, slopeDepth));
  const blend = Math.pow(t, 0.62);

  const nx = -slopeX * 1.85 * (1 - blend);
  const ny = 1 - blend * 0.72;
  const nz = 0.35 + blend * 0.95;
  const len = Math.hypot(nx, ny, nz) || 1;

  const dot = (nx / len) * lightDir[0] + (ny / len) * lightDir[1] + (nz / len) * lightDir[2];
  return clamp01(0.24 + 0.76 * dot);
}

/** Computes 0..1 scroll arrival factor for a section/container in viewport. */
export function computeScrollArrival(rectTop: number, rectHeight: number, viewportHeight: number): number {
  const vh = Math.max(1, viewportHeight);
  const travel = Math.max(1, vh - Math.max(0, vh - rectHeight));
  return clamp01((vh - rectTop) / travel);
}