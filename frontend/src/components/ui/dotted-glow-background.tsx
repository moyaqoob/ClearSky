"use client";

import { useEffect, useRef, useState } from "react";

type DottedGlowBackgroundProps = {
  className?: string;
  /** distance between dot centers in pixels */
  gap?: number;
  /** base radius of each dot in CSS px */
  radius?: number;
  /** dot color (will pulse by alpha) */
  color?: string;
  /** optional dot color for dark mode */
  darkColor?: string;
  /** shadow/glow color for bright dots */
  glowColor?: string;
  /** optional glow color for dark mode */
  darkGlowColor?: string;
  /** optional secondary glow color for variety */
  glowColorSecondary?: string;
  /** optional CSS variable name for light dot color (e.g. --color-zinc-900) */
  colorLightVar?: string;
  /** optional CSS variable name for dark dot color (e.g. --color-zinc-100) */
  colorDarkVar?: string;
  /** optional CSS variable name for light glow color */
  glowColorLightVar?: string;
  /** optional CSS variable name for dark glow color */
  glowColorDarkVar?: string;
  /** global opacity for the whole layer */
  opacity?: number;
  /** background radial fade opacity (0 = transparent background) */
  backgroundOpacity?: number;
  /** minimum per-dot speed in rad/s */
  speedMin?: number;
  /** maximum per-dot speed in rad/s */
  speedMax?: number;
  /** global speed multiplier for all dots */
  speedScale?: number;
  /** glow blur strength (pixels) */
  glowBlur?: number;
  /** use smoother sine-based pulse instead of triangle wave */
  smoothPulse?: boolean;
};

/**
 * Canvas-based dotted background that randomly glows and dims.
 * - Uses a stable grid of dots.
 * - Each dot gets its own phase + speed producing organic shimmering.
 * - Handles high-DPI and resizes via ResizeObserver.
 */
export const DottedGlowBackground = ({
  className,
  gap = 14,
  radius = 2.2,
  color = "rgba(20, 27, 35, 0.85)",
  darkColor,
  glowColor = "rgba(59, 130, 246, 0.6)",
  darkGlowColor,
  glowColorSecondary = "rgba(14, 165, 233, 0.4)",
  colorLightVar,
  colorDarkVar,
  glowColorLightVar,
  glowColorDarkVar,
  opacity = 0.75,
  backgroundOpacity = 0,
  speedMin = 0.3,
  speedMax = 1,
  speedScale = 0.9,
  glowBlur = 10,
  smoothPulse = true,
}: DottedGlowBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [resolvedColor, setResolvedColor] = useState<string>(color);
  const [resolvedGlowColor, setResolvedGlowColor] = useState<string>(glowColor);
  const [resolvedGlowSecondary, setResolvedGlowSecondary] = useState<string>(
    glowColorSecondary,
  );

  // Resolve CSS variable value from the container or root
  const resolveCssVariable = (
    el: Element,
    variableName?: string,
  ): string | null => {
    if (!variableName) return null;
    const normalized = variableName.startsWith("--")
      ? variableName
      : `--${variableName}`;
    const fromEl = getComputedStyle(el as Element)
      .getPropertyValue(normalized)
      .trim();
    if (fromEl) return fromEl;
    const root = document.documentElement;
    const fromRoot = getComputedStyle(root).getPropertyValue(normalized).trim();
    return fromRoot || null;
  };

  const detectDarkMode = (): boolean => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) return true;
    if (root.classList.contains("light")) return false;
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  };

  // Keep resolved colors in sync with theme changes and prop updates
  useEffect(() => {
    const container = containerRef.current ?? document.documentElement;

    const compute = () => {
      const isDark = detectDarkMode();

      let nextColor: string = color;
      let nextGlow: string = glowColor;

      if (isDark) {
        const varDot = resolveCssVariable(container, colorDarkVar);
        const varGlow = resolveCssVariable(container, glowColorDarkVar);
        nextColor = varDot || darkColor || nextColor;
        nextGlow = varGlow || darkGlowColor || nextGlow;
      } else {
        const varDot = resolveCssVariable(container, colorLightVar);
        const varGlow = resolveCssVariable(container, glowColorLightVar);
        nextColor = varDot || nextColor;
        nextGlow = varGlow || nextGlow;
      }

      setResolvedColor(nextColor);
      setResolvedGlowColor(nextGlow);
      setResolvedGlowSecondary(glowColorSecondary);
    };

    compute();

    const mql = window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const handleMql = () => compute();
    mql?.addEventListener?.("change", handleMql);

    const mo = new MutationObserver(() => compute());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      mql?.removeEventListener?.("change", handleMql);
      mo.disconnect();
    };
  }, [
    color,
    darkColor,
    glowColor,
    darkGlowColor,
    glowColorSecondary,
    colorLightVar,
    colorDarkVar,
    glowColorLightVar,
    glowColorDarkVar,
  ]);

  useEffect(() => {
    const el = canvasRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const ctx = el.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stopped = false;

    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      el.width = Math.max(1, Math.floor(width * dpr));
      el.height = Math.max(1, Math.floor(height * dpr));
      el.style.width = `${Math.floor(width)}px`;
      el.style.height = `${Math.floor(height)}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Precompute dot metadata; optional second phase for secondary glow
    let dots: {
      x: number;
      y: number;
      phase: number;
      speed: number;
      glowPhase: number;
    }[] = [];

    const regenDots = () => {
      dots = [];
      const { width, height } = container.getBoundingClientRect();
      const cols = Math.ceil(width / gap) + 2;
      const rows = Math.ceil(height / gap) + 2;
      const min = Math.min(speedMin, speedMax);
      const max = Math.max(speedMin, speedMax);
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          const x = i * gap + (j % 2 === 0 ? 0 : gap * 0.5); // offset every other row
          const y = j * gap;
          // Randomize phase and speed slightly per dot
          const phase = Math.random() * Math.PI * 2;
          const glowPhase = Math.random() * Math.PI * 2;
          const span = Math.max(max - min, 0);
          const speed = min + Math.random() * span;
          dots.push({ x, y, phase, speed, glowPhase });
        }
      }
    };

    const regenThrottled = () => {
      regenDots();
    };

    regenDots();

    const draw = (now: number) => {
      if (stopped) return;
      const { width, height } = container.getBoundingClientRect();

      ctx.clearRect(0, 0, el.width, el.height);
      ctx.globalAlpha = opacity;

      // optional subtle background fade for depth (defaults to 0 = transparent)
      if (backgroundOpacity > 0) {
        const grad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.4,
          Math.min(width, height) * 0.1,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.7,
        );
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(
          1,
          `rgba(0,0,0,${Math.min(Math.max(backgroundOpacity, 0), 1)})`,
        );
        ctx.fillStyle = grad as unknown as CanvasGradient;
        ctx.fillRect(0, 0, width, height);
      }

      // Animate dots with optional smooth sine pulse
      ctx.save();
      ctx.fillStyle = resolvedColor;

      const time = (now / 1000) * Math.max(speedScale, 0);
      const blurMax = Math.max(1, glowBlur);

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        let a: number;
        if (smoothPulse) {
          const t = time * d.speed + d.phase;
          const sine = (Math.sin(t) + 1) * 0.5;
          a = 0.3 + 0.5 * sine;
        } else {
          const mod = (time * d.speed + d.phase) % 2;
          const lin = mod < 1 ? mod : 2 - mod;
          a = 0.25 + 0.55 * lin;
        }

        if (a > 0.5) {
          const glow = smoothPulse
            ? (a - 0.5) / 0.5
            : (a - 0.6) / 0.4;
          const t2 = time * d.speed * 0.7 + d.glowPhase;
          const mix = (Math.sin(t2) + 1) * 0.5;
          ctx.shadowColor =
            mix > 0.5 ? resolvedGlowColor : resolvedGlowSecondary;
          ctx.shadowBlur = blurMax * Math.min(1, glow);
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = a * opacity;
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      resize();
      regenThrottled();
    };

    window.addEventListener("resize", handleResize);
    raf = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
    };
  }, [
    gap,
    radius,
    resolvedColor,
    resolvedGlowColor,
    resolvedGlowSecondary,
    opacity,
    backgroundOpacity,
    speedMin,
    speedMax,
    speedScale,
    glowBlur,
    smoothPulse,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "absolute", inset: 0 }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
};
