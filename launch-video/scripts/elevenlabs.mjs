/**
 * ColdConnect launch video — ElevenLabs audio synthesis.
 *
 * Usage (from launch-video/):
 *   ELEVENLABS_API_KEY=sk_xxx node scripts/elevenlabs.mjs voices   # list available voices
 *   ELEVENLABS_API_KEY=sk_xxx node scripts/elevenlabs.mjs synth    # generate VO + music into public/
 *
 * Reads scene script + music direction from ../content.json.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const content = JSON.parse(readFileSync(join(ROOT, "content.json"), "utf8"));
const API = "https://api.elevenlabs.io/v1";
const KEY = process.env.ELEVENLABS_API_KEY;

if (!KEY) {
  console.error("Missing ELEVENLABS_API_KEY env var.");
  process.exit(1);
}

async function api(path, { method = "GET", body, expectJson = true } = {}) {
  const headers = { "xi-api-key": KEY, Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`ElevenLabs ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
    process.exit(1);
  }
  if (expectJson) return res.json();
  return res;
}

function saveBuffer(res, file) {
  return res.arrayBuffer().then((buf) => {
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, Buffer.from(buf));
    console.log(`  ✓ ${file} (${(buf.byteLength / 1024).toFixed(0)} KB)`);
  });
}

async function listVoices() {
  const data = await api("/voices");
  const rows = (data.voices || [])
    .map((v) => {
      const labels = v.labels || {};
      const tag = [labels.gender, labels.use_case, labels.accent, labels.age].filter(Boolean).join(", ");
      return `${v.voice_id}\t${v.name}\t${tag}`;
    })
    .sort();
  console.log("voice_id\tname\ttags");
  console.log(rows.join("\n"));
}

async function synthVoiceover(voiceId) {
  const v = content.meta.voiceover;
  const dir = join(ROOT, "public", "vo");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  for (const scene of content.scenes) {
    const file = join(dir, `${scene.id}.mp3`);
    console.log(`[vo] ${scene.id}: ${scene.vo}`);
    const voiceSettings = { stability: v.stability, similarity_boost: v.similarityBoost };
    // eleven_v3 does not expose style / speaker boost settings.
    if (!v.modelId.startsWith("eleven_v3")) {
      voiceSettings.style = v.style;
      voiceSettings.use_speaker_boost = v.useSpeakerBoost;
    }
    const res = await api(`/text-to-speech/${voiceId}?output_format=${v.outputFormat}`, {
      method: "POST",
      expectJson: false,
      body: {
        text: scene.vo,
        model_id: v.modelId,
        voice_settings: voiceSettings,
      },
    });
    await saveBuffer(res, file);
  }
}

async function synthMusic() {
  const m = content.meta.music;
  const file = join(ROOT, "public", "music", "bgm.mp3");
  console.log(`[music] "${m.prompt}"`);
  const res = await api("/sound-generation", {
    method: "POST",
    expectJson: false,
    body: { text: m.prompt, duration_seconds: m.durationSeconds },
  });
  await saveBuffer(res, file);
}

const mode = process.argv[2] || "voices";
if (mode === "voices") {
  await listVoices();
} else if (mode === "synth") {
  const voiceId = process.argv[3] || content.meta.voiceover.voiceId;
  if (!voiceId) {
    console.error("Pick a voice id first: node scripts/elevenlabs.mjs voices");
    process.exit(1);
  }
  console.log(`Using voice ${voiceId}`);
  await synthVoiceover(voiceId);
  await synthMusic();
  console.log("Done. Next: node scripts/measure.mjs");
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}
