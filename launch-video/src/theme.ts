import { Easing, interpolate } from "remotion";

// ColdConnect brand palette (mirrors src/styles.css tokens)
export const COLORS = {
  forestDeep: "#01231a",
  forest: "#003527",
  forestLight: "#064e3b",
  mint: "#b0f0d6",
  mintSoft: "#95d3ba",
  amber: "#fed65b",
  amberDeep: "#e9c349",
  paper: "#faf9f6",
  paperDim: "#efeeeb",
  ink: "#1a1c1a",
  white: "#ffffff",
  muted: "#9fd8c4",
  red: "#ffb4ab",
};

export const FONT = {
  display: "Hanken Grotesk",
  body: "Inter",
};

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Classic smooth entrance: 0 -> 1 */
export const enter = (frame: number, start: number, duration = 24, easing = EASE_OUT) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Rise + fade-in for text/panels. */
export const riseIn = (
  frame: number,
  start: number,
  distancePx = 46,
  duration = 26,
  easing = EASE_OUT,
) => ({
  opacity: enter(frame, start, duration, easing),
  translate: `${interpolate(frame, [start, start + duration], [distancePx, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  })}px 0px`,
});

/** Pop with springy overshoot for hero words. */
export const popIn = (frame: number, start: number, overshoot = 1.06) => ({
  opacity: interpolate(frame, [start, start + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
  scale: interpolate(frame, [start, start + 16, start + 26], [0.6, overshoot, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  }),
});

/** Generic helper: a value keyframed over frames */
export const keyframe = (
  frame: number,
  range: [number, number],
  output: [number, number] | [string, string],
  easing = EASE_IN_OUT,
) =>
  interpolate(frame, range, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Deterministic pseudo-random from an index (stable across frames) */
export const seeded = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
