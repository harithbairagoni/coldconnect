import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, seeded } from "./theme";

const AccentGlow = ({ color, scale, x, y, opacity }: { color: string; scale: number; x: number; y: number; opacity: number }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 900,
      height: 900,
      marginLeft: -450,
      marginTop: -450,
      borderRadius: "50%",
      background: `radial-gradient(circle at center, ${color} 0%, transparent 62%)`,
      opacity,
      scale: String(scale),
      filter: "blur(30px)",
    }}
  />
);

/** Slow drifting, breathing color fields behind the action. */
export const Background = ({ accent = COLORS.mint, startOffset = 0 }: { accent?: string; startOffset?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame + startOffset) / fps;

  const drift1 = 40 + Math.sin(t * 0.16) * 60;
  const drift2 = -55 + Math.cos(t * 0.13) * 70;
  const breath = 1 + Math.sin(t * 0.5) * 0.06;
  const translate1 = `0px ${drift1.toFixed(1)}px`;
  const translate2 = `0px ${drift2.toFixed(1)}px`;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${COLORS.forestDeep} 0%, ${COLORS.forest} 46%, #06392c 100%)`,
        overflow: "hidden",
      }}
    >
      {/* dot grid for a subtle tech texture */}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(176,240,214,0.16) 1.5px, transparent 0)",
          backgroundSize: "52px 52px",
          opacity: 0.5,
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 30%, transparent 78%)",
        }}
      />
      <AbsoluteFill style={{ translate: translate1 }}>
        <AccentGlow color={accent} scale={1.15 * breath} x={1550} y={180} opacity={0.2} />
      </AbsoluteFill>
      <AbsoluteFill style={{ translate: translate2 }}>
        <AccentGlow color={COLORS.amber} scale={1.0} x={260} y={820} opacity={0.13} />
      </AbsoluteFill>
      <AccentGlow color={COLORS.mintSoft} scale={1.35} x={960} y={540} opacity={0.06} />

      <SparkleField count={26} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 120% 90% at 50% 108%, rgba(0,0,0,0.5) 0%, transparent 46%)",
        }}
      />
    </AbsoluteFill>
  );
};

const SparkleField = ({ count }: { count: number }) => {
  const frame = useCurrentFrame();
  const stars = Array.from({ length: count }, (_, i) => i);
  return (
    <AbsoluteFill>
      {stars.map((i) => {
        const x = seeded(i) * 1920;
        const y = seeded(i * 3 + 1) * 1080;
        const base = seeded(i * 5 + 2);
        const size = 3 + seeded(i * 7 + 3) * 4;
        const phase = seeded(i * 11 + 4) * Math.PI * 2;
        const twinkle = (Math.sin((frame * 0.08) + phase) + 1) / 2;
        const opacity = 0.18 + twinkle * 0.4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: base > 0.5 ? COLORS.mint : "#ffffff",
              opacity,
              scale: String(0.6 + twinkle * 0.8),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
