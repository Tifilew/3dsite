import React, { useEffect, useRef, useState } from "react";
import { MeadowSceneController } from "../scene/MeadowSceneController";
import { MeadowPaletteOverrides, MeadowPreset } from "../scene/palette";

export interface MeadowCanvasProps {
  preset?: MeadowPreset;
  paletteOverrides?: MeadowPaletteOverrides;
  seed?: number;
  ridgeCount?: number;
  botanicalCount?: number;
  interactive?: boolean;
  scrollParallax?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readPrefersDark(container: HTMLElement | null): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return true;
  }
  if (container && container.closest(".dark")) {
    return true;
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return false;
}

export const MeadowCanvas: React.FC<MeadowCanvasProps> = ({
  preset = "auto",
  paletteOverrides,
  seed = 42,
  ridgeCount = 6,
  botanicalCount = 22,
  interactive = true,
  scrollParallax = true,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MeadowSceneController | null>(null);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => readPrefersReducedMotion());
  const [prefersDark, setPrefersDark] = useState<boolean>(() => false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const darkMq = window.matchMedia("(prefers-color-scheme: dark)");

    const updateMotion = () => setReducedMotion(motionMq.matches);
    const updateDark = () => setPrefersDark(readPrefersDark(containerRef.current));

    updateMotion();
    updateDark();

    motionMq.addEventListener("change", updateMotion);
    darkMq.addEventListener("change", updateDark);

    const observer = new MutationObserver(updateDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      motionMq.removeEventListener("change", updateMotion);
      darkMq.removeEventListener("change", updateDark);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setPrefersDark(readPrefersDark(el));

    const controller = new MeadowSceneController({
      container: el,
      preset,
      paletteOverrides,
      seed,
      ridgeCount,
      botanicalCount,
      reducedMotion: readPrefersReducedMotion(),
      prefersDark: readPrefersDark(el),
    });
    controllerRef.current = controller;

    const resizeObserver = new ResizeObserver(() => {
      controller.resize();
    });
    resizeObserver.observe(el);

    const handleWindowResize = () => {
      controller.resize();
    };
    window.addEventListener("resize", handleWindowResize, { passive: true });

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            controller.setVisible(entry.isIntersecting || entry.intersectionRatio > 0);
          }
        },
        { threshold: [0, 0.05] }
      );
      intersectionObserver.observe(el);
    }

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      resizeObserver.disconnect();
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
      controller.dispose();
      controllerRef.current = null;
    };
  }, [seed, ridgeCount, botanicalCount]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setThemeConfig(preset, paletteOverrides, prefersDark);
  }, [preset, paletteOverrides, prefersDark]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const controller = controllerRef.current;
    const el = containerRef.current;
    if (!controller || !el || !interactive) {
      controller?.setPointerNormalized(0, 0);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      controller.setPointerNormalized(nx, ny);
    };

    const handlePointerLeave = () => {
      controller.setPointerNormalized(0, 0);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    el.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [interactive]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    if (!scrollParallax) {
      controller.setScrollArrival(1);
      return;
    }

    const onScroll = () => {
      controller.updateScrollArrival();
    };

    controller.updateScrollArrival();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [scrollParallax]);

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        ...style,
      }}
    />
  );
};