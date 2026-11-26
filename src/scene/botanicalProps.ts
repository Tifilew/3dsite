import * as THREE from "three";
import { MeadowPalette } from "./palette";
import { clamp01, createSeededRng } from "./terrainMath";

export interface BotanicalStemInstance {
  pivot: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  swayAmp: number;
  staggerOrder: number;
  scale: number;
}

export interface BotanicalPropsSystem {
  group: THREE.Group;
  stems: BotanicalStemInstance[];
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

function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.05,
      size * 0.5,
      size * 0.5,
      size * 0.48
    );
    grad.addColorStop(0, "rgba(255, 255, 255, 0.72)");
    grad.addColorStop(0.55, "rgba(255, 255, 255, 0.25)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds procedural 3D meadow botanicals (curved stems, leaves,
 * flower petals/seed heads) with soft grounding contact shadows—no sharp shadows.
 */
export function buildBotanicalProps(
  palette: MeadowPalette,
  seed = 42,
  count = 22
): BotanicalPropsSystem {
  const group = new THREE.Group();
  group.name = "MeadowBotanicalsGroup";

  const rng = createSeededRng(seed * 613 + 29);
  const stemCount = Math.max(4, count);

  const stemMaterial = new THREE.MeshLambertMaterial({
    color: new THREE.Color(palette.botanicalStem),
    side: THREE.DoubleSide,
  });

  const accentMaterial = new THREE.MeshLambertMaterial({
    color: new THREE.Color(palette.botanicalAccent),
    side: THREE.DoubleSide,
  });

  const contactShadowTex = createSoftContactShadowTexture();
  const contactShadowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(palette.contactShadow),
    map: contactShadowTex,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  // Shared procedural geometries for lightweight 3D botanical construction.
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.65, 0.03),
    new THREE.Vector3(-0.04, 1.35, -0.02),
    new THREE.Vector3(0.05, 2.0, 0.02),
  ]);
  const sharedStemGeo = new THREE.TubeGeometry(stemCurve, 12, 0.022, 6, false);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.14, 0.22, 0.03, 0.55);
  leafShape.quadraticCurveTo(-0.08, 0.25, 0, 0);
  const sharedLeafGeo = new THREE.ShapeGeometry(leafShape, 8);

  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.quadraticCurveTo(0.09, 0.14, 0, 0.28);
  petalShape.quadraticCurveTo(-0.09, 0.14, 0, 0);
  const sharedPetalGeo = new THREE.ShapeGeometry(petalShape, 6);

  const sharedSeedGeo = new THREE.ConeGeometry(0.045, 0.22, 6);
  const sharedShadowGeo = new THREE.PlaneGeometry(0.75, 0.35);
  sharedShadowGeo.rotateX(-Math.PI / 2);

  const stems: BotanicalStemInstance[] = [];

  for (let i = 0; i < stemCount; i++) {
    const tNorm = stemCount > 1 ? i / (stemCount - 1) : 0.5;
    const baseX = (tNorm - 0.5) * 34 + (rng() - 0.5) * 1.4;
    const baseZ = -4.5 + (rng() - 0.5) * 4.5 + Math.abs(tNorm - 0.5) * 1.2;
    const baseY = -6.9 + (rng() - 0.5) * 0.35;
    const scale = 0.72 + rng() * 0.62;
    const tiltZ = (rng() - 0.5) * 0.26;
    const rotY = rng() * Math.PI * 2;

    const pivot = new THREE.Group();
    pivot.name = `BotanicalStem_${i + 1}`;
    pivot.position.set(baseX, baseY, baseZ);
    pivot.rotation.set(0, rotY, tiltZ);
    pivot.scale.setScalar(scale);

    // Soft contact shadow directly under the stem base.
    const shadowDisc = new THREE.Mesh(sharedShadowGeo, contactShadowMaterial);
    shadowDisc.position.set(0, 0.01, 0);
    shadowDisc.renderOrder = 6;
    pivot.add(shadowDisc);

    // Curved stem.
    const stemMesh = new THREE.Mesh(sharedStemGeo, stemMaterial);
    stemMesh.renderOrder = 7;
    pivot.add(stemMesh);

    // Alternating leaves along lower/mid stem.
    const leafCount = 2 + Math.floor(rng() * 2);
    for (let l = 0; l < leafCount; l++) {
      const leaf = new THREE.Mesh(sharedLeafGeo, stemMaterial);
      const hFrac = 0.25 + l * 0.26;
      const side = l % 2 === 0 ? 1 : -1;
      leaf.position.set(0, 2.0 * hFrac, 0);
      leaf.rotation.set(0.25, side * 0.65, side * 0.62);
      leaf.scale.setScalar(0.75 + rng() * 0.45);
      leaf.renderOrder = 7;
      pivot.add(leaf);
    }

    // Flower head or seed ear at tip.
    const kind = i % 3;
    if (kind === 0) {
      // Open wildflower crown (6 petals).
      const flowerGroup = new THREE.Group();
      flowerGroup.position.set(0.05, 2.0, 0.02);
      flowerGroup.rotation.x = 0.35;

      const petalCount = 6;
      for (let p = 0; p < petalCount; p++) {
        const petal = new THREE.Mesh(sharedPetalGeo, accentMaterial);
        petal.rotation.z = (p / petalCount) * Math.PI * 2;
        petal.renderOrder = 8;
        flowerGroup.add(petal);
      }
      pivot.add(flowerGroup);
    } else if (kind === 1) {
      // Slender seed ear.
      const ear = new THREE.Mesh(sharedSeedGeo, accentMaterial);
      ear.position.set(0.05, 2.08, 0.02);
      ear.rotation.z = -0.14;
      ear.renderOrder = 8;
      pivot.add(ear);
    } else {
      // Delicate nodding bud.
      const bud = new THREE.Mesh(sharedPetalGeo, accentMaterial);
      bud.position.set(0.05, 1.98, 0.02);
      bud.rotation.set(0.5, 0.2, -0.35);
      bud.scale.setScalar(0.85);
      bud.renderOrder = 8;
      pivot.add(bud);
    }

    group.add(pivot);

    stems.push({
      pivot,
      baseX,
      baseY,
      baseZ,
      phase: rng() * Math.PI * 2,
      swayAmp: 0.035 + rng() * 0.045,
      staggerOrder: tNorm * 0.35 + rng() * 0.15,
      scale,
    });
  }

  const applyPalette = (nextPalette: MeadowPalette) => {
    stemMaterial.color.set(nextPalette.botanicalStem);
    accentMaterial.color.set(nextPalette.botanicalAccent);
    contactShadowMaterial.color.set(nextPalette.contactShadow);
  };

  const update = (
    elapsedSec: number,
    arrivalProgress: number,
    pointerX: number,
    pointerY: number,
    reducedMotion: boolean
  ) => {
    for (let i = 0; i < stems.length; i++) {
      const item = stems[i];
      const localArrival = reducedMotion
        ? 1
        : clamp01((arrivalProgress - item.staggerOrder) / Math.max(0.25, 1 - item.staggerOrder));
      const eased = 1 - Math.pow(1 - localArrival, 4);

      const growScale = item.scale * (0.15 + 0.85 * eased);
      item.pivot.scale.setScalar(growScale);

      const swayZ = reducedMotion
        ? 0
        : Math.sin(elapsedSec * 1.15 + item.phase) * item.swayAmp + pointerX * 0.04;
      const swayX = reducedMotion
        ? 0
        : Math.cos(elapsedSec * 0.85 + item.phase * 1.3) * (item.swayAmp * 0.6) - pointerY * 0.025;

      const parallaxX = reducedMotion ? 0 : pointerX * 0.95;
      const scrollY = reducedMotion ? 0 : (arrivalProgress - 0.5) * 0.85;

      item.pivot.position.x = item.baseX + parallaxX;
      item.pivot.position.y = item.baseY + scrollY - (1 - eased) * 0.45;
      item.pivot.rotation.x = swayX;
      item.pivot.rotation.z = swayZ;
    }
  };

  const dispose = () => {
    sharedStemGeo.dispose();
    sharedLeafGeo.dispose();
    sharedPetalGeo.dispose();
    sharedSeedGeo.dispose();
    sharedShadowGeo.dispose();
    stemMaterial.dispose();
    accentMaterial.dispose();
    contactShadowTex.dispose();
    contactShadowMaterial.dispose();
    stems.length = 0;
  };

  return {
    group,
    stems,
    applyPalette,
    update,
    dispose,
  };
}