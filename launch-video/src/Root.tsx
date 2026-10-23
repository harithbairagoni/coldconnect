import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { SceneByMeta, type SceneMeta } from "./Scenes";
import timings from "./timings.json";

loadHanken("normal", { weights: ["500", "600", "700", "800", "900"], subsets: ["latin"] });
loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

const scenes = timings.scenes as SceneMeta[];

const MusicBed = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const volume = timings.music.volume;
  const fadeIn = Math.min(1, frame / 36);
  const fadeOut = Math.min(1, (durationInFrames - frame) / 50);
  return (
    <Audio
      src={staticFile(timings.music.file)}
      loop
      loopVolumeCurveBehavior="extend"
      volume={Math.max(0, volume * fadeIn * fadeOut)}
    />
  );
};

const Launch = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#01231a" }}>
      <MusicBed />
      {scenes.map((meta) => (
        <Sequence key={meta.id} from={meta.startFrame} durationInFrames={meta.frames} name={meta.id}>
          <SceneByMeta meta={meta} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="LaunchVideo"
        component={Launch}
        durationInFrames={timings.totalFrames}
        fps={timings.fps}
        width={timings.width}
        height={timings.height}
      />
    </>
  );
};
