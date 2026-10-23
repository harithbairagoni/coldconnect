import firebaseConfig from "../../../firebase-applet-config.json";
import { personResearchService } from "../services/PersonResearchService";
import { personIntelligenceService } from "../services/PersonIntelligenceService";
import { mentorshipMatchService } from "../services/MentorshipMatchService";
import { conversationIntelligenceService } from "../services/ConversationIntelligenceService";
import type {
  Connection,
  StructuredPersonIntelligence,
  MentorshipMatch,
  ConversationStrategy,
  UserProfile,
} from "../../types/models";
import { normalizeLinkedInUrl } from "../utils/linkedinUrl";
import { getServerFirestoreDoc, updateServerFirestoreDoc } from "../utils/firestoreRest";
import { GoogleGenAI } from "@google/genai";

interface RequestBody {
  connectionId?: string;
  forceRefresh?: boolean;
}

const inFlightResearch = new Set<string>();

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

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
    console.log("[Auth Verification] Token lookup error:");
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

async function generateFastIntelligence(
  researchData: unknown,
  userProfile: unknown,
): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const candidateName = userProfile?.fullName || "A professional";

  // Provide a compact representation of research data
  const identity = researchData?.identity || researchData?.normalizedProfile?.identity || {};
  const currentRole =
    researchData?.career?.currentRole || researchData?.normalizedProfile?.currentRole || {};
  const previousRoles =
    researchData?.career?.previousRoles || researchData?.normalizedProfile?.experience || [];

  const compactData = {
    name: identity.name,
    headline: identity.headline,
    about: identity.about,
    currentRole: currentRole,
    experience: previousRoles.slice(0, 3),
  };

  const prompt = `You are an expert AI networking assistant for ColdConnect.
Your goal is to extract and generate immediate networking insights from this LinkedIn profile data so ${candidateName} can connect with them.

Return STRICTLY valid JSON matching exactly this schema:
{
  "careerSnapshot": "1-2 sentence summary of their career trajectory",
  "currentFocus": "What they are focused on right now",
  "interests": ["interest 1", "interest 2", "interest 3"],
  "entryPoint": "A strong reason to connect based on their background",
  "bestOpening": "A personalized 1-2 sentence opening message",
  "conversationHooks": ["hook 1", "hook 2", "hook 3"],
  "recommendedQuestions": ["question 1", "question 2", "question 3"]
}

Profile Data:
${JSON.stringify(compactData)}
`;

  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-flash-latest",
  ];

  let rawText = "";
  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });
      if (response.text) {
        rawText = response.text.trim();
        break;
      }
    } catch (e) {
      console.log(`[Fast Intelligence] Model ${model} failed:`);
    }
  }

  try {
    const clean = rawText.replace(/^```(?:json)?s*/i, "").replace(/s*```$/, "");
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}

async function executeAsyncResearchPipeline(
  userId: string,
  idToken: string,
  connection: Connection,
  normalizedLinkedinUrl: string,
  forceRefresh: boolean,
) {
  const lockKey = `${userId}:${connection.id}`;
  const connectionDocPath = `users/${userId}/connections/${connection.id}`;
  const researchStartedAt = new Date().toISOString();

  try {
    // 1. Mark as researching in Firestore
    await updateServerFirestoreDoc(
      connectionDocPath,
      cleanFirestoreData({
        researchStatus: "researching",
        researchStartedAt,
        intelligenceStatus: "queued",
        updatedAt: new Date().toISOString(),
      }),
      idToken,
    );

    // 2. Apify Research
    const result = await personResearchService.researchPerson({
      name: connection.name,
      linkedinUrl: normalizedLinkedinUrl,
      connectionId: connection.id,
      userId,
      forceRefresh,
    });

    const completionTimestamp = new Date().toISOString();

    if (
      !result.success ||
      (!result.structuredResearch && !result.researchData?.normalizedProfile)
    ) {
      await updateServerFirestoreDoc(
        connectionDocPath,
        cleanFirestoreData({
          researchStatus: "failed",
          researchError: result.error || "Unable to research this profile right now.",
          lastResearchUpdatedAt: completionTimestamp,
          updatedAt: completionTimestamp,
        }),
        idToken,
      );
      return;
    }

    // 3. Prepare Updates from Apify
    const structuredResearch = result.structuredResearch;
    const fieldSources = { ...(connection.fieldSources || {}) };
    const updates: Partial<Connection> = {
      linkedinURL: normalizedLinkedinUrl,
      linkedinUrl: normalizedLinkedinUrl,
      researchStatus: "completed",
      researchStartedAt,
      researchCompletedAt: completionTimestamp,
      lastResearchUpdatedAt: completionTimestamp,
      structuredResearch: result.structuredResearch,
      researchData: result.researchData,
      intelligenceStatus: "analyzing",
      updatedAt: completionTimestamp,
    };

    const discoveredCompany =
      structuredResearch?.career?.currentRole?.company ||
      result.researchData.normalizedProfile?.currentRole?.company;
    const discoveredRole =
      structuredResearch?.career?.currentRole?.title ||
      result.researchData.normalizedProfile?.currentRole?.title;

    if (!connection.company && discoveredCompany) {
      updates.company = discoveredCompany;
      fieldSources.company = "ai";
    }
    if (!connection.role && discoveredRole) {
      updates.role = discoveredRole;
      fieldSources.role = "ai";
    }
    const discoveredPhoto =
      structuredResearch?.identity?.profilePhoto ||
      result.researchData.normalizedProfile?.profilePhoto;
    if (!connection.profileImage && discoveredPhoto) {
      updates.profileImage = discoveredPhoto;
    }

    if (
      result.researchData.normalizedProfile?.experience &&
      result.researchData.normalizedProfile.experience.length > 0
    ) {
      updates.experience = result.researchData.normalizedProfile.experience.map((e: unknown) => ({
        company: e.company,
        role: e.title,
        duration: e.duration || [e.startDate, e.endDate].filter(Boolean).join(" - "),
        description: e.description,
      }));
    } else if (
      structuredResearch?.career?.previousRoles &&
      structuredResearch.career.previousRoles.length > 0
    ) {
      updates.experience = [
        ...(structuredResearch.career.currentRole.title
          ? [
              {
                company: structuredResearch.career.currentRole.company || "Current Organization",
                role: structuredResearch.career.currentRole.title,
                duration: structuredResearch.career.currentRole.duration || "Present",
                description: structuredResearch.career.currentRole.description,
              },
            ]
          : []),
        ...structuredResearch.career.previousRoles.map((r: unknown) => ({
          company: r.company,
          role: r.title,
          duration: r.duration || [r.startDate, r.endDate].filter(Boolean).join(" - "),
          description: r.description,
        })),
      ];
    }
    if (
      result.researchData.normalizedProfile?.education &&
      result.researchData.normalizedProfile.education.length > 0
    ) {
      updates.education = result.researchData.normalizedProfile.education.map((e: unknown) => ({
        school: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        year: [e.startDate, e.endDate].filter(Boolean).join(" - "),
      }));
    } else if (structuredResearch?.education && structuredResearch.education.length > 0) {
      updates.education = structuredResearch.education.map((e: unknown) => ({
        school: e.institution,
        degree: e.degree,
        fieldOfStudy: e.fieldOfStudy,
        year: [e.startDate, e.endDate].filter(Boolean).join(" - "),
      }));
    }
    if (
      result.researchData.normalizedProfile?.skills &&
      result.researchData.normalizedProfile.skills.length > 0
    ) {
      updates.skills = result.researchData.normalizedProfile.skills.map(
        (s: unknown) => s.name || s,
      );
    } else if (structuredResearch?.skills && structuredResearch.skills.length > 0) {
      updates.skills = structuredResearch.skills.map((s: unknown) => s.name || s);
    }
    updates.fieldSources = fieldSources;

    // Immediately save Phase 1 (Apify normalized data)
    await updateServerFirestoreDoc(connectionDocPath, cleanFirestoreData(updates), idToken);

    // 4. Fetch User Profile
    let userProfile: UserProfile | null = null;
    try {
      const profileDoc = await getServerFirestoreDoc(`users/${userId}/profile/main`, idToken);
      if (profileDoc) {
        userProfile = profileDoc as UserProfile;
      } else {
        const rootUser = await getServerFirestoreDoc(`users/${userId}`, idToken);
        if (rootUser) {
          userProfile = {
            fullName: (rootUser.name || rootUser.fullName || "") as string,
            email: (rootUser.email || "") as string,
            headline: (rootUser.headline || "") as string,
          } as UserProfile;
        }
      }
    } catch (e) {
      console.log("[ColdConnect] User profile fetch notice:");
    }

    // 5. TIER 1 - Fast Intelligence (Single Call)
    const fastIntel = await generateFastIntelligence(
      result.structuredResearch || result.researchData,
      userProfile,
    );
    if (fastIntel) {
      updates.careerSnapshot = fastIntel.careerSnapshot;
      updates.currentFocus = fastIntel.currentFocus;
      if (fastIntel.interests && Array.isArray(fastIntel.interests)) {
        updates.interests = fastIntel.interests;
      }
      if (fastIntel.conversationHooks && Array.isArray(fastIntel.conversationHooks)) {
        updates.conversationHooks = fastIntel.conversationHooks;
      }
      if (fastIntel.recommendedQuestions && Array.isArray(fastIntel.recommendedQuestions)) {
        updates.recommendedQuestions = fastIntel.recommendedQuestions;
      }
      updates.intelligenceStatus = "partial";

      // Save Phase 2 (Fast Intelligence)
      await updateServerFirestoreDoc(
        connectionDocPath,
        cleanFirestoreData({
          careerSnapshot: updates.careerSnapshot,
          currentFocus: updates.currentFocus,
          interests: updates.interests,
          conversationHooks: updates.conversationHooks,
          recommendedQuestions: updates.recommendedQuestions,
          intelligenceStatus: "partial",
          updatedAt: new Date().toISOString(),
        }),
        idToken,
      );
    }

    // 6. TIER 2 - Deep Intelligence (Parallel AI execution where possible)
    let structuredIntelligence: StructuredPersonIntelligence | undefined;
    try {
      // PersonIntelligenceService is independent of mentorshipMatch and conversationStrategy.
      // It provides the base "structuredIntelligence".
      structuredIntelligence = await personIntelligenceService.generatePersonIntelligence(
        result.structuredResearch || result.researchData,
      );
      updates.intelligence = structuredIntelligence;
      updates.structuredIntelligence = structuredIntelligence;
      if (!updates.careerSnapshot)
        updates.careerSnapshot = structuredIntelligence.professionalIdentity.summary;
      if (!updates.currentFocus) updates.currentFocus = structuredIntelligence.currentFocus.summary;
      if (
        !updates.interests &&
        structuredIntelligence.interests &&
        structuredIntelligence.interests.length > 0
      ) {
        updates.interests = structuredIntelligence.interests.map((i: unknown) => i.topic);
      }
    } catch (e) {
      console.log("[ColdConnect] Deep person intelligence failed:");
    }

    if (structuredIntelligence) {
      // Mentorship Match and Conversation Strategy can run partially in parallel,
      // but conversationStrategy technically takes mentorshipMatch as input right now.
      // We will run them sequentially to preserve quality, but since it's background, it doesn't block the UI.
      try {
        const mentorshipMatch = await mentorshipMatchService.generateMentorshipMatch({
          candidateProfile: userProfile,
          personIntelligence: structuredIntelligence,
          meetingPurpose: connection.meetingPurpose || "Mentorship",
          expertName: connection.name,
        });
        updates.mentorshipMatch = mentorshipMatch;
        updates.mentorshipStatus = "completed";
        updates.mentorshipGeneratedAt = new Date().toISOString();
      } catch (e) {
        console.warn("[ColdConnect] Mentorship match notice in research pipeline:", e);
        updates.mentorshipStatus = "failed";
      }

      try {
        const conversationStrategy =
          await conversationIntelligenceService.generateConversationStrategy({
            candidateProfile: userProfile,
            personIntelligence: structuredIntelligence,
            mentorshipMatch: updates.mentorshipMatch,
            meetingPurpose: connection.meetingPurpose || "Mentorship",
            expertName: connection.name,
          });
        updates.conversationStrategy = conversationStrategy;
        updates.conversationStatus = "completed";
        updates.conversationGeneratedAt = new Date().toISOString();

        // Refine with deeper generation if we already had fast ones
        if (
          conversationStrategy.conversationHooks &&
          conversationStrategy.conversationHooks.length > 0
        ) {
          updates.conversationHooks = conversationStrategy.conversationHooks.map((h: unknown) =>
            h.question ? `${h.topic ? `${h.topic}: ` : ""}${h.question}` : h.topic || "",
          );
        }
        if (
          conversationStrategy.mentorshipQuestions &&
          conversationStrategy.mentorshipQuestions.length > 0
        ) {
          updates.recommendedQuestions = conversationStrategy.mentorshipQuestions.map(
            (q: unknown) => (typeof q === "string" ? q : q.question),
          );
        } else if (
          conversationStrategy.questionLadder &&
          conversationStrategy.questionLadder.length > 0
        ) {
          updates.recommendedQuestions = conversationStrategy.questionLadder.map(
            (l: unknown) => l.question,
          );
        }
      } catch (e) {
        console.warn("[ColdConnect] Conversation strategy notice in research pipeline:", e);
        updates.conversationStatus = "failed";
      }

      updates.intelligenceStatus = "completed";
      updates.intelligenceGeneratedAt = new Date().toISOString();
    } else {
      updates.intelligenceStatus = "failed";
    }

    // Save Phase 3 (Deep Intelligence)
    await updateServerFirestoreDoc(connectionDocPath, cleanFirestoreData(updates), idToken);
  } catch (err) {
    console.error("[Background Research Pipeline Error]", err);
    // Try to save failed status if possible
    try {
      await updateServerFirestoreDoc(
        connectionDocPath,
        {
          researchStatus: "failed",
          researchError: "An unexpected error occurred during the research process.",
          updatedAt: new Date().toISOString(),
        },
        idToken,
      );
    } catch (dbErr) {
      /* ignore */
    }
  } finally {
    inFlightResearch.delete(lockKey);
  }
}

export async function handleResearchPerson(request: Request): Promise<Response> {
  console.log("[ColdConnect] Async Research API called");
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const authHeader = request.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
    let body: RequestBody = {};

    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text) as RequestBody;
      }
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON request body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = await verifyAuth(authHeader);
    if (!userId || !idToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized. Valid authentication credentials are required.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("[ColdConnect] Authenticated user verified");

    let connectionId = body.connectionId;
    try {
      const url = new URL(request.url, "http://localhost");
      const match = url.pathname.match(/^\/api\/connections\/([^/?#]+)\/research/);
      if (match && match[1]) {
        connectionId = decodeURIComponent(match[1]);
      }
    } catch {
      // ignore URL parse error
    }

    if (!connectionId || typeof connectionId !== "string" || !connectionId.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required 'connectionId' parameter.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const trimmedConnId = connectionId.trim();
    const { forceRefresh } = body;
    const lockKey = `${userId}:${trimmedConnId}`;

    if (inFlightResearch.has(lockKey)) {
      return new Response(
        JSON.stringify({
          success: true,
          researchStatus: "researching",
          connectionId: trimmedConnId,
          message: "Research is already in progress for this profile.",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    }

    const connectionDocPath = `users/${userId}/connections/${trimmedConnId}`;
    const connection = await getServerFirestoreDoc<Connection>(connectionDocPath, idToken);

    if (!connection) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Connection not found or unauthorized access.",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("[ColdConnect] Connection loaded for async pipeline");

    const rawLinkedinUrl = connection.linkedinURL || connection.linkedinUrl;
    if (!rawLinkedinUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "LinkedIn URL is required to research this person.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalizedLinkedinUrl = normalizeLinkedInUrl(rawLinkedinUrl);
    if (!normalizedLinkedinUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "LinkedIn URL is required to research this person.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (
      !forceRefresh &&
      connection.researchStatus === "completed" &&
      (connection.structuredResearch || connection.researchData?.normalizedProfile)
    ) {
      console.log("[ColdConnect] Database read completed (cached research loaded)");
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          researchStatus: "completed",
          intelligenceStatus: connection.intelligenceStatus || "completed",
          connectionId: connection.id,
          connection,
          research: connection.researchData,
          structuredResearch: connection.structuredResearch,
          intelligence: connection.intelligence || connection.structuredIntelligence,
          message: "Loaded existing research and intelligence from database.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fire off async pipeline and DO NOT wait
    inFlightResearch.add(lockKey);
    executeAsyncResearchPipeline(
      userId,
      idToken,
      connection,
      normalizedLinkedinUrl,
      Boolean(forceRefresh),
    ).catch((err) => console.error("[AsyncPipeline Unhandled Rejection]", err));

    // IMMEDIATELY RETURN to unblock the frontend
    return new Response(
      JSON.stringify({
        success: true,
        researchStatus: "researching",
        intelligenceStatus: "queued",
        connectionId: connection.id,
        message: "Background research and intelligence generation started.",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[Research API Error]:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to start research pipeline right now. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
