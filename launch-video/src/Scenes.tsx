import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import content from "../content.json";
import { Background } from "./Background";
import { COLORS, FONT, enter, keyframe, popIn, riseIn } from "./theme";

type Visual = (typeof content.scenes)[number]["visual"];
const VISUALS = Object.fromEntries(
  content.scenes.map((s) => [s.id, s.visual]),
) as Record<string, Visual>;

export type SceneMeta = {
  id: string;
  startFrame: number;
  leadInFrames: number;
  voFrames: number;
  frames: number;
};

const toHex = (c: string) => (c.startsWith("#") ? c : `#${c}`);

const display: CSSProperties = {
  fontFamily: FONT.display,
  color: "#ffffff",
  fontWeight: 800,
};
const body: CSSProperties = {
  fontFamily: FONT.body,
  color: "rgba(255,255,255,0.92)",
};

/* ------------------------------------------------------------------ */
/* Shared atoms                                                        */
/* ------------------------------------------------------------------ */

const Kicker = ({ text, color, start, delay = 0 }: { text: string; color: string; start: number; delay?: number }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...body,
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        fontSize: 34,
        fontWeight: 700,
        letterSpacing: 9,
        textTransform: "uppercase",
        color: toHex(color),
        opacity: enter(frame, start + delay, 22),
        translate: `${interpolateY(frame, start + delay)}px 0px`,
      }}
    >
      <span style={{ width: 34, height: 4, borderRadius: 4, background: toHex(color), display: "inline-block" }} />
      {text}
    </div>
  );
};

const interpolateY = (frame: number, start: number) =>
  keyframe(frame, [start, start + 22], [34, 0]);

/** Big two-line heading: white first line, brand accent second. */
const Heading = ({
  lines,
  accent,
  frameBase,
  size = 128,
  gap = 16,
  align = "center",
}: {
  lines: string[];
  accent: string;
  frameBase: number;
  size?: number;
  gap?: number;
  align?: "center" | "left";
}) => {
  const frame = useCurrentFrame();
  const accentHex = toHex(accent);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, textAlign: align, alignItems: align === "center" ? "center" : "flex-start" }}>
      {lines.map((line, i) => {
        const pop = popIn(frame, frameBase + i * 12);
        const rise = riseIn(frame, frameBase + i * 12, 60, 30);
        const isAccent = i === lines.length - 1 && lines.length > 1;
        return (
          <div
            key={line}
            style={{
              ...display,
              fontSize: isAccent ? size * 1.04 : size,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
              color: isAccent ? accentHex : "#ffffff",
              opacity: Math.min(pop.opacity, rise.opacity),
              scale: String(pop.scale),
              translate: rise.translate,
              textShadow: "0 10px 60px rgba(0,0,0,0.35)",
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};

const AvatarCircle = ({ initials, color, size = 84, ring = false }: { initials: string; color: string; size?: number; ring?: boolean }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${toHex(color)} 0%, ${COLORS.mintSoft} 130%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT.display,
      fontWeight: 800,
      fontSize: size * 0.34,
      color: COLORS.forestDeep,
      boxShadow: ring ? `0 0 0 3px rgba(255,255,255,0.25), 0 12px 30px rgba(0,0,0,0.35)` : "0 12px 30px rgba(0,0,0,0.35)",
    }}
  >
    {initials}
  </div>
);

const initialsOf = (name: string) =>
  name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/** White paper product card */
const PaperCard = ({
  children,
  width,
  pad = 44,
  radius = 44,
  shadow = true,
}: {
  children: ReactNode;
  width: number;
  pad?: number;
  radius?: number;
  shadow?: boolean;
}) => (
  <div
    style={{
      width,
      background: COLORS.paper,
      borderRadius: radius,
      padding: pad,
      color: COLORS.ink,
      boxShadow: shadow ? "0 30px 80px rgba(0,0,0,0.45), 0 4px 18px rgba(0,0,0,0.25)" : undefined,
      border: "1px solid rgba(255,255,255,0.35)",
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Scene 1 — hook: your network is full of amazing people              */
/* ------------------------------------------------------------------ */

const HookScene = ({ lead }: { lead: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.hook!;
  const accent = toHex(v.accent ?? "b0f0d6");
  const cards = v.cards ?? [];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, marginTop: -70 }}>
        <Kicker text={v.kicker!} color={accent} start={lead} delay={6} />
        <Heading lines={v.heading!} accent={accent} frameBase={lead + 12} size={126} />
        <div
          style={{
            ...body,
            fontSize: 46,
            fontWeight: 500,
            color: "#ffffff",
            opacity: enter(frame, lead + 46, 20),
            translate: `${interpolateY(frame, lead + 46)}px 0px`,
          }}
        >
          {v.sub}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 96, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 30 }}>
        {cards.map((card, i) => {
          const color = ["b0f0d6", "fed65b", "95d3ba"][i]!;
          const t = frame - (lead + 60 + i * 8);
          const o = keyframe(frame, [lead + 60 + i * 8, lead + 86 + i * 8], [0, 1]);
          const y = keyframe(frame, [lead + 60 + i * 8, lead + 88 + i * 8], [120, 0]);
          const r = keyframe(frame, [lead + 60 + i * 8, lead + 96 + i * 8], [-7, i === 1 ? 0 : 2.5]);
          const name = card!.name!;
          return (
            <div
              key={name}
              style={{
                width: 430,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                backdropFilter: "blur(10px)",
                borderRadius: 30,
                padding: "26px 30px",
                display: "flex",
                alignItems: "center",
                gap: 22,
                opacity: o,
                translate: `0px ${y}px`,
                rotate: `${r}deg`,
              }}
            >
              <AvatarCircle initials={initialsOf(name)} color={color} size={76} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ ...display, fontSize: 38, lineHeight: 1.05 }}>{name}</div>
                <div style={{ ...body, fontSize: 26, opacity: 0.85 }}>
                  {card!.role} · {card!.org}
                </div>
              </div>
              <div style={{ marginLeft: "auto", opacity: o, scale: String(Math.max(0, o)) }}>
                <span style={{ fontSize: 40, color: accent }}>✦</span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scene 2 — pain: going in cold?                                       */
/* ------------------------------------------------------------------ */

const PainScene = ({ lead }: { lead: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.pain!;
  const accent = toHex(v.accent ?? "fed65b");
  const red = "#ff8f8f";

  // Bubble: drops in, delivers its line, then fades away ("into the void")
  const bubbleIn = keyframe(frame, [lead + 16, lead + 40], [0, 1]);
  const bubbleY = keyframe(frame, [lead + 16, lead + 42], [-90, 0]);
  const bubbleGone = enter(frame, lead + 44 + 62, 14); // 1 - gone
  const vanish = 1 - bubbleGone;
  const ghosts = v.ghostChips ?? [];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 0 }}>
      <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center" }}>
        <Heading lines={v.heading!} accent={red} frameBase={lead + 8} size={170} />
      </div>

      <div style={{ position: "absolute", top: 430, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div
          style={{
            ...body,
            background: "rgba(255,255,255,0.97)",
            color: COLORS.ink,
            fontSize: 40,
            fontWeight: 600,
            padding: "34px 56px",
            borderRadius: "999px 999px 999px 16px",
            maxWidth: 1000,
            textAlign: "center",
            boxShadow: "0 26px 70px rgba(0,0,0,0.4)",
            opacity: vanish * bubbleIn,
            translate: `0px ${keyframe(frame, [lead + 44 + 62, lead + 58 + 62], [0, 60]) * vanish}px`,
            scale: String(vanish * (0.9 + 0.1 * bubbleIn)),
          }}
        >
          “{v.bubble}”
        </div>          <div style={{ display: "flex", gap: 20, marginTop: 26 }}>
            {ghosts.map((chip, i) => {
              const at = lead + 90 + i * 14;
              const o = enter(frame, at, 16);
              const y = keyframe(frame, [at, at + 18], [24, 0]);
              return (
              <div
                key={chip}
                style={{
                  ...body,
                  fontSize: 30,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.62)",
                  border: "2px dashed rgba(255,255,255,0.4)",
                  borderRadius: 999,
                  padding: "14px 30px",
                  opacity: o * 0.85,
                  translate: `0px ${y}px`,
                }}
              >
                {chip}
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 4,
            color: red,
            opacity: enter(frame, lead + 118, 20),
          }}
        >
          ouch — the void.
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scene 3 — meet ColdConnect                                           */
/* ------------------------------------------------------------------ */

const MeetScene = ({ lead }: { lead: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.meet!;
  const accent = toHex(v.accent ?? "b0f0d6");
  const chips = v.chips ?? [];

  const wmIn = keyframe(frame, [lead + 10, lead + 26], [0, 1]);
  const wmScale = keyframe(frame, [lead + 10, lead + 24, lead + 38], [0.82, 1.03, 1]);
  const swipe = keyframe(frame, [lead + 26, lead + 44], [0, 1]);

  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 170, gap: 26 }}>
        <div
          style={{
            ...body,
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: accent,
            opacity: enter(frame, lead + 4, 20),
          }}
        >
          {v.kicker}
        </div>

        <div style={{ position: "relative", opacity: wmIn, scale: String(wmScale) }}>
          <div
            style={{
              ...display,
              fontSize: 200,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontWeight: 900,
            }}
          >
            Cold<span style={{ color: accent }}>Connect</span>
          </div>
          {/* amber underline sweep */}
          <div
            style={{
              position: "absolute",
              left: "6%",
              right: "6%",
              bottom: -22,
              height: 18,
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, ${toHex("#fed65b")} 30%, ${accent} 70%, transparent)`,
              scaleX: String(swipe),
              opacity: 0.9,
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, marginTop: 90, maxWidth: 1560 }}>
          {chips.map((chip, i) => {
            const at = lead + 52 + i * 9;
            const p = popIn(frame, at);
            const y = keyframe(frame, [at, at + 24], [60, 0]);
            return (
              <div
                key={chip}
                style={{
                  ...body,
                  fontSize: 34,
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.09)",
                  border: `1.5px solid ${i % 2 === 0 ? "rgba(176,240,214,0.5)" : "rgba(254,214,91,0.5)"}`,
                  borderRadius: 999,
                  padding: "20px 38px",
                  color: "#ffffff",
                  opacity: p.opacity,
                  scale: String(p.scale),
                  translate: `0px ${y}px`,
                }}
              >
                {i % 2 === 0 ? "✦ " : "◆ "}
                {chip}
              </div>
            );
          })}
        </div>

        <div
          style={{
            ...display,
            fontSize: 52,
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            marginTop: 26,
            opacity: enter(frame, lead + 96, 18),
            translate: `${interpolateY(frame, lead + 96)}px 0px`,
          }}
        >
          {v.heading!.join(" ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Split scenes: research / practice / warm                            */
/* ------------------------------------------------------------------ */

const SplitHeading = ({ v, lead, accent, base = 0 }: { v: Visual; lead: number; accent: string; base?: number }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
    <Kicker text={v.kicker!} color={accent} start={lead} delay={base} />
    <Heading lines={v.heading!} accent={accent} frameBase={lead + 10 + base} size={108} align="left" />
  </div>
);

const ResearchScene = ({ lead }: { lead: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.research!;
  const accent = toHex(v.accent ?? "fed65b");
  const results = v.results ?? [];

  const cardPop = keyframe(frame, [lead + 22, lead + 40], [0, 1]);
  const cardY = keyframe(frame, [lead + 22, lead + 46], [120, 0]);
  const cardR = keyframe(frame, [lead + 22, lead + 52], [5, 0]);
  const query = v.query!;
  const typed = Math.floor(keyframe(frame, [lead + 34, lead + 58], [0, query.length]));
  const caretOn = Math.floor(frame / 6) % 2 === 0;
  const cursor = typed >= query.length ? 1 : 0;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 150, top: 300, width: 640 }}>
        <SplitHeading v={v} lead={lead} accent={accent} />
        <div style={{ ...body, fontSize: 40, marginTop: 34, opacity: enter(frame, lead + 30, 20), maxWidth: 560 }}>
          Deep research on every person — latest projects, posts, talks — before you reach out.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 140,
          top: 180,
          opacity: cardPop,
          translate: `0px ${cardY}px`,
          rotate: `${cardR}deg`,
        }}
      >
        <PaperCard width={880}>
          {/* search bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              background: COLORS.paperDim,
              borderRadius: 999,
              padding: "26px 34px",
              fontSize: 36,
              fontFamily: FONT.body,
              fontWeight: 600,
              color: COLORS.ink,
              border: "2px solid #d8d6d1",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.forestLight} strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <span style={{ flex: 1, whiteSpace: "pre" }}>{query}</span>
            <span style={{ marginLeft: "auto", fontSize: 24, background: accent, color: COLORS.forestDeep, padding: "8px 22px", borderRadius: 999, fontWeight: 800, flexShrink: 0 }}>Research</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 44 }}>
            {results.map((res, i) => {
              const at = lead + 68 + i * 16;
              const o = enter(frame, at, 18);
              const y = keyframe(frame, [at, at + 20], [30, 0]);
              return (
                <div
                  key={res}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    background: i === 0 ? "rgba(176,240,214,0.25)" : "transparent",
                    border: i === 0 ? `2px solid ${COLORS.mintSoft}` : "2px solid transparent",
                    borderRadius: 22,
                    padding: "22px 28px",
                    fontSize: 33,
                    fontFamily: FONT.body,
                    fontWeight: 600,
                    color: COLORS.ink,
                    opacity: o,
                    translate: `0px ${y}px`,
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: i === 0 ? COLORS.forestLight : "transparent",
                      border: i === 0 ? "none" : "2px solid #c9c5bd",
                      flexShrink: 0,
                    }}
                  />
                  {res}
                </div>
              );
            })}
          </div>
        </PaperCard>
      </div>
    </AbsoluteFill>
  );
};

const PracticeScene = ({ lead }: { lead: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.practice!;
  const accent = toHex(v.accent ?? "b0f0d6");
  const bars = v.bars ?? [];
  const target = Number(v.score ?? "8.7");
  const countUp = target * keyframe(frame, [lead + 40, lead + 92], [0, 1]);
  const score = countUp.toFixed(1);
  const barsW = [92, 81, 87];

  const cardPop = keyframe(frame, [lead + 24, lead + 42], [0, 1]);
  const cardY = keyframe(frame, [lead + 24, lead + 48], [130, 0]);
  const beat = 1 + Math.sin(frame * 0.35) * 0.03;

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 150, top: 300, width: 640 }}>
        <SplitHeading v={v} lead={lead} accent={accent} />
        <div style={{ ...body, fontSize: 40, marginTop: 34, opacity: enter(frame, lead + 30, 20) }}>
          Record your pitch. Get scored on clarity, energy and personalization — then go again.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 150,
          top: 200,
          opacity: cardPop,
          translate: `0px ${cardY}px`,
        }}
      >
        <PaperCard width={840}>
          <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
            {/* mic orb */}
            <div style={{ position: "relative", width: 220, height: 220, flexShrink: 0 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 30%, ${accent}55, ${accent} 60%, ${COLORS.forestLight})`,
                  scale: String(beat),
                  boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="84" height="84" viewBox="0 0 24 24" fill={COLORS.paper}>
                  <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Z" />
                  <path d="M18.2 11.5a6.2 6.2 0 0 1-12.4 0H3.5a8.5 8.5 0 0 0 7.4 8.4V23h2.2v-3.1a8.5 8.5 0 0 0 7.4-8.4h-2.3Z" />
                </svg>
              </div>
              <div
                style={{
                  position: "absolute",
                  inset: -14,
                  borderRadius: "50%",
                  border: `3px solid ${accent}`,
                  opacity: 0.25 + Math.sin(frame * 0.3) * 0.15,
                  scale: String(1 + Math.sin(frame * 0.3) * 0.03),
                }}
              />
            </div>

            {/* score */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 150, lineHeight: 1, color: COLORS.forest, letterSpacing: "-0.03em" }}>
                  {score}
                </span>
                <span style={{ fontFamily: FONT.body, fontSize: 44, fontWeight: 800, color: COLORS.forestLight }}>
                  /10
                </span>
              </div>
              <div style={{ fontFamily: FONT.body, fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#8a867e" }}>
                {v.scoreLabel}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 44 }}>
            {bars.map((bar, i) => {
              const name = bar!.split(" ")[0]!;
              const at = lead + 70 + i * 14;
              const o = enter(frame, at, 16);
              const w = keyframe(frame, [at + 6, at + 40], [0, barsW[i]!]);
              return (
                <div key={bar} style={{ display: "flex", flexDirection: "column", gap: 10, opacity: o }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.body, fontSize: 28, fontWeight: 700, color: COLORS.ink }}>
                    <span>{name}</span>
                    <span style={{ color: COLORS.forestLight }}>{barsW[i]!.toFixed(1)}</span>
                  </div>
                  <div style={{ height: 16, borderRadius: 999, background: COLORS.paperDim, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${w}%`,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${COLORS.mintSoft}, ${accent})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </PaperCard>
      </div>
    </AbsoluteFill>
  );
};

const WarmScene = ({ lead }: { lead: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.warm!;
  const accent = toHex(v.accent ?? "fed65b");
  const name = v.cardName!;
  const meta = v.cardMeta!;
  const beat = 1 + Math.max(0, Math.sin(frame * 0.5)) * 0.12;

  const cardPop = keyframe(frame, [lead + 22, lead + 40], [0, 1]);
  const cardY = keyframe(frame, [lead + 22, lead + 46], [130, 0]);
  const dotA = keyframe(frame, [lead + 26, lead + 46], [0, 1]);
  const dotB = keyframe(frame, [lead + 36, lead + 56], [0, 1]);

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 150, top: 300, width: 660 }}>
        <SplitHeading v={v} lead={lead} accent={accent} />
        <div style={{ ...body, fontSize: 40, marginTop: 34, opacity: enter(frame, lead + 28, 20) }}>
          ColdConnect remembers every conversation and nudges you before people forget your name.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 150,
          top: 210,
          opacity: cardPop,
          translate: `0px ${cardY}px`,
        }}
      >
        <PaperCard width={760}>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <div style={{ position: "relative" }}>
              <AvatarCircle initials={initialsOf(name)} color={accent} size={120} ring />
              <div
                style={{
                  position: "absolute",
                  right: -6,
                  bottom: -4,
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: accent,
                  color: COLORS.forestDeep,
                  fontFamily: FONT.body,
                  fontWeight: 900,
                  fontSize: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  scale: String(beat),
                  boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill={COLORS.forestDeep}>
                  <path d="M12 21s-7.5-4.9-10-9.6C.4 8 2.3 4.5 5.8 4.5c2 0 3.4 1 4.2 2.4.8-1.4 2.2-2.4 4.2-2.4 3.5 0 5.4 3.5 3.8 6.9C19.5 16.1 12 21 12 21Z" />
                </svg>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 56, color: COLORS.ink, lineHeight: 1 }}>{name}</div>
              <div
                style={{
                  alignSelf: "flex-start",
                  fontFamily: FONT.body,
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#7a6400",
                  background: "rgba(254,214,91,0.55)",
                  borderRadius: 999,
                  padding: "8px 20px",
                  marginTop: 6,
                }}
              >
                {meta}
              </div>
            </div>
          </div>

          {/* conversation thread dots */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, padding: "6px 0" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: COLORS.mintSoft, opacity: dotA }} />
            <span style={{ flex: 1, height: 5, borderRadius: 999, background: `repeating-linear-gradient(90deg, ${COLORS.mintSoft} 0 16px, transparent 16px 30px)`, opacity: 0.8 }} />
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: accent, opacity: dotB }} />
            <span style={{ flex: 1, height: 5, borderRadius: 999, background: `repeating-linear-gradient(90deg, ${accent} 0 16px, transparent 16px 30px)`, opacity: 0.5 }} />
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS.forestLight, opacity: 0.9 }} />
          </div>

          <div
            style={{
              marginTop: 36,
              background: COLORS.forest,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "24px 0",
              fontFamily: FONT.body,
              fontSize: 34,
              fontWeight: 800,
              color: "#ffffff",
              opacity: enter(frame, lead + 66, 16),
              translate: `${interpolateY(frame, lead + 66)}px 0px`,
              boxShadow: "0 14px 40px rgba(0,53,39,0.4)",
            }}
          >
            {v.cardCta}
          </div>
        </PaperCard>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Scene 7 — CTA                                                       */
/* ------------------------------------------------------------------ */

const CtaScene = ({ lead, sceneFrames }: { lead: number; sceneFrames: number }) => {
  const frame = useCurrentFrame();
  const v = VISUALS.cta!;
  const accent = toHex(v.accent ?? "b0f0d6");
  const red = "#ff8f8f";

  // Line 1 rises, red strike sweeps through, line 1 dissolves upward and line 2 pops.
  const l1In = keyframe(frame, [lead + 8, lead + 30], [0, 1]);
  const l1Y = keyframe(frame, [lead + 8, lead + 32], [80, 0]);
  const strike = keyframe(frame, [lead + 40, lead + 60], [0, 1]);
  const l1Gone = keyframe(frame, [lead + 74, lead + 92], [0, 1]);
  const l2Pop = popIn(frame, lead + 88, 1.12);
  const l2Y = keyframe(frame, [lead + 88, lead + 110], [90, 0]);
  const tagO = enter(frame, lead + 118, 20);
  const footO = enter(frame, lead + 140, 24);

  const holdFrames = Math.max(0, sceneFrames - 160);
  const pulse = 1 + Math.sin(frame * 0.12) * 0.04;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 120, textAlign: "center" }}>
        <Kicker text="COLDCONNECT" color={accent} start={lead} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginTop: -30 }}>
        <div style={{ position: "relative", height: 220 }}>
          {/* line 1 */}
          <div
            style={{
              ...display,
              fontSize: 172,
              lineHeight: 1.05,
              color: "#ffffff",
              opacity: l1In * (1 - l1Gone),
              translate: `${l1Y}px ${keyframe(frame, [lead + 74, lead + 96], [0, -70]) * l1Gone}px`,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            Stop going <span style={{ color: red, fontStyle: "italic" }}>cold</span>.
          </div>
          {/* strike through cold */}
          <div
            style={{
              position: "absolute",
              top: 150,
              left: "50%",
              width: 900,
              marginLeft: -450,
              height: 14,
              borderRadius: 999,
              background: red,
              transformOrigin: "center",
              scaleX: String(strike * (1 - l1Gone * 0)),
              opacity: strike * (1 - l1Gone),
            }}
          />
          {/* line 2 */}
          <div
            style={{
              ...display,
              fontSize: 196,
              lineHeight: 1.02,
              color: accent,
              opacity: l2Pop.opacity,
              scale: String(l2Pop.scale),
              translate: `0px ${l2Y}px`,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              textAlign: "center",
              whiteSpace: "nowrap",
              textShadow: `0 0 90px ${accent}33`,
            }}
          >
            Start connecting.
          </div>
        </div>

        <div style={{ ...body, fontSize: 46, fontWeight: 500, opacity: tagO, translate: `${interpolateY(frame, lead + 118)}px 0px` }}>
          {v.tagline}
        </div>

        {/* logo + url footer */}
        <div
          style={{
            marginTop: 40,
            opacity: footO,
            display: "flex",
            alignItems: "center",
            gap: 26,
            scale: String(pulse * footO * 0.98 + 0.02),
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1.5px solid rgba(176,240,214,0.55)",
              borderRadius: 999,
              padding: "20px 44px",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: accent, boxShadow: `0 0 24px ${accent}` }} />
            <span style={{ ...display, fontSize: 52, fontWeight: 800, color: "#ffffff" }}>
              Cold<span style={{ color: accent }}>Connect</span>
            </span>
            <span style={{ ...body, fontSize: 40, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>· {v.url}</span>
          </div>
        </div>
      </div>

      {/* soft glow pulse behind headline through the hold */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "58%",
          width: 1400,
          height: 700,
          marginLeft: -700,
          marginTop: -350,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${accent}14 0%, transparent 60%)`,
          scale: String(1 + Math.sin((frame - lead) * 0.05) * 0.05),
          opacity: holdFrames > 0 ? (keyframe(frame, [lead, lead + holdFrames], [0, 1]) > 0.5 ? 1 : 0.6) : 0.6,
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export const SceneByMeta = ({ meta }: { meta: SceneMeta }) => {
  const { id, startFrame, leadInFrames, frames } = meta;
  const accent = toHex(VISUALS[id]?.accent ?? "b0f0d6");

  let scene: ReactNode;
  switch (id) {
    case "hook":
      scene = <HookScene lead={leadInFrames} />;
      break;
    case "pain":
      scene = <PainScene lead={leadInFrames} />;
      break;
    case "meet":
      scene = <MeetScene lead={leadInFrames} />;
      break;
    case "research":
      scene = <ResearchScene lead={leadInFrames} />;
      break;
    case "practice":
      scene = <PracticeScene lead={leadInFrames} />;
      break;
    case "warm":
      scene = <WarmScene lead={leadInFrames} />;
      break;
    case "cta":
      scene = <CtaScene lead={leadInFrames} sceneFrames={frames} />;
      break;
    default:
      scene = null;
  }

  return (
    <Sequence name={id} durationInFrames={frames}>
      <Background accent={accent} startOffset={startFrame} />
      {/* audio rides in the lead-in window of each scene */}
      <Sequence from={leadInFrames} layout="none">
        <SceneAudio id={id} />
      </Sequence>
      {scene}
    </Sequence>
  );
};

import { Audio } from "@remotion/media";
import { staticFile } from "remotion";

const SceneAudio = ({ id }: { id: string }) => (
  <Audio src={staticFile(`vo/${id}.mp3`)} />
);
