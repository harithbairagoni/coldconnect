/**
 * Measure the synthesized VO + music files and emit src/timings.json
 * so Remotion can lay out scenes to match the audio exactly.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile } from "music-metadata";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(readFileSync(join(ROOT, "content.json"), "utf8"));
const fps = content.meta.fps;

const scenes = [];
for (const scene of content.scenes) {
  const file = join(ROOT, "public", "vo", `${scene.id}.mp3`);
  const { format } = await parseFile(file);
  const durationMs = Math.round((format.duration || 0) * 1000);
  const voFrames = Math.ceil((durationMs / 1000) * fps);
  const frames = (scene.leadInFrames || 0) + voFrames + (scene.holdAfterFrames || 0);
  scenes.push({
    id: scene.id,
    file: `vo/${scene.id}.mp3`,
    durationMs,
    leadInFrames: scene.leadInFrames || 0,
    voFrames,
    holdAfterFrames: scene.holdAfterFrames || 0,
    frames,
  });
  console.log(`${scene.id}: vo=${(durationMs / 1000).toFixed(2)}s frames=${frames}`);
}

const musicFile = join(ROOT, "public", "music", "bgm.mp3");
const { format: musicFormat } = await parseFile(musicFile);
const musicDurationMs = Math.round((musicFormat.duration || 0) * 1000);
console.log(`music: ${(musicDurationMs / 1000).toFixed(2)}s`);

let cursor = 0;
for (const s of scenes) {
  s.startFrame = cursor;
  cursor += s.frames;
}

const timings = {
  fps,
  width: content.meta.width,
  height: content.meta.height,
  totalFrames: cursor,
  durationSeconds: +(cursor / fps).toFixed(2),
  music: {
    file: "music/bgm.mp3",
    durationMs: musicDurationMs,
    volume: content.meta.music.volume,
  },
  scenes,
};
writeFileSync(join(ROOT, "src", "timings.json"), JSON.stringify(timings, null, 2));
console.log(`\nWrote src/timings.json — total ${timings.durationSeconds}s (${cursor} frames @ ${fps}fps)`);
