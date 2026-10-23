import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUserConnection,
  fetchUserConnections,
  fetchUserMeeting,
  fetchConnectionPitchSessions,
  triggerPitchEvaluation,
  triggerPitchTranscribe,
} from "@/services/dataServices";
import { Connection, Meeting, PitchSession, PitchCoachAnalysisResult } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/record")({
  validateSearch: (search: Record<string, unknown>) => ({
    id:
      typeof search.id === "string"
        ? search.id
        : typeof search.connectionId === "string"
          ? search.connectionId
          : typeof search.connection_id === "string"
            ? search.connection_id
            : undefined,
    connectionId:
      typeof search.connectionId === "string"
        ? search.connectionId
        : typeof search.id === "string"
          ? search.id
          : typeof search.connection_id === "string"
            ? search.connection_id
            : undefined,
    meetingId:
      typeof search.meetingId === "string"
        ? search.meetingId
        : typeof search.meeting_id === "string"
          ? search.meeting_id
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "60-Second Pitch Coach — ColdConnect" },
      {
        name: "description",
        content: "Practice your 60-second personalized pitch and get AI coaching feedback.",
      },
      { property: "og:title", content: "60-Second Pitch Coach — ColdConnect" },
      {
        property: "og:description",
        content: "Practice your 60-second personalized pitch and get AI coaching feedback.",
      },
    ],
  }),
  component: PitchCoachPage,
});

type PitchCoachState =
  | "ready"
  | "recording"
  | "times_up"
  | "transcribing"
  | "review_transcript"
  | "typing"
  | "analyzing"
  | "results";

function PitchCoachPage() {
  const searchParams = Route.useSearch();
  const targetConnectionId = searchParams.id || searchParams.connectionId;
  const meetingId = searchParams.meetingId;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fallbackDestination = useMemo(() => {
    if (meetingId && targetConnectionId) {
      return {
        to: "/pitch-prep",
        search: { meetingId, id: targetConnectionId, connectionId: targetConnectionId },
      };
    }
    if (targetConnectionId) {
      return {
        to: "/connection-profile",
        search: { id: targetConnectionId, connectionId: targetConnectionId },
      };
    }
    return "/person";
  }, [meetingId, targetConnectionId]);

  const goBack = useAppBack(fallbackDestination);

  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [pastSessions, setPastSessions] = useState<PitchSession[]>([]);
  const [loadError, setLoadError] = useState<"not_specified" | "not_found" | null>(null);

  // Workflow State
  const [state, setState] = useState<PitchCoachState>("ready");
  const [transcript, setTranscript] = useState("");
  const [typedPitch, setTypedPitch] = useState("");
  const [currentDuration, setCurrentDuration] = useState(60);
  const [recordedDuration, setRecordedDuration] = useState(60);
  const [analysisResult, setAnalysisResult] = useState<PitchCoachAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<unknown>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 40, 60, 45, 30, 20, 10]);

  // Cleanly reset all state whenever target connection changes
  useEffect(() => {
    setState("ready");
    setTranscript("");
    setTypedPitch("");
    setCurrentDuration(60);
    setRecordedDuration(60);
    setAnalysisResult(null);
    setErrorMessage(null);
    setCopiedPitch(false);
    setIsSaved(true);
    setShowHistoryModal(false);
    setPastSessions([]);
    stopRecordingCleanup();
  }, [targetConnectionId]);

  // Load Connection, Meeting, and Practice History strictly by target connection ID
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user?.uid) return;

      console.log("[ColdConnect] Practice Pitch connection ID:", targetConnectionId);

      if (!targetConnectionId) {
        console.log("[ColdConnect] No connection ID specified for Practice Pitch");
        if (isMounted) {
          setLoadError("not_specified");
          setConnection(null);
          setPastSessions([]);
          setLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setLoading(true);
          setLoadError(null);
        }
        console.log("[ColdConnect] Loading connection:", targetConnectionId);

        const currentConn = await fetchUserConnection(user.uid, targetConnectionId);
        if (!isMounted) return;

        if (!currentConn) {
          console.warn("[ColdConnect] Connection not found:", targetConnectionId);
          setLoadError("not_found");
          setConnection(null);
          setPastSessions([]);
          return;
        }

        console.log("[ColdConnect] Loaded connection:", currentConn.id);
        console.log("[ColdConnect] Connection name:", currentConn.name);
        setConnection(currentConn);

        if (meetingId) {
          const m = await fetchUserMeeting(user.uid, meetingId);
          if (isMounted) setMeeting(m);
        } else if (isMounted) {
          setMeeting(null);
        }

        if (currentConn.id) {
          console.log("[ColdConnect] Loading pitch session for connection:", currentConn.id);
          const sessions = await fetchConnectionPitchSessions(user.uid, currentConn.id);
          if (isMounted) {
            setPastSessions(sessions);
          }
        }
      } catch (err) {
        console.error("Error loading Pitch Coach context:", err);
        if (isMounted) setLoadError("not_found");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, targetConnectionId, meetingId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  function stopRecordingCleanup() {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        (speechRecognitionRef.current as { stop: () => void }).stop();
      } catch (_err) {
        // Ignore stop error
      }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (_err) {
        // Ignore stop error
      }
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_err) {
        // Ignore close error
      }
      audioContextRef.current = null;
    }
  }

  // Calculated Practice History Stats
  const historyStats = useMemo(() => {
    if (pastSessions.length === 0) return null;
    const scores = pastSessions
      .map((s) => s.scores?.overall ?? s.overallScore)
      .filter((sc): sc is number => typeof sc === "number" && !isNaN(sc));
    if (scores.length === 0) return null;

    const latest = scores[0];
    const best = Math.max(...scores);
    const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const first = scores[scores.length - 1];
    const improvement = scores.length > 1 ? latest - first : 0;

    return {
      count: pastSessions.length,
      latest,
      best,
      average,
      first,
      improvement,
    };
  }, [pastSessions]);

  // Context Properties
  const targetPersonName = connection?.name || "your connection";
  const targetFocus =
    connection?.intelligenceData?.currentFocus?.summary ||
    connection?.currentFocus ||
    (connection?.role && connection?.company
      ? `Leading ${connection.role} initiatives at ${connection.company}`
      : "Professional leadership and industry growth");

  const meetingObjective =
    meeting?.purpose ||
    connection?.meetingPurpose ||
    "Explore mutual career and business opportunities, share industry perspectives, and build a lasting professional relationship.";

  const strategicAngle =
    connection?.intelligenceData?.yourAngle?.positioning ||
    (profile?.headline
      ? `Position your background in ${profile.headline} to create immediate relevance.`
      : "Frame your hands-on execution and problem-solving skills around their domain.");

  const conciseGoal = useMemo(() => {
    if (connection?.intelligenceData?.bestOpening?.opening) {
      return connection.intelligenceData.bestOpening.opening;
    }
    if (connection?.intelligenceData?.yourAngle?.positioning) {
      return connection.intelligenceData.yourAngle.positioning;
    }
    return `Position your core strengths and career trajectory in a way that directly aligns with ${targetPersonName}'s focus at ${connection?.company || "their company"}.`;
  }, [connection, targetPersonName]);

  // Start Pitch Recording (Microphone permission requested here ONLY)
  const handleStartRecording = async () => {
    setErrorMessage(null);
    setTranscript("");
    audioChunksRef.current = [];
    setCurrentDuration(60);

    try {
      // 1. Check if mediaDevices and getUserMedia are supported in the environment
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setErrorMessage(
          "Microphone access is not supported in this browser environment. You can type your pitch below to get instant AI coaching.",
        );
        setState("typing");
        return;
      }

      // 2. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // 3. Setup Audio Visualizer
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          analyserRef.current = analyser;

          const updateVisualizer = () => {
            if (analyserRef.current && state === "recording") {
              const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
              analyserRef.current.getByteFrequencyData(dataArray);
              const sample = Array.from(dataArray.slice(0, 8)).map((v) =>
                Math.max(10, Math.min(80, (v / 255) * 80)),
              );
              setAudioLevels(sample);
              requestAnimationFrame(updateVisualizer);
            }
          };
          requestAnimationFrame(updateVisualizer);
        }
      } catch (visErr) {
        console.warn("Audio visualizer init error:", visErr);
      }

      // 3. Setup Browser Speech Recognition Fallback for live speech
      let liveSpokenText = "";
      interface SpeechRecognitionLike {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
        onerror: ((e: Event) => void) | null;
      }
      type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
      const SpeechRecognitionClass =
        (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
          .webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i]?.[0]?.transcript) {
                fullText += event.results[i][0].transcript + " ";
              }
            }
            liveSpokenText = fullText.trim();
            setTranscript(liveSpokenText);
          };

          recognition.onerror = (e) => {
            console.warn("Speech recognition error:", e);
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (srErr) {
          console.warn("Speech recognition could not be initialized:", srErr);
        }
      }

      // 4. Setup MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/wav";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordedSeconds = 60 - currentDuration;
        setRecordedDuration(Math.max(1, recordedSeconds));
        await processFinishedAudio(liveSpokenText);
      };

      mediaRecorder.start(250);
      setState("recording");

      // 5. Start 60-second countdown timer
      let timeLeft = 60;
      timerIntervalRef.current = setInterval(() => {
        timeLeft -= 1;
        setCurrentDuration(timeLeft);

        if (timeLeft <= 0) {
          // Hard 60-Second Limit reached!
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setState("times_up");
          setTimeout(() => {
            handleFinishRecording();
          }, 800);
        }
      }, 1000);
    } catch (err: unknown) {
      console.warn("Microphone access notice:", err);
      const isPermissionDenied =
        err instanceof Error &&
        (err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.name === "SecurityError" ||
          err.message.includes("Permission denied") ||
          err.message.includes("permission") ||
          err.message.includes("denied"));

      if (isPermissionDenied) {
        setErrorMessage(
          "Microphone access was denied or is blocked by browser settings. You can switch to typing your pitch below for full AI coaching.",
        );
      } else {
        setErrorMessage(
          "Could not access microphone in this session. You can switch to typing your pitch below.",
        );
      }
    }
  };

  // Finish Recording (early stop or 60s hard limit)
  const handleFinishRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        (speechRecognitionRef.current as { stop: () => void }).stop();
      } catch (_err) {
        // Ignore stop error
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  // Restart Recording
  const handleRestartRecording = () => {
    stopRecordingCleanup();
    setState("ready");
    setTranscript("");
    setCurrentDuration(60);
    setErrorMessage(null);
  };

  // Process audio blob & transcribe
  const processFinishedAudio = async (liveSpokenText: string) => {
    setState("transcribing");
    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || "audio/webm",
      });

      // If we got good live transcript from browser SpeechRecognition, use it
      if (liveSpokenText && liveSpokenText.trim().split(/\s+/).length >= 5) {
        setTranscript(liveSpokenText.trim());
        setState("review_transcript");
        return;
      }

      // Otherwise transcribe server-side via Gemini audio transcription
      if (audioBlob.size > 1000) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(",")[1];
            if (base64Data) {
              const res = await triggerPitchTranscribe(base64Data, audioBlob.type);
              if (res.transcript && res.transcript.trim()) {
                setTranscript(res.transcript.trim());
                setState("review_transcript");
                return;
              }
            }
            // Fallback
            if (transcript) {
              setState("review_transcript");
            } else {
              setErrorMessage(
                "We couldn't confidently transcribe part of your pitch. You can edit the text or try again.",
              );
              setState("review_transcript");
            }
          } catch (transcribeErr) {
            console.warn("Server transcription error:", transcribeErr);
            if (transcript) {
              setState("review_transcript");
            } else {
              setErrorMessage(
                "We couldn't confidently transcribe your audio. Please check or type your pitch below.",
              );
              setState("review_transcript");
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      } else {
        setState("review_transcript");
      }
    } catch (err) {
      console.error("Process audio error:", err);
      setState("review_transcript");
    }
  };

  // Run Gemini Pitch Analysis
  const handleAnalyzePitch = async (pitchTextToAnalyze?: string) => {
    const text = (pitchTextToAnalyze || transcript || typedPitch).trim();
    if (!connection?.id) {
      setErrorMessage("Please select a valid connection profile first.");
      return;
    }
    if (!text || text.split(/\s+/).length < 5) {
      setErrorMessage(
        "Your pitch was too short to analyze. Speak or type at least a few sentences.",
      );
      return;
    }

    setErrorMessage(null);
    setState("analyzing");

    try {
      const res = await triggerPitchEvaluation({
        connectionId: connection.id,
        transcript: text,
        durationSeconds: recordedDuration || 60,
        meetingId: meeting?.id || meetingId,
      });

      if (!res.success || !res.analysis) {
        throw new Error(res.error || "Failed to analyze pitch.");
      }

      setAnalysisResult(res.analysis);
      setState("results");
      setIsSaved(true);

      // Refresh past sessions
      if (user?.uid && connection.id) {
        const updatedSessions = await fetchConnectionPitchSessions(user.uid, connection.id);
        setPastSessions(updatedSessions);
      }
    } catch (err: unknown) {
      console.error("Pitch analysis error:", err);
      const safeMsg = err instanceof Error ? err.message : "Failed to analyze pitch.";
      setErrorMessage(safeMsg);
      setState(typedPitch ? "typing" : "review_transcript");
    }
  };

  const handleCopyStrongerPitch = () => {
    if (!analysisResult?.strongerPitch) return;
    navigator.clipboard.writeText(analysisResult.strongerPitch);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  const handlePracticeAgain = () => {
    stopRecordingCleanup();
    setAnalysisResult(null);
    setTranscript("");
    setTypedPitch("");
    setCurrentDuration(60);
    setErrorMessage(null);
    setState("ready");
  };

  const timerRadius = 140;
  const circumference = 2 * Math.PI * timerRadius;
  const timerOffset = circumference - (currentDuration / 60) * circumference;

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 glass-panel border-b border-surface-container/30">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-4xl mx-auto">
          <button
            onClick={goBack}
            aria-label="Back"
            className="flex items-center justify-center p-2 -ml-2 text-primary hover:opacity-80 transition-opacity active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>

          <div className="text-center">
            <h1 className="font-display text-base sm:text-headline-md font-bold text-primary uppercase tracking-wider">
              60-Second Pitch Coach
            </h1>
            <p className="text-[11px] text-on-surface-variant truncate max-w-[220px] sm:max-w-xs">
              Practice how you'd introduce yourself to {targetPersonName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {pastSessions.length > 0 && (
              <button
                onClick={() => setShowHistoryModal(true)}
                className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary text-xs font-semibold flex items-center gap-1 border border-outline-variant/30"
                title="Practice History"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span className="hidden sm:inline">History ({pastSessions.length})</span>
              </button>
            )}
            <Link
              to="/profile"
              className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity ring-2 ring-transparent hover:ring-primary/20 block"
            >
              <img
                alt="User profile"
                className="w-full h-full object-cover"
                src={
                  profile?.photoURL ||
                  user?.photoURL ||
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                }
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-container-padding py-6 flex flex-col gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-label-md text-on-surface-variant">Loading pitch context...</p>
          </div>
        ) : loadError === "not_specified" ? (
          <div className="text-center py-16 bg-surface-container-lowest p-8 rounded-2xl border border-surface-variant/40 shadow-tactile max-w-md mx-auto my-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl">person_off</span>
            </div>
            <h2 className="font-headline-lg text-on-surface mb-2 font-bold">
              Connection not specified.
            </h2>
            <p className="font-body-md text-on-surface-variant mb-6 text-sm">
              Please select a connection from your network to practice your 60-second pitch.
            </p>
            <Link
              to="/person"
              className="bg-primary-container text-on-primary px-6 py-3 rounded-xl font-label-md inline-flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Return to Connections
            </Link>
          </div>
        ) : loadError === "not_found" || !connection ? (
          <div className="text-center py-16 bg-surface-container-lowest p-8 rounded-2xl border border-surface-variant/40 shadow-tactile max-w-md mx-auto my-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-error-container/20 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-3xl">error_outline</span>
            </div>
            <h2 className="font-headline-lg text-on-surface mb-2 font-bold">
              Connection not found.
            </h2>
            <p className="font-body-md text-on-surface-variant mb-6 text-sm">
              The requested connection could not be found or you do not have permission to view it.
            </p>
            <Link
              to="/person"
              className="bg-primary-container text-on-primary px-6 py-3 rounded-xl font-label-md inline-flex items-center gap-2 hover:opacity-90 transition-opacity active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Return to Connections
            </Link>
          </div>
        ) : (
          <>
            {/* COMPACT CONTEXT CARD (Never entire profile) */}
            <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-variant/40 shadow-tactile space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-surface-variant/30 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-surface-container shrink-0 flex items-center justify-center border border-surface-variant/50">
                    {connection.profileImage ? (
                      <img
                        alt={connection.name}
                        src={connection.profileImage}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-xl">person</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block">
                      Meeting With
                    </span>
                    <h2 className="font-headline-md text-sm sm:text-base font-bold text-primary truncate leading-tight">
                      {connection.name}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-medium">
                    60s Practice
                  </span>
                  {historyStats && historyStats.count > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-primary-fixed/30 text-primary font-semibold border border-primary/20">
                      Best: {historyStats.best}/100
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Current Focus */}
                <div className="p-3 bg-surface-container-low/60 rounded-xl border border-surface-variant/25 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">track_changes</span>
                    Current Focus
                  </span>
                  <p className="text-on-surface leading-snug line-clamp-2">{targetFocus}</p>
                </div>

                {/* Your Objective */}
                <div className="p-3 bg-surface-container-low/60 rounded-xl border border-surface-variant/25 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">flag</span>
                    Your Objective
                  </span>
                  <p className="text-on-surface leading-snug line-clamp-2">{meetingObjective}</p>
                </div>

                {/* Your Angle */}
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">psychology</span>
                    Your Angle
                  </span>
                  <p className="text-indigo-950 dark:text-indigo-200 leading-snug line-clamp-2 font-medium">
                    {strategicAngle}
                  </p>
                </div>
              </div>
            </section>

            {/* Error / Notice Banner if any */}
            {errorMessage && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-start gap-2.5 flex-1">
                  <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    mic_off
                  </span>
                  <div>
                    <p className="font-semibold">{errorMessage}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      You'll receive the exact same comprehensive Gemini evaluation and score.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setState("typing");
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 bg-primary-container text-white rounded-lg font-semibold text-xs hover:opacity-90 transition-opacity flex items-center gap-1 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">keyboard</span>
                    Type Pitch Instead
                  </button>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="text-on-surface-variant hover:text-on-surface text-xs font-semibold px-2 py-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 1: READY (BEFORE RECORDING) */}
            {/* ========================================================================= */}
            {state === "ready" && (
              <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col items-center text-center gap-6 animate-fade-in">
                <div className="max-w-md space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-primary-container px-3 py-1 bg-primary-container/10 rounded-full border border-primary-container/20 inline-block">
                    Your Goal
                  </span>
                  <h3 className="font-headline-lg text-lg sm:text-xl font-bold text-on-surface leading-snug">
                    "{conciseGoal}"
                  </h3>
                  <p className="text-sm text-on-surface-variant font-medium">
                    Keep it natural. Don't try to say everything.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-surface-container-low/60 rounded-2xl border border-surface-variant/30 w-full max-w-sm">
                  <span className="font-display text-4xl font-black text-primary tracking-tight">
                    60s
                  </span>
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-widest mt-1">
                    Hard Maximum Duration
                  </span>
                </div>

                <div className="flex flex-col w-full max-w-sm gap-3">
                  <button
                    onClick={handleStartRecording}
                    className="w-full bg-primary-container text-white py-3.5 px-6 rounded-xl font-label-md text-sm font-bold flex items-center justify-center gap-2 shadow-tactile hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">mic</span>
                    Start Pitch
                  </button>

                  <button
                    onClick={() => {
                      setState("typing");
                      setErrorMessage(null);
                    }}
                    className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface py-2.5 px-4 rounded-xl font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-colors active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard</span>
                    Type your pitch instead
                  </button>
                </div>

                {/* Progress Tracking Widget if prior attempts exist */}
                {historyStats && historyStats.count > 0 && (
                  <div className="w-full max-w-sm pt-4 border-t border-surface-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
                    <div>
                      <span className="block font-bold text-on-surface">
                        {historyStats.count} {historyStats.count === 1 ? "attempt" : "attempts"}{" "}
                        logged
                      </span>
                      <span>Latest: {historyStats.latest}/100</span>
                    </div>
                    {historyStats.count > 1 && (
                      <div className="text-right">
                        <span className="block font-bold text-primary">
                          {historyStats.first} → {historyStats.latest}
                        </span>
                        <span
                          className={
                            historyStats.improvement >= 0
                              ? "text-emerald-600 font-semibold"
                              : "text-rose-600 font-semibold"
                          }
                        >
                          {historyStats.improvement >= 0
                            ? `+${historyStats.improvement}`
                            : historyStats.improvement}{" "}
                          points
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 2: RECORDING (HARD 60-SECOND COUNTDOWN) */}
            {/* ========================================================================= */}
            {(state === "recording" || state === "times_up") && (
              <div className="bg-surface-container-lowest p-6 sm:p-10 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col items-center text-center gap-6 animate-fade-in relative overflow-hidden">
                <div className="text-center space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Recording Live
                  </span>
                  <h3 className="font-headline-lg text-lg sm:text-xl font-bold text-on-surface">
                    Introduce yourself to {targetPersonName.split(" ")[0]}
                  </h3>
                </div>

                {/* Large 60s Countdown Circular Ring */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center my-2">
                  <svg
                    className="absolute inset-0 w-full h-full transform -rotate-90"
                    viewBox="0 0 300 300"
                  >
                    <circle
                      cx="150"
                      cy="150"
                      fill="none"
                      r={timerRadius}
                      stroke="rgba(0, 0, 0, 0.06)"
                      className="dark:stroke-white/10"
                      strokeWidth="8"
                    />
                    <circle
                      cx="150"
                      cy="150"
                      fill="none"
                      r={timerRadius}
                      stroke={currentDuration <= 10 ? "#ef4444" : "#0d9488"}
                      strokeDasharray={circumference}
                      strokeDashoffset={timerOffset}
                      strokeLinecap="round"
                      strokeWidth="8"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>

                  <div className="flex flex-col items-center justify-center z-10">
                    {state === "times_up" ? (
                      <div className="animate-bounce">
                        <span className="font-display text-3xl sm:text-4xl font-black text-rose-600">
                          Time's up!
                        </span>
                        <span className="block text-xs text-on-surface-variant uppercase tracking-widest mt-1">
                          Processing pitch...
                        </span>
                      </div>
                    ) : (
                      <>
                        <span
                          className={`font-display text-5xl sm:text-6xl font-black tracking-tight ${
                            currentDuration <= 10 ? "text-rose-600 animate-pulse" : "text-primary"
                          }`}
                        >
                          {currentDuration}
                        </span>
                        <span className="text-xs text-on-surface-variant font-semibold uppercase tracking-widest mt-1">
                          Seconds remaining
                        </span>
                      </>
                    )}
                  </div>

                  {/* Dynamic Waveform Bars */}
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-end justify-center space-x-1.5 h-10 w-40 opacity-85">
                    {audioLevels.map((lvl, idx) => (
                      <div
                        key={idx}
                        className="w-1.5 bg-primary rounded-t-full transition-all duration-150"
                        style={{ height: `${lvl}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Live Speech Recognition Transcript preview */}
                {transcript && (
                  <div className="w-full max-w-lg p-3.5 bg-surface-container-low/80 rounded-xl border border-surface-variant/40 text-xs text-on-surface text-left italic max-h-24 overflow-y-auto">
                    "{transcript}"
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-center gap-4 w-full max-w-sm">
                  <button
                    onClick={handleRestartRecording}
                    className="flex-1 bg-surface-container-low hover:bg-surface-container text-on-surface py-3 px-4 rounded-xl font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 border border-outline-variant/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                    Restart
                  </button>

                  <button
                    onClick={handleFinishRecording}
                    className="flex-1 bg-primary-container text-white py-3 px-4 rounded-xl font-label-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-tactile hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Finish Pitch
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 3: TRANSCRIBING */}
            {/* ========================================================================= */}
            {state === "transcribing" && (
              <div className="bg-surface-container-lowest p-10 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col items-center text-center gap-4 animate-fade-in">
                <div className="w-12 h-12 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
                <h3 className="font-headline-md text-base font-bold text-on-surface">
                  Transcribing your pitch...
                </h3>
                <p className="text-xs text-on-surface-variant max-w-sm">
                  Converting your 60-second voice recording into precise transcript text for
                  coaching evaluation.
                </p>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 4: REVIEW TRANSCRIPT */}
            {/* ========================================================================= */}
            {state === "review_transcript" && (
              <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col gap-5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-surface-variant/30 pb-3">
                  <div>
                    <h3 className="font-headline-lg text-lg font-bold text-primary">Your Pitch</h3>
                    <p className="text-xs text-on-surface-variant">
                      Review your transcribed pitch before coaching analysis. You can edit any words
                      if needed.
                    </p>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-semibold shrink-0">
                    {recordedDuration}s recorded
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Transcribed pitch will appear here..."
                    className="w-full p-4 bg-surface-container-low text-on-surface text-sm rounded-xl border border-outline-variant/40 focus:border-primary outline-none resize-y leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>
                      {transcript.trim() ? transcript.trim().split(/\s+/).length : 0} words
                    </span>
                    <span>Target: 50–140 words (for 60s)</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    onClick={handleStartRecording}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                    Try Again
                  </button>

                  <button
                    onClick={() => handleAnalyzePitch(transcript)}
                    disabled={!transcript.trim() || transcript.trim().split(/\s+/).length < 5}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-tactile hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    Analyze Pitch
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 5: TYPING (TEXT FALLBACK FOR DESKTOP & ACCESSIBILITY) */}
            {/* ========================================================================= */}
            {state === "typing" && (
              <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col gap-5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-surface-variant/30 pb-3">
                  <div>
                    <h3 className="font-headline-lg text-lg font-bold text-primary">
                      Type Your 60-Second Pitch
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Practice by writing what you plan to say to {targetPersonName.split(" ")[0]}.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setState("ready");
                      setErrorMessage(null);
                    }}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Back to Voice
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
                    <span>Your Introduction Pitch:</span>
                    <span className="text-[11px] text-on-surface-variant font-normal">
                      ~60 seconds is approx. 120 words
                    </span>
                  </label>
                  <textarea
                    rows={6}
                    value={typedPitch}
                    onChange={(e) => setTypedPitch(e.target.value)}
                    placeholder={`"Hi ${targetPersonName.split(" ")[0]}, I'm ${(profile?.fullName || (profile as { name?: string })?.name || "there").split(" ")[0]}..."`}
                    className="w-full p-4 bg-surface-container-low text-on-surface text-sm rounded-xl border border-outline-variant/40 focus:border-primary outline-none resize-y leading-relaxed font-sans"
                  />
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>
                      {typedPitch.trim() ? typedPitch.trim().split(/\s+/).length : 0} words
                    </span>
                    <span>
                      Est. speaking time: ~
                      {Math.max(
                        1,
                        Math.round(
                          ((typedPitch.trim() ? typedPitch.trim().split(/\s+/).length : 0) / 125) *
                            60,
                        ),
                      )}
                      s
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleStartRecording}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                    Use Microphone Instead
                  </button>

                  <button
                    onClick={() => handleAnalyzePitch(typedPitch)}
                    disabled={!typedPitch.trim() || typedPitch.trim().split(/\s+/).length < 5}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-tactile hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    Analyze Pitch
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 6: ANALYZING (GEMINI AI COACHING) */}
            {/* ========================================================================= */}
            {state === "analyzing" && (
              <div className="bg-surface-container-lowest p-10 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col items-center text-center gap-5 animate-fade-in">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse" />
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h3 className="font-headline-md text-base font-bold text-on-surface">
                    Evaluating pitch for {targetPersonName}...
                  </h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    ColdConnect AI is evaluating relevance against {targetPersonName}’s background,
                    your positioning angle, and conversational impact.
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STATE 7: RESULTS (COMPREHENSIVE PERSONALIZED COACHING FEEDBACK) */}
            {/* ========================================================================= */}
            {state === "results" && analysisResult && (
              <div className="space-y-6 animate-fade-in">
                {/* 1. Overall Score & Summary Card */}
                <section className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-surface-variant/40 shadow-tactile flex flex-col items-center text-center gap-5">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary-fixed/30 rounded-full blur-xl" />
                    <svg
                      className="absolute inset-0 w-full h-full transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        fill="none"
                        r="44"
                        stroke="rgba(0, 0, 0, 0.08)"
                        className="dark:stroke-white/10"
                        strokeWidth="5"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        fill="none"
                        r="44"
                        stroke="#064e3b"
                        strokeDasharray={2 * Math.PI * 44}
                        strokeDashoffset={
                          2 * Math.PI * 44 -
                          ((analysisResult.scores?.overall || 75) / 100) * (2 * Math.PI * 44)
                        }
                        strokeLinecap="round"
                        strokeWidth="5"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="flex flex-col items-center z-10">
                      <span className="font-display text-4xl font-black text-primary">
                        {analysisResult.scores?.overall || 75}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        / 100
                      </span>
                    </div>
                  </div>

                  <div className="max-w-xl space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-primary-container px-3 py-0.5 bg-primary-container/10 rounded-full border border-primary-container/20 inline-block">
                      Coach Verdict
                    </span>
                    <h3 className="font-headline-md text-base sm:text-lg font-bold text-on-surface leading-snug">
                      {analysisResult.summary}
                    </h3>
                  </div>

                  {/* 6 Dimension Score Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full pt-3 border-t border-surface-variant/30">
                    {[
                      { label: "Personalization", score: analysisResult.scores?.personalization },
                      { label: "Relevance", score: analysisResult.scores?.relevance },
                      { label: "Clarity", score: analysisResult.scores?.clarity },
                      { label: "Credibility", score: analysisResult.scores?.credibility },
                      { label: "Memorability", score: analysisResult.scores?.memorability },
                      { label: "Conversational", score: analysisResult.scores?.conversational },
                    ].map((metric, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-surface-container-low rounded-xl border border-surface-variant/25 text-center flex flex-col justify-between"
                      >
                        <span className="text-[10px] text-on-surface-variant font-medium truncate block">
                          {metric.label}
                        </span>
                        <span className="font-display text-sm font-bold text-primary mt-1">
                          {metric.score ?? 80}/100
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 2. What Worked (3 Concise Points referencing actual pitch) */}
                {analysisResult.whatWorked && analysisResult.whatWorked.length > 0 && (
                  <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-variant/40 shadow-tactile space-y-3">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <span className="material-symbols-outlined text-[20px]">thumb_up</span>
                      <h4 className="font-label-md text-xs sm:text-sm font-bold uppercase tracking-wider">
                        What Worked
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {analysisResult.whatWorked.slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40 text-xs space-y-1"
                        >
                          <p className="font-bold text-emerald-950 dark:text-emerald-200">
                            {item.point}
                          </p>
                          {item.evidence && (
                            <p className="text-emerald-800/80 dark:text-emerald-300/80 italic text-[11px]">
                              "{item.evidence}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Improve This (3 High-Impact Points with Issue, Why It Matters, Specific Fix) */}
                {analysisResult.improvements && analysisResult.improvements.length > 0 && (
                  <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-variant/40 shadow-tactile space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <span className="material-symbols-outlined text-[20px]">construction</span>
                      <h4 className="font-label-md text-xs sm:text-sm font-bold uppercase tracking-wider">
                        Improve This (Highest Impact)
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {analysisResult.improvements.slice(0, 3).map((imp, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-surface-container-low rounded-xl border border-surface-variant/30 text-xs space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className="font-bold text-on-surface">{imp.issue}</p>
                              {imp.whyItMatters && (
                                <p className="text-on-surface-variant text-[11px]">
                                  <strong className="text-on-surface">Why: </strong>
                                  {imp.whyItMatters}
                                </p>
                              )}
                              {imp.fix && (
                                <div className="mt-1.5 p-2 bg-surface-container-lowest rounded-lg border border-primary/20 text-primary font-medium">
                                  <strong className="text-on-surface">Fix: </strong>
                                  {imp.fix}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Missed Opportunity & Strongest Element */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Missed Opportunity */}
                  {analysisResult.missedOpportunity && (
                    <div className="p-5 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-tactile text-xs space-y-2">
                      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                        <h4 className="font-bold uppercase tracking-wider text-[11px]">
                          Missed Opportunity
                        </h4>
                      </div>
                      <p className="font-bold text-on-surface">
                        {analysisResult.missedOpportunity.point}
                      </p>
                      {analysisResult.missedOpportunity.reason && (
                        <p className="text-on-surface-variant text-[11px]">
                          {analysisResult.missedOpportunity.reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Strongest Element */}
                  {analysisResult.strongestElement && (
                    <div className="p-5 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-tactile text-xs space-y-2">
                      <div className="flex items-center gap-1.5 text-primary">
                        <span className="material-symbols-outlined text-[18px]">stars</span>
                        <h4 className="font-bold uppercase tracking-wider text-[11px]">
                          Your Strongest Element
                        </h4>
                      </div>
                      <p className="font-bold text-on-surface">{analysisResult.strongestElement}</p>
                    </div>
                  )}
                </div>

                {/* 5. Stronger Version (Spoken, Natural Pitch) */}
                {analysisResult.strongerPitch && (
                  <section className="p-6 bg-gradient-to-br from-primary-container/10 via-surface-container-lowest to-surface-container-low rounded-2xl border-2 border-primary-container/40 shadow-tactile space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary">
                        <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                        <h4 className="font-label-md text-xs sm:text-sm font-bold uppercase tracking-wider">
                          Stronger Version (Revised Spoken Pitch)
                        </h4>
                      </div>
                      <button
                        onClick={handleCopyStrongerPitch}
                        className="px-3 py-1 bg-surface-container-lowest hover:bg-surface-container text-primary rounded-lg text-xs font-semibold flex items-center gap-1 border border-primary/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copiedPitch ? "check" : "content_copy"}
                        </span>
                        {copiedPitch ? "Copied!" : "Copy Pitch"}
                      </button>
                    </div>

                    <p className="text-on-surface text-sm sm:text-base leading-relaxed italic bg-surface-container-lowest/80 p-4 rounded-xl border border-surface-variant/30">
                      "{analysisResult.strongerPitch}"
                    </p>

                    {analysisResult.nextPracticeFocus && (
                      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                          arrow_forward
                        </span>
                        <div>
                          <strong className="text-primary block mb-0.5">
                            Next Practice Focus:
                          </strong>
                          <span className="text-on-surface">
                            {analysisResult.nextPracticeFocus}
                          </span>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* 6. Sticky CTA Bar */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    onClick={handlePracticeAgain}
                    className="w-full sm:w-auto flex-1 bg-primary-container text-white py-3.5 px-6 rounded-xl font-label-md text-sm font-bold flex items-center justify-center gap-2 shadow-tactile hover:opacity-90 active:scale-95 transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">refresh</span>
                    Practice Again
                  </button>

                  <Link
                    to="/connection-profile"
                    search={{ id: connection.id }}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to Profile
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Practice History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-lg w-full border border-surface-variant/50 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-variant pb-3 mb-4">
              <div>
                <h3 className="font-headline-md font-bold text-on-surface">Practice History</h3>
                <p className="text-xs text-on-surface-variant">Attempts for {targetPersonName}</p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {pastSessions.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-6">
                No previous attempts recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {pastSessions.map((s, idx) => {
                  const attemptNumber = pastSessions.length - idx;
                  const score = s.scores?.overall ?? s.overallScore ?? 75;
                  return (
                    <div
                      key={s.id || idx}
                      className="p-3.5 bg-surface-container-low rounded-xl border border-surface-variant/30 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-on-surface">Attempt {attemptNumber}</span>
                        <span className="font-display font-bold text-primary text-sm">
                          {score}/100
                        </span>
                      </div>
                      {s.summary && (
                        <p className="text-on-surface-variant text-[11px] line-clamp-2">
                          {s.summary}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-on-surface-variant/70 pt-1 border-t border-surface-variant/20">
                        <span>
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "Recent"}
                        </span>
                        <span>{s.durationSeconds || 60}s</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
