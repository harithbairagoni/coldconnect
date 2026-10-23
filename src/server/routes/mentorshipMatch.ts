import firebaseConfig from "../../../firebase-applet-config.json";
import { mentorshipMatchService } from "../services/MentorshipMatchService";
import type { Connection, MentorshipMatch, UserProfile } from "../../types/models";
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

export async function handleMentorshipMatch(req: Request): Promise<Response> {
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
  const match = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/mentorship-match/);
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
          mentorshipStatus: "failed",
          error:
            "Person intelligence is not available yet. Please complete research and intelligence first.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 5. Check Cached Mentorship Match
    if (
      !forceRefresh &&
      req.method === "GET" &&
      connection.mentorshipMatch &&
      connection.mentorshipStatus === "completed"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          mentorshipStatus: "completed",
          connectionId: connection.id,
          mentorshipMatch: connection.mentorshipMatch,
          message: "Loaded existing mentorship match from database.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      !forceRefresh &&
      connection.mentorshipMatch &&
      connection.mentorshipStatus === "completed" &&
      (!customMeetingPurpose ||
        connection.mentorshipMatch.meetingPurpose === effectiveMeetingPurpose)
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          mentorshipStatus: "completed",
          connectionId: connection.id,
          mentorshipMatch: connection.mentorshipMatch,
          message: "Loaded existing mentorship match from database.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 6. Update status to 'generating'
    await updateServerFirestoreDoc(
      connectionDocPath,
      cleanFirestoreData({
        mentorshipStatus: "generating",
        mentorshipError: null,
        updatedAt: new Date().toISOString(),
      }),
      idToken,
    );

    // 7. Fetch Candidate User Profile
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
            location: "",
          } as UserProfile;
        }
      }
    } catch (profileErr) {
      console.warn("[ColdConnect] Could not fetch user profile for mentorship match:", profileErr);
    }

    // 8. Generate Mentorship Match
    const personIntel =
      connection.structuredIntelligence ||
      (connection.intelligence as unknown as Record<string, unknown>) ||
      connection.intelligenceData;

    let mentorshipMatch: MentorshipMatch;
    try {
      mentorshipMatch = await mentorshipMatchService.generateMentorshipMatch({
        candidateProfile: userProfile,
        personIntelligence: personIntel,
        meetingPurpose: effectiveMeetingPurpose,
        expertName: connection.name,
      });
    } catch (matchErr: unknown) {
      console.error("[ColdConnect] Mentorship match generation failed:", matchErr);
      const safeErrorMsg =
        matchErr instanceof Error ? matchErr.message : "Failed to calculate mentorship match.";

      await updateServerFirestoreDoc(
        connectionDocPath,
        cleanFirestoreData({
          mentorshipStatus: "failed",
          mentorshipError: safeErrorMsg,
          updatedAt: new Date().toISOString(),
        }),
        idToken,
      );

      return new Response(
        JSON.stringify({
          success: false,
          mentorshipStatus: "failed",
          error: safeErrorMsg,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // 9. Persist to Firestore
    const now = new Date().toISOString();
    const updates: Partial<Connection> = {
      meetingPurpose: effectiveMeetingPurpose,
      mentorshipMatch,
      mentorshipStatus: "completed",
      mentorshipGeneratedAt: now,
      mentorshipError: undefined,
      updatedAt: now,
    };

    await updateServerFirestoreDoc(
      connectionDocPath,
      cleanFirestoreData(updates as Record<string, unknown>),
      idToken,
    );

    console.log("[ColdConnect] Mentorship match persisted successfully");

    return new Response(
      JSON.stringify({
        success: true,
        mentorshipStatus: "completed",
        connectionId: connection.id,
        mentorshipMatch,
        message: "Candidate ↔ Expert mentorship match generated and persisted successfully.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[ColdConnect] Mentorship match route error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        mentorshipStatus: "failed",
        error: err instanceof Error ? err.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
