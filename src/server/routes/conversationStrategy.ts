import firebaseConfig from "../../../firebase-applet-config.json";
import { conversationIntelligenceService } from "../services/ConversationIntelligenceService";
import { mentorshipMatchService } from "../services/MentorshipMatchService";
import type {
  Connection,
  ConversationStrategy,
  MentorshipMatch,
  UserProfile,
} from "../../types/models";
import { getServerFirestoreDoc, updateServerFirestoreDoc } from "../utils/firestoreRest";

const PROJECT_ID = firebaseConfig.projectId;

function cleanFirestoreData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      cleaned[key] = cleanFirestoreData(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function handleConversationStrategy(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 1. Authenticate Request via Bearer Token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing or invalid Authorization header. A valid Firebase ID token is required.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const idToken = authHeader.split("Bearer ")[1].trim();
  let authenticatedUid: string;

  try {
    const tokenParts = idToken.split(".");
    if (tokenParts.length !== 3) {
      throw new Error("Malformed JWT format.");
    }
    const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf-8"));
    authenticatedUid = payload.user_id || payload.sub;
    if (!authenticatedUid) {
      throw new Error("Token payload missing user_id or sub claim.");
    }
  } catch (err: unknown) {
    console.error("[ColdConnect] Token parsing failed:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Invalid or expired Firebase ID token.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. Extract connectionId & parameters
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/conversation-strategy/);
  let connectionId = match ? match[1] : null;
  let forceRefresh = false;
  let customMeetingPurpose: string | undefined;

  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.connectionId && !connectionId) {
        connectionId = body.connectionId;
      }
      if (body.forceRefresh === true) {
        forceRefresh = true;
      }
      if (typeof body.meetingPurpose === "string" && body.meetingPurpose.trim()) {
        customMeetingPurpose = body.meetingPurpose.trim();
      }
    } catch {
      // Ignored, empty body allowed
    }
  }

  if (!connectionId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Connection ID is required in the path or request body.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const connectionDocPath = `users/${authenticatedUid}/connections/${connectionId}`;

  try {
    // 3. Fetch Connection document
    const connectionDoc = await getServerFirestoreDoc(connectionDocPath, idToken);
    if (!connectionDoc) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Connection with ID "${connectionId}" not found for the authenticated user.`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const connection = {
      id: connectionId,
      ...(connectionDoc as Omit<Connection, "id">),
    };

    const effectiveMeetingPurpose =
      customMeetingPurpose || connection.meetingPurpose || "Mentorship";

    // 4. Validate Preconditions: Must have completed research and intelligence
    const hasIntelligence = Boolean(
      connection.intelligence || connection.structuredIntelligence || connection.intelligenceData,
    );

    if (connection.researchStatus !== "completed" || !hasIntelligence) {
      return new Response(
        JSON.stringify({
          success: false,
          conversationStatus: "failed",
          error:
            "Person intelligence is not available yet. Please complete research and intelligence first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. Check Cached Conversation Strategy
    if (
      !forceRefresh &&
      req.method === "GET" &&
      connection.conversationStrategy &&
      connection.conversationStatus === "completed"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          connectionId,
          conversationStatus: "completed",
          conversationStrategy: connection.conversationStrategy,
          cached: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // If POST without forceRefresh and already has strategy for the same purpose
    if (
      !forceRefresh &&
      connection.conversationStrategy &&
      connection.conversationStatus === "completed" &&
      (!customMeetingPurpose ||
        connection.conversationStrategy.meetingPurpose === customMeetingPurpose)
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          connectionId,
          conversationStatus: "completed",
          conversationStrategy: connection.conversationStrategy,
          cached: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 6. Fetch Candidate User Profile
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
      console.warn("[ColdConnect] Candidate user profile retrieval note:", profileErr);
    }

    // 7. Resolve Person Intelligence & Mentorship Match
    const personIntelligence =
      connection.structuredIntelligence ||
      connection.intelligence ||
      connection.intelligenceData ||
      {};

    let mentorshipMatch = connection.mentorshipMatch;
    if (!mentorshipMatch) {
      try {
        mentorshipMatch = await mentorshipMatchService.generateMentorshipMatch({
          candidateProfile: userProfile,
          personIntelligence,
          meetingPurpose: effectiveMeetingPurpose,
          expertName: connection.name,
        });
      } catch (mErr) {
        console.warn("[ColdConnect] Mentorship match generation fallback for strategy:", mErr);
      }
    }

    // Mark generating state
    await updateServerFirestoreDoc(
      connectionDocPath,
      {
        conversationStatus: "generating",
        updatedAt: new Date().toISOString(),
      },
      idToken,
    );

    // 8. Generate Strategy using ConversationIntelligenceService
    const conversationStrategy = await conversationIntelligenceService.generateConversationStrategy(
      {
        candidateProfile: userProfile,
        personIntelligence,
        mentorshipMatch,
        meetingPurpose: effectiveMeetingPurpose,
        expertName: connection.name,
      },
    );

    const now = new Date().toISOString();

    // 9. Persist conversationStrategy to Firestore
    const updates: Partial<Connection> & Record<string, unknown> = {
      conversationStrategy,
      conversationStatus: "completed",
      conversationGeneratedAt: now,
      conversationError: undefined,
      updatedAt: now,
    };

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

    if (customMeetingPurpose) {
      updates.meetingPurpose = customMeetingPurpose;
    }

    await updateServerFirestoreDoc(
      connectionDocPath,
      cleanFirestoreData(updates as Record<string, unknown>),
      idToken,
    );

    console.log(
      `[ColdConnect] Personalized Conversation Strategy saved for connection ${connectionId}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        connectionId,
        conversationStatus: "completed",
        conversationStrategy,
        cached: false,
        message: "Conversation strategy generated successfully.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[ColdConnect Conversation Strategy Error]:", err);
    let safeError = "Failed to generate conversation strategy.";
    if (err instanceof Error) {
      if (
        err.message.includes("503") ||
        err.message.includes("high demand") ||
        err.message.includes("UNAVAILABLE")
      ) {
        safeError =
          "AI models are experiencing temporary high demand. Please try again in a few moments.";
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
          conversationStatus: "failed",
          conversationError: safeError,
          updatedAt: new Date().toISOString(),
        }),
        idToken,
      );
    } catch (saveErr) {
      console.warn("[ColdConnect] Failed to record conversation strategy error state:", saveErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        conversationStatus: "failed",
        error: safeError,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
