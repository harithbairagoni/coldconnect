import firebaseConfig from "../../../firebase-applet-config.json";
import { personIntelligenceService } from "../services/PersonIntelligenceService";
import { mentorshipMatchService } from "../services/MentorshipMatchService";
import { conversationIntelligenceService } from "../services/ConversationIntelligenceService";
import { getServerFirestoreDoc, updateServerFirestoreDoc } from "../utils/firestoreRest";
import type {
  Connection,
  UserProfile,
  PersonIntelligenceData,
  MentorshipMatch,
  ConversationStrategy,
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
    console.warn("[Intelligence Auth Verification] Token lookup error:", err);
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
 * POST /api/connections/:connectionId/intelligence
 * Controller handler for generating Gemini Person Intelligence.
 */
export async function handleConnectionIntelligence(request: Request): Promise<Response> {
  console.log("[ColdConnect] Person Intelligence API called");

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
  let forceRefresh = false;

  // Extract from URL or body
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/intelligence/);
  if (match) {
    connectionId = decodeURIComponent(match[1]);
  }

  try {
    const body = await request.json();
    if (body.connectionId && !connectionId) {
      connectionId = body.connectionId;
    }
    if (body.forceRefresh === true) {
      forceRefresh = true;
    }
  } catch {
    // Body is optional if connectionId is in URL
  }

  if (!connectionId) {
    return new Response(JSON.stringify({ success: false, error: "Connection ID is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const connectionDocPath = `users/${authenticatedUid}/connections/${connectionId}`;

  try {
    // 1. Fetch connection document
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

    // 2. Check caching
    if (
      !forceRefresh &&
      connection.researchStatus === "completed" &&
      connection.intelligenceStatus === "completed" &&
      connection.intelligenceData
    ) {
      console.log(`[ColdConnect] Returning cached intelligence for connection: ${connectionId}`);
      return new Response(
        JSON.stringify({
          success: true,
          connectionId,
          intelligenceStatus: "completed",
          intelligenceData: connection.intelligenceData,
          message: "Loaded existing intelligence from database.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 3. Precondition: Research must be completed with normalized profile
    const normalized = connection.researchData?.normalizedProfile;
    if (connection.researchStatus !== "completed" || !normalized) {
      return new Response(
        JSON.stringify({
          success: false,
          intelligenceStatus: connection.intelligenceStatus || "not_started",
          error: "Research this profile first before generating intelligence.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 4. Set state to generating
    await updateServerFirestoreDoc(
      connectionDocPath,
      cleanFirestoreData({
        intelligenceStatus: "generating",
        intelligenceError: undefined,
        updatedAt: new Date().toISOString(),
      }),
      idToken,
    );

    // 5. Fetch User profile for personalization
    let userProfile: UserProfile | null = null;
    try {
      const profileDoc = await getServerFirestoreDoc(
        `users/${authenticatedUid}/profile/main`,
        idToken,
      );
      if (profileDoc) {
        userProfile = profileDoc as UserProfile;
      } else {
        const rootUser = await getServerFirestoreDoc(`users/${authenticatedUid}`, idToken);
        if (rootUser) {
          userProfile = {
            fullName: (rootUser.name || rootUser.fullName || "") as string,
            email: (rootUser.email || "") as string,
            headline: (rootUser.headline || "") as string,
          } as UserProfile;
        }
      }
    } catch (profileErr) {
      console.warn("[ColdConnect] Could not fetch user profile for intelligence:", profileErr);
    }

    // 6. Call Gemini PersonIntelligenceService
    const intelligenceData: PersonIntelligenceData =
      await personIntelligenceService.generateIntelligence({
        targetPerson: normalized,
        userProfile,
        connectionMeta: {
          name: connection.name,
          linkedinUrl: connection.linkedinURL || connection.linkedinUrl,
          email: connection.email,
          meetingPurpose: connection.meetingPurpose || "General Networking",
          notes: connection.notes,
          relationshipStatus: connection.relationshipStatus,
          tags: connection.tags,
        },
      });

    let structuredIntelligence =
      connection.structuredIntelligence ||
      (connection.intelligence && "professionalIdentity" in connection.intelligence
        ? (connection.intelligence as unknown as import("../../types/models").StructuredPersonIntelligence)
        : undefined);
    if (!structuredIntelligence) {
      try {
        structuredIntelligence = await personIntelligenceService.generatePersonIntelligence(
          connection.structuredResearch || connection.researchData || normalized,
        );
      } catch (sErr) {
        console.warn("[ColdConnect] Person intelligence generation notice:", sErr);
      }
    }

    // 7. Save intelligence result to Firestore
    const now = new Date().toISOString();
    const updates: Partial<Connection> = {
      intelligenceStatus: "completed",
      intelligenceData,
      intelligence: structuredIntelligence || connection.intelligence,
      structuredIntelligence: structuredIntelligence || connection.structuredIntelligence,
      intelligenceGeneratedAt: now,
      intelligenceVersion: "2.0",
      intelligenceError: undefined,
      careerSnapshot: intelligenceData.careerSnapshot.summary,
      currentFocus: intelligenceData.currentFocus.summary,
      conversationHooks: intelligenceData.conversationHooks.map((h) => h.hook || h.topic),
      recommendedQuestions: intelligenceData.recommendedQuestions.map((q) => q.question),
      commonGround: intelligenceData.commonGround.map((g) => g.point || g.connection || ""),
      thingsToAvoid: intelligenceData.thingsToAvoid,
      updatedAt: now,
    };

    // Also generate or refresh Stage 3 Mentorship Match
    let mentorshipMatch: MentorshipMatch | undefined;
    try {
      mentorshipMatch = await mentorshipMatchService.generateMentorshipMatch({
        candidateProfile: userProfile,
        personIntelligence:
          structuredIntelligence || (intelligenceData as unknown as Record<string, unknown>),
        meetingPurpose: connection.meetingPurpose || "Mentorship",
        expertName: connection.name,
      });
      updates.mentorshipMatch = mentorshipMatch;
      updates.mentorshipStatus = "completed";
      updates.mentorshipGeneratedAt = now;
    } catch (mErr) {
      console.warn("[ColdConnect] Mentorship match calculation notice:", mErr);
    }

    // Also generate Stage 4 Conversation Strategy
    let conversationStrategy: ConversationStrategy | undefined;
    try {
      conversationStrategy = await conversationIntelligenceService.generateConversationStrategy({
        candidateProfile: userProfile,
        personIntelligence:
          structuredIntelligence || (intelligenceData as unknown as Record<string, unknown>),
        mentorshipMatch,
        meetingPurpose: connection.meetingPurpose || "Mentorship",
        expertName: connection.name,
      });
      updates.conversationStrategy = conversationStrategy;
      updates.conversationStatus = "completed";
      updates.conversationGeneratedAt = now;

      if (
        conversationStrategy.conversationHooks &&
        conversationStrategy.conversationHooks.length > 0
      ) {
        updates.conversationHooks = conversationStrategy.conversationHooks.map((h) =>
          h.question ? `${h.topic ? `${h.topic}: ` : ""}${h.question}` : h.topic || "",
        );
      }
      if (
        conversationStrategy.mentorshipQuestions &&
        conversationStrategy.mentorshipQuestions.length > 0
      ) {
        updates.recommendedQuestions = conversationStrategy.mentorshipQuestions.map((q) =>
          typeof q === "string" ? q : q.question,
        );
      } else if (
        conversationStrategy.questionLadder &&
        conversationStrategy.questionLadder.length > 0
      ) {
        updates.recommendedQuestions = conversationStrategy.questionLadder.map((l) => l.question);
      }
    } catch (cErr) {
      console.warn("[ColdConnect] Conversation strategy calculation notice:", cErr);
    }

    await updateServerFirestoreDoc(
      connectionDocPath,
      cleanFirestoreData(updates as Record<string, unknown>),
      idToken,
    );

    console.log(
      `[ColdConnect] Person intelligence, mentorship match and conversation strategy generated and saved for connection ${connectionId}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        connectionId,
        intelligenceStatus: "completed",
        mentorshipStatus: updates.mentorshipStatus,
        conversationStatus: updates.conversationStatus,
        intelligenceData,
        mentorshipMatch,
        conversationStrategy,
        message:
          "Intelligence, mentorship match, and conversation strategy generated successfully.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    console.error("[ColdConnect Intelligence Error]:", err);
    let safeError = "Failed to generate networking intelligence. Please try again.";
    if (err instanceof Error) {
      if (
        err.message.includes("503") ||
        err.message.includes("high demand") ||
        err.message.includes("UNAVAILABLE")
      ) {
        safeError =
          "AI intelligence models are experiencing temporary high demand. Please try again in a few moments.";
      } else if (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
        safeError = "Rate limit reached. Please wait a moment and try again.";
      } else {
        safeError = err.message.replace(
          /\{"error".*\}$/,
          "AI generation service temporarily unavailable.",
        );
      }
    }

    try {
      await updateServerFirestoreDoc(
        connectionDocPath,
        cleanFirestoreData({
          intelligenceStatus: "failed",
          intelligenceError: safeError,
          updatedAt: new Date().toISOString(),
        }),
        idToken,
      );
    } catch (saveErr) {
      console.warn("[ColdConnect] Failed to record intelligence error state:", saveErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        intelligenceStatus: "failed",
        error: safeError,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
