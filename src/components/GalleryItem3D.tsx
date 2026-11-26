import { useEffect, useRef } from "react";
import * as THREE from "three";

export type GalleryModelType =
  | "crystal-spire"
  | "sun-orb"
  | "moss-torus"
  | "dew-icosahedron"
  | "alpine-pyramid"
  | "wind-knot"
  | "aurora-ring"
  | "stone-monolith"
  | "lotus-octahedron"
  | "mist-sphere";

export interface GalleryCardData {
  id: number;
  title: string;
  subtitle: string;
  modelType: GalleryModelType;
  color: string;
  accent: string;
}

interface GalleryItem3DProps {
  modelType: GalleryModelType;
  color: string;
  accent: string;
}

export function GalleryItem3D({ modelType, color, accent }: GalleryItem3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 260;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.35, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(accent, 2.2);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.1);
    rimLight.position.set(-3, -2, -3);
    scene.add(rimLight);

    const group = new THREE.Group();
    scene.add(group);

    const mainMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.28,
      metalness: 0.22,
      flatShading: modelType === "crystal-spire" || modelType === "alpine-pyramid" || modelType === "lotus-octahedron",
    });

    const wireMat = new THREE.MeshBasicMaterial({
      color: accent,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });

    let geometry: THREE.BufferGeometry;

    switch (modelType) {
      case "crystal-spire":
        geometry = new THREE.ConeGeometry(0.95, 1.85, 6);
        break;
      case "sun-orb":
        geometry = new THREE.DodecahedronGeometry(1.05, 1);
        break;
      case "moss-torus":
        geometry = new THREE.TorusGeometry(0.82, 0.32, 20, 48);
        break;
      case "dew-icosahedron":
        geometry = new THREE.IcosahedronGeometry(1.05, 0);
        break;
      case "alpine-pyramid":
        geometry = new THREE.ConeGeometry(1.1, 1.65, 4);
        break;
      case "wind-knot":
        geometry = new THREE.TorusKnotGeometry(0.68, 0.22, 96, 16);
        break;
      case "aurora-ring":
        geometry = new THREE.TorusGeometry(0.9, 0.16, 16, 64);
        break;
      case "stone-monolith":
        geometry = new THREE.BoxGeometry(1.05, 1.65, 0.68);
        break;
      case "lotus-octahedron":
        geometry = new THREE.OctahedronGeometry(1.12, 0);
        break;
      case "mist-sphere":
      default:
        geometry = new THREE.SphereGeometry(1.02, 28, 28);
        break;
    }

    const mesh = new THREE.Mesh(geometry, mainMat);
    const wireMesh = new THREE.Mesh(geometry, wireMat);
    wireMesh.scale.setScalar(1.06);

    group.add(mesh);
    group.add(wireMesh);

    if (modelType === "aurora-ring") {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 24, 24),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.2, metalness: 0.4 })
      );
      group.add(core);
    }

    let pointerX = 0;
    let pointerY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };

    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      group.rotation.y = t * 0.65 + pointerX * 0.7;
      group.rotation.x = Math.sin(t * 0.5) * 0.18 + pointerY * 0.45;
      group.position.y = Math.sin(t * 1.4) * 0.08;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 260;
      const h = container.clientHeight || 200;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      mainMat.dispose();
      wireMat.dispose();
      renderer.dispose();
    };
  }, [modelType, color, accent]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "190px",
        borderRadius: "14px",
        overflow: "hidden",
        background: "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.14), rgba(10,14,9,0.45))",
      }}
    />
  );
}