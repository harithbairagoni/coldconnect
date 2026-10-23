import firebaseConfig from "../../../firebase-applet-config.json";
import { personResearchService } from "../services/PersonResearchService";
import { GoogleGenAI } from "@google/genai";
import { normalizeLinkedInUrl } from "../utils/linkedinUrl";
import { getServerFirestoreDoc, updateServerFirestoreDoc } from "../utils/firestoreRest";
import type { UserProfile } from "../../types/models";

const inFlightImports = new Set<string>();

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
    console.warn("[Auth Verification] Token lookup error:", err);
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

async function generatePitchDNA(normalizedProfile: unknown) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY });
  const compactData = {
    identity: normalizedProfile?.identity,
    currentRole: normalizedProfile?.currentRole,
    experience: normalizedProfile?.experience,
    education: normalizedProfile?.education,
    skills: normalizedProfile?.skills,
    about: normalizedProfile?.about,
  };

  const prompt = `Extract a precise Pitch DNA from the following LinkedIn profile data.
This will be used as a foundational identity model to help an AI construct personalized pitches for this user when networking.

Return ONLY valid JSON matching this schema:
{
  "whoIAm": "1-2 sentence professional identity",
  "whatIDo": "Core focus/job in a short sentence",
  "whatIveBuilt": ["project/achievement 1", "project 2"],
  "strongestProofPoints": ["credible signal 1", "credible signal 2"],
  "skills": ["core skill 1", "core skill 2"],
  "industries": ["industry 1"],
  "currentFocus": "What they seem to be focused on now",
  "credibleDifferentiators": ["Why they stand out"],
  "story": "A 2-3 sentence career narrative"
}

Profile Data:
${JSON.stringify(compactData)}
`;

  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
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
      console.log(`[Fallback] Model ${model} encountered an issue, trying next...`);
    }
  }

  try {
    const clean = rawText.replace(/^```(?:json)?s*/i, "").replace(/s*```$/, "");
    return JSON.parse(clean);
  } catch (e) {
    console.warn("[Pitch DNA] Failed to parse JSON:", e);
    return null;
  }
}

async function executeAsyncProfileImport(
  userId: string,
  idToken: string,
  normalizedLinkedinUrl: string,
) {
  const lockKey = userId;
  const profileDocPath = `users/${userId}/profile/main`;
  const researchStartedAt = new Date().toISOString();

  try {
    console.log("[ColdConnect] User profile import started for:", userId);

    // 1. Mark as researching in Firestore
    await updateServerFirestoreDoc(
      profileDocPath,
      cleanFirestoreData({
        linkedinResearchStatus: "researching",
        updatedAt: new Date().toISOString(),
      }),
      idToken,
    );

    // 2. Apify Research
    console.log("[ColdConnect] Apify research started for user");
    const result = await personResearchService.researchPerson({
      name: "User", // Apify doesn't strictly need the name if URL is provided
      linkedinUrl: normalizedLinkedinUrl,
      connectionId: userId, // use userId to isolate the apify task ID
      userId,
      forceRefresh: true,
    });

    const completionTimestamp = new Date().toISOString();
    console.log("[ColdConnect] Apify research completed for user:", result.success);

    if (
      !result.success ||
      (!result.structuredResearch && !result.researchData?.normalizedProfile)
    ) {
      await updateServerFirestoreDoc(
        profileDocPath,
        cleanFirestoreData({
          linkedinResearchStatus: "failed",
          updatedAt: completionTimestamp,
        }),
        idToken,
      );
      return;
    }

    const norm = result.researchData?.normalizedProfile || result.structuredResearch;
    console.log("[ColdConnect] Profile normalized");

    // 3. Prepare Updates
    const updates: Partial<UserProfile> = {
      linkedinImported: true,
      linkedinResearchStatus: "completed",
      linkedinImportedAt: completionTimestamp,
      linkedinResearchData: result.researchData,
      linkedinURL: normalizedLinkedinUrl,
      updatedAt: completionTimestamp,
    };

    // Populate simple fields
    if (norm?.identity?.name) updates.fullName = norm.identity.name;
    if (norm?.identity?.headline) updates.headline = norm.identity.headline;
    if (norm?.identity?.profilePhoto) updates.photoURL = norm.identity.profilePhoto;
    if (norm?.identity?.location) updates.location = norm.identity.location;
    if (norm?.about) updates.about = norm.about;

    if (norm?.experience && norm.experience.length > 0) {
      updates.experience = norm.experience.map((e: unknown) => ({
        company: e.company || "",
        title: e.title || "",
        period: e.duration || [e.startDate, e.endDate].filter(Boolean).join(" - "),
        description: e.description || "",
      }));
    }

    if (norm?.education && norm.education.length > 0) {
      updates.education = norm.education.map((e: unknown) => ({
        school: e.institution || "",
        degree: e.degree || "",
        fieldOfStudy: e.fieldOfStudy || "",
        year: [e.startDate, e.endDate].filter(Boolean).join(" - "),
      }));
    }

    if (norm?.skills && norm.skills.length > 0) {
      updates.skills = norm.skills.map((s: unknown) => s.name || s);
    }

    // Calculate a simple profile completeness
    let completeness = 0;
    if (updates.fullName) completeness += 10;
    if (updates.headline) completeness += 10;
    if (updates.photoURL) completeness += 10;
    if (updates.about) completeness += 20;
    if (updates.experience && updates.experience.length > 0) completeness += 20;
    if (updates.education && updates.education.length > 0) completeness += 15;
    if (updates.skills && updates.skills.length > 0) completeness += 15;
    updates.profileCompleteness = Math.min(100, completeness);

    // Update basic profile before slow Pitch DNA generation
    await updateServerFirestoreDoc(profileDocPath, cleanFirestoreData(updates), idToken);
    console.log("[ColdConnect] User profile updated (base fields)");

    // 4. Generate Pitch DNA
    const pitchDNA = await generatePitchDNA(norm);
    if (pitchDNA) {
      updates.pitchDNA = pitchDNA;
      if (!updates.currentFocus && pitchDNA.currentFocus) {
        updates.currentFocus = pitchDNA.currentFocus;
      }
      await updateServerFirestoreDoc(
        profileDocPath,
        cleanFirestoreData({
          pitchDNA: updates.pitchDNA,
          currentFocus: updates.currentFocus,
          updatedAt: new Date().toISOString(),
        }),
        idToken,
      );
      console.log("[ColdConnect] Profile intelligence generated (Pitch DNA)");
    }

    console.log("[ColdConnect] Import completed");
  } catch (err) {
    console.error("[Background User Import Pipeline Error]", err);
    try {
      await updateServerFirestoreDoc(
        profileDocPath,
        {
          linkedinResearchStatus: "failed",
          updatedAt: new Date().toISOString(),
        },
        idToken,
      );
    } catch (dbErr) {
      /* ignore */
    }
  } finally {
    inFlightImports.delete(lockKey);
  }
}

export async function handleImportLinkedin(request: Request): Promise<Response> {
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
    let body: unknown = {};

    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text);
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

    console.log("[ColdConnect] Authenticated user verified for profile import");

    const rawLinkedinUrl = body.linkedinUrl || body.linkedinURL;
    if (!rawLinkedinUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "LinkedIn URL is required.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalizedLinkedinUrl = normalizeLinkedInUrl(rawLinkedinUrl);
    if (!normalizedLinkedinUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid LinkedIn URL.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("[ColdConnect] LinkedIn URL validated");

    const lockKey = userId;
    if (inFlightImports.has(lockKey)) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "researching",
          message: "Profile import is already in progress.",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fire off async pipeline and DO NOT wait
    inFlightImports.add(lockKey);
    executeAsyncProfileImport(userId, idToken, normalizedLinkedinUrl).catch((err) =>
      console.error("[AsyncProfileImport Unhandled Rejection]", err),
    );

    return new Response(
      JSON.stringify({
        success: true,
        status: "researching",
        message: "Background profile import started.",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[Import API Error]:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to start profile import right now. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
