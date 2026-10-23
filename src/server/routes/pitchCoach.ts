import firebaseConfig from "../../../firebase-applet-config.json";
import { pitchCoachService } from "../services/PitchCoachService";
import {
  getServerFirestoreDoc,
  createFirestoreDoc,
  listFirestoreDocs,
  updateServerFirestoreDoc,
} from "../utils/firestoreRest";
import type {
  Connection,
  UserProfile,
  Meeting,
  PitchSession,
  PitchCoachAnalysisResult,
} from "../../types/models";

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Verify Firebase Auth ID token and return authenticated uid
 */
async function verifyAuth(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  if (!token) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.users && data.users.length > 0 && data.users[0].localId) {
        return data.users[0].localId;
      }
    }
  } catch (err) {
    console.warn("[PitchCoach Auth Verification] Token lookup error:", err);
  }

  const payload = parseJwtPayload(token);
  if (payload) {
    const expectedAud = firebaseConfig.projectId;
    const expectedIss = `https://securetoken.google.com/${firebaseConfig.projectId}`;
    if (payload.aud === expectedAud && payload.iss === expectedIss) {
      return (payload.user_id || payload.sub) as string;
    }
    if (payload.user_id || payload.sub) {
      return (payload.user_id || payload.sub) as string;
    }
  }

  return null;
}

function cleanFirestoreData<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * POST /api/pitch/transcribe or /api/connections/:connectionId/pitch/transcribe
 */
export async function handlePitchTranscribe(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("Authorization");
  const authenticatedUid = await verifyAuth(authHeader);
  if (!authenticatedUid) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { audioBase64, mimeType = "audio/webm" } = body;
    if (!audioBase64) {
      return new Response(JSON.stringify({ success: false, error: "Missing audio data." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = Buffer.from(audioBase64, "base64");
    const transcript = await pitchCoachService.transcribeAudio(buffer, mimeType);

    return new Response(JSON.stringify({ success: true, transcript }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Audio transcription failed.";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * POST /api/connections/:connectionId/pitch/evaluate or /api/pitch/evaluate
 */
export async function handlePitchEvaluation(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  if (!idToken) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing authentication token." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const authenticatedUid = await verifyAuth(authHeader);
  if (!authenticatedUid) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized: Invalid authentication token." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let connectionId: string | undefined;
  const url = new URL(request.url);
  const connMatch = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/pitch/);
  if (connMatch) {
    connectionId = decodeURIComponent(connMatch[1]);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
    if (typeof body.connectionId === "string" && !connectionId) {
      connectionId = body.connectionId;
    }
  } catch {
    // Body parse failed
  }

  if (!connectionId) {
    return new Response(JSON.stringify({ success: false, error: "Connection ID is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let transcript = body.transcript ? String(body.transcript).trim() : "";
  const durationSeconds =
    typeof body.durationSeconds === "number" ? Math.max(1, Math.min(60, body.durationSeconds)) : 60;
  const meetingId = body.meetingId ? String(body.meetingId) : undefined;
  const audioBase64 = body.audioBase64 ? String(body.audioBase64) : undefined;
  const audioMimeType = body.audioMimeType || "audio/webm";

  // If audio provided without transcript, transcribe first
  if (!transcript && audioBase64) {
    try {
      const buffer = Buffer.from(audioBase64, "base64");
      transcript = await pitchCoachService.transcribeAudio(buffer, audioMimeType);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transcribe audio.";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!transcript || transcript.split(/\s+/).length < 5) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          "Your pitch was too short to analyze. Please speak or type at least a few sentences.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const connectionDocPath = `users/${authenticatedUid}/connections/${connectionId}`;

  try {
    // 1. Fetch connection doc
    const connectionDoc = await getServerFirestoreDoc(connectionDocPath, idToken);
    if (!connectionDoc) {
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found or permission denied." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const connection = {
      id: connectionId,
      ...connectionDoc,
    } as Connection;

    // 2. Fetch User Profile
    let userProfile: UserProfile | null = null;
    try {
      const profileDoc = await getServerFirestoreDoc<UserProfile>(
        `users/${authenticatedUid}/profile/main`,
        idToken,
      );
      if (profileDoc) {
        userProfile = profileDoc;
      } else {
        const topUserDoc = await getServerFirestoreDoc<UserProfile>(
          `users/${authenticatedUid}`,
          idToken,
        );
        if (topUserDoc) userProfile = topUserDoc;
      }
    } catch (err) {
      console.warn("[PitchCoach] Could not fetch full user profile:", err);
    }

    // 3. Fetch Meeting if specified
    let meeting: Meeting | null = null;
    if (meetingId) {
      try {
        const mDoc = await getServerFirestoreDoc<Meeting>(
          `users/${authenticatedUid}/meetings/${meetingId}`,
          idToken,
        );
        if (mDoc) meeting = mDoc;
      } catch (err) {
        console.warn("[PitchCoach] Could not fetch meeting context:", err);
      }
    }

    // 4. Run Gemini Pitch Coach Evaluation
    const targetPerson = connection.researchData?.normalizedProfile || null;
    const intelligenceData = connection.intelligenceData || null;
    const effectiveObjective =
      meeting?.purpose ||
      connection.meetingPurpose ||
      "Explore mutual professional opportunities, share insights, and discuss relevant domain challenges.";

    const analysis: PitchCoachAnalysisResult = await pitchCoachService.evaluatePitch({
      transcript,
      durationSeconds,
      connection,
      targetPerson,
      intelligenceData,
      userProfile,
      meeting,
      meetingPurpose: effectiveObjective,
    });

    // 5. Generate Session ID and Save Session to Firestore
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pitchSessionPayload: Record<string, unknown> = cleanFirestoreData({
      id: sessionId,
      userId: authenticatedUid,
      connectionId,
      connectionName: connection.name,
      targetPersonName: connection.name,
      meetingId: meetingId || undefined,
      meetingPurpose: effectiveObjective,
      createdAt: new Date().toISOString(),
      transcript,
      durationSeconds,
      scores: analysis.scores,
      overallScore: analysis.scores.overall,
      summary: analysis.summary,
      whatWorked: analysis.whatWorked,
      improvements: analysis.improvements,
      missedOpportunity: analysis.missedOpportunity,
      strongestElement: analysis.strongestElement,
      strongerPitch: analysis.strongerPitch,
      nextPracticeFocus: analysis.nextPracticeFocus,
      isSaved: true,
    });

    try {
      await createFirestoreDoc(
        `users/${authenticatedUid}/connections/${connectionId}/pitchSessions`,
        sessionId,
        pitchSessionPayload,
        idToken,
      );
    } catch (saveErr) {
      console.warn("[PitchCoach] Failed to save session to subcollection, continuing:", saveErr);
    }

    // 6. If associated with a meeting, mark pitchPracticed: true
    if (meeting && meetingId) {
      try {
        const currentItems = meeting.preparationItems || {};
        const newItems = { ...currentItems, pitchPracticed: true };
        const count = [
          newItems.personResearched,
          newItems.questionsPrepared,
          newItems.pitchPracticed,
          newItems.conversationPlanPrepared,
        ].filter(Boolean).length;
        const newScore = count * 25;

        await updateServerFirestoreDoc(
          `users/${authenticatedUid}/meetings/${meetingId}`,
          {
            preparationItems: newItems,
            preparationScore: newScore,
            updatedAt: new Date().toISOString(),
          },
          idToken,
        );
      } catch (mErr) {
        console.warn("[PitchCoach] Could not update meeting preparation status:", mErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        analysis,
        scores: analysis.scores,
        overallScore: analysis.scores.overall,
        strongerPitch: analysis.strongerPitch,
        whatWorked: analysis.whatWorked,
        improvements: analysis.improvements,
        missedOpportunity: analysis.missedOpportunity,
        strongestElement: analysis.strongestElement,
        nextPracticeFocus: analysis.nextPracticeFocus,
        summary: analysis.summary,
        transcript,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    console.error("[PitchCoach] Evaluation error:", err);
    const msg = err instanceof Error ? err.message : "Failed to evaluate pitch.";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * GET /api/connections/:connectionId/pitch/sessions
 */
export async function handlePitchSessionsList(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed. Use GET." }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  if (!idToken) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing authentication token." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const authenticatedUid = await verifyAuth(authHeader);
  if (!authenticatedUid) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let connectionId: string | undefined;
  const url = new URL(request.url);
  const connMatch = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/pitch/);
  if (connMatch) {
    connectionId = decodeURIComponent(connMatch[1]);
  }

  if (!connectionId) {
    return new Response(JSON.stringify({ success: false, error: "Connection ID is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const rawSessions = await listFirestoreDocs<PitchSession>(
      `users/${authenticatedUid}/connections/${connectionId}/pitchSessions`,
      idToken,
    );

    const sessions = (rawSessions || []).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );

    const scores = sessions
      .map((s) => s.scores?.overall ?? s.overallScore)
      .filter((sc): sc is number => typeof sc === "number" && !isNaN(sc));

    const sessionCount = sessions.length;
    const latestScore = scores.length > 0 ? scores[0] : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const averageScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const firstScore = scores.length > 0 ? scores[scores.length - 1] : 0;
    const improvement = sessionCount > 1 ? latestScore - firstScore : 0;

    return new Response(
      JSON.stringify({
        success: true,
        sessions,
        stats: {
          sessionCount,
          latestScore,
          bestScore,
          averageScore,
          improvement,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    console.error("[PitchCoach] List sessions error:", err);
    const msg = err instanceof Error ? err.message : "Failed to load practice history.";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
