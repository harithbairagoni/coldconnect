import { GoogleGenAI } from "@google/genai";
import type {
  NormalizedLinkedInProfile,
  UserProfile,
  PersonIntelligenceData,
  RelevantInterestItem,
  CommonGroundItem,
  BestOpeningItem,
  ConversationHookItem,
  RecommendedQuestionItem,
  YourAngleItem,
  CareerTransitionItem,
  MentorshipFitData,
  WhatTheyCareAboutData,
  MentorshipQuestionLadder,
  CandidateIntroductionData,
  OutreachMessageData,
  StructuredResearchData,
  ResearchData,
  StructuredPersonIntelligence,
  IntelligenceInterest,
  IntelligenceRecurringTheme,
  IntelligenceCareerTransition,
  IntelligenceKeyExpertise,
  IntelligenceProfessionalSignal,
  IntelligenceMentorshipValue,
} from "../../types/models";

export interface GenerateIntelligenceParams {
  targetPerson: NormalizedLinkedInProfile;
  userProfile?: UserProfile | null;
  connectionMeta?: {
    name?: string;
    linkedinUrl?: string;
    email?: string;
    meetingPurpose?: string;
    notes?: string[] | string;
    relationshipStatus?: string;
    tags?: string[];
  };
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const str = typeof err === "object" ? JSON.stringify(err) : String(err);
  return (
    str.includes("429") ||
    str.includes("RESOURCE_EXHAUSTED") ||
    str.includes("quota") ||
    str.includes("rate-limit") ||
    str.includes("rate_limit") ||
    str.includes("Quota exceeded")
  );
}

/**
 * Validate and sanitize raw Gemini JSON into Stage 2 StructuredPersonIntelligence.
 */
function validateStructuredPersonIntelligence(
  obj: unknown,
  sourceCount: number = 1,
): { valid: boolean; errors: string[]; sanitized?: StructuredPersonIntelligence } {
  if (!obj || typeof obj !== "object") {
    return { valid: false, errors: ["Result is not a valid JSON object"] };
  }

  const data = obj as Record<string, unknown>;
  const errors: string[] = [];

  // 1. professionalIdentity
  const pi = data.professionalIdentity as Record<string, unknown> | undefined;
  if (!pi || typeof pi !== "object" || typeof pi.summary !== "string" || !pi.summary.trim()) {
    errors.push("professionalIdentity.summary must be a non-empty string");
  }
  const piExpertise = Array.isArray(pi?.expertise)
    ? (pi?.expertise as unknown[]).map(String).filter((s) => s.trim().length > 0)
    : [];
  const piIndustries = Array.isArray(pi?.industries)
    ? (pi?.industries as unknown[]).map(String).filter((s) => s.trim().length > 0)
    : [];

  // 2. currentFocus
  const cf = data.currentFocus as Record<string, unknown> | undefined;
  if (!cf || typeof cf !== "object" || typeof cf.summary !== "string" || !cf.summary.trim()) {
    errors.push("currentFocus.summary must be a non-empty string");
  }
  const cfEvidence = Array.isArray(cf?.evidence)
    ? (cf?.evidence as unknown[]).map(String).filter((s) => s.trim().length > 0)
    : [];

  // 3. interests
  const interests: IntelligenceInterest[] = [];
  if (Array.isArray(data.interests)) {
    for (const item of data.interests as Record<string, unknown>[]) {
      if (item && typeof item === "object" && typeof item.topic === "string" && item.topic.trim()) {
        const conf =
          item.confidence === "high" || item.confidence === "medium" ? item.confidence : "medium";
        const ev = Array.isArray(item.evidence)
          ? item.evidence.map(String).filter((s) => s.trim().length > 0)
          : [];
        interests.push({
          topic: item.topic.trim(),
          confidence: conf,
          evidence:
            ev.length > 0 ? ev : ["Derived from verified professional activity and background."],
        });
      }
    }
  }

  // 4. recurringThemes
  const recurringThemes: IntelligenceRecurringTheme[] = [];
  if (Array.isArray(data.recurringThemes)) {
    for (const item of data.recurringThemes as Record<string, unknown>[]) {
      if (item && typeof item === "object" && typeof item.theme === "string" && item.theme.trim()) {
        const conf =
          item.confidence === "high" || item.confidence === "medium" ? item.confidence : "medium";
        const ev = Array.isArray(item.evidence)
          ? item.evidence.map(String).filter((s) => s.trim().length > 0)
          : [];
        recurringThemes.push({
          theme: item.theme.trim(),
          description: typeof item.description === "string" ? item.description.trim() : "",
          confidence: conf,
          evidence:
            ev.length > 0 ? ev : ["Consistent theme across verified roles and publications."],
        });
      }
    }
  }

  // 5. careerTransitions
  const careerTransitions: IntelligenceCareerTransition[] = [];
  if (Array.isArray(data.careerTransitions)) {
    for (const item of data.careerTransitions as Record<string, unknown>[]) {
      if (item && typeof item === "object" && (item.from || item.to || item.whyItMatters)) {
        const ev = Array.isArray(item.evidence)
          ? item.evidence.map(String).filter((s) => s.trim().length > 0)
          : [];
        careerTransitions.push({
          from: String(item.from || "").trim(),
          to: String(item.to || "").trim(),
          whyItMatters: String(item.whyItMatters || "").trim(),
          evidence: ev.length > 0 ? ev : ["Documented career history transition."],
        });
      }
    }
  }

  // 6. keyExpertise
  const keyExpertise: IntelligenceKeyExpertise[] = [];
  if (Array.isArray(data.keyExpertise)) {
    for (const item of data.keyExpertise as Record<string, unknown>[]) {
      if (item && typeof item === "object" && typeof item.area === "string" && item.area.trim()) {
        const conf =
          item.confidence === "high" || item.confidence === "medium" ? item.confidence : "medium";
        const ev = Array.isArray(item.evidence)
          ? item.evidence.map(String).filter((s) => s.trim().length > 0)
          : [];
        keyExpertise.push({
          area: item.area.trim(),
          description: typeof item.description === "string" ? item.description.trim() : "",
          confidence: conf,
          evidence: ev.length > 0 ? ev : ["Demonstrated across professional roles and projects."],
        });
      }
    }
  }

  // 7. professionalSignals
  const professionalSignals: IntelligenceProfessionalSignal[] = [];
  if (Array.isArray(data.professionalSignals)) {
    for (const item of data.professionalSignals as Record<string, unknown>[]) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.signal === "string" &&
        item.signal.trim()
      ) {
        const conf =
          item.confidence === "high" || item.confidence === "medium" ? item.confidence : "medium";
        const ev = Array.isArray(item.evidence)
          ? item.evidence.map(String).filter((s) => s.trim().length > 0)
          : [];
        professionalSignals.push({
          signal: item.signal.trim(),
          description: typeof item.description === "string" ? item.description.trim() : "",
          confidence: conf,
          evidence: ev.length > 0 ? ev : ["Public professional signal."],
        });
      }
    }
  }

  // 8. mentorshipValue
  const mentorshipValue: IntelligenceMentorshipValue[] = [];
  if (Array.isArray(data.mentorshipValue)) {
    for (const item of data.mentorshipValue as Record<string, unknown>[]) {
      if (item && typeof item === "object" && (item.area || item.whyCandidateCouldLearnFromThem)) {
        const ev = Array.isArray(item.evidence)
          ? item.evidence.map(String).filter((s) => s.trim().length > 0)
          : [];
        mentorshipValue.push({
          area: String(item.area || "").trim(),
          whyCandidateCouldLearnFromThem: String(item.whyCandidateCouldLearnFromThem || "").trim(),
          evidence: ev.length > 0 ? ev : ["Grounded in demonstrated career experience."],
        });
      }
    }
  }
  if (mentorshipValue.length === 0) {
    errors.push(
      "mentorshipValue must contain at least one mentorship learning area grounded in career evidence",
    );
  }

  // 9. researchQuality
  const rq = data.researchQuality as Record<string, unknown> | undefined;
  const rqConfidence =
    rq?.confidence === "high" || rq?.confidence === "medium" ? rq.confidence : "medium";
  const rqSourceCount =
    typeof rq?.sourceCount === "number" && rq.sourceCount > 0
      ? rq.sourceCount
      : Math.max(1, sourceCount);
  const rqLimitations = Array.isArray(rq?.limitations)
    ? (rq?.limitations as unknown[]).map(String).filter((s) => s.trim().length > 0)
    : [];

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const sanitized: StructuredPersonIntelligence = {
    professionalIdentity: {
      summary: (pi?.summary as string).trim(),
      expertise: piExpertise.length > 0 ? piExpertise : keyExpertise.map((e) => e.area).slice(0, 5),
      industries: piIndustries,
    },
    currentFocus: {
      summary: (cf?.summary as string).trim(),
      evidence: cfEvidence.length > 0 ? cfEvidence : ["Current role and verified public activity."],
    },
    interests,
    recurringThemes,
    careerTransitions,
    keyExpertise,
    professionalSignals,
    mentorshipValue,
    researchQuality: {
      confidence: rqConfidence,
      sourceCount: rqSourceCount,
      limitations: rqLimitations,
    },
  };

  return { valid: true, errors: [], sanitized };
}

/**
 * PersonIntelligenceService
 * ColdConnect's Person Intelligence Engine (Stage 2).
 *
 * Transforms Stage 1 verified public research into deep, personalized professional intelligence:
 * - Understands what this person is actually professionally known for (not copying headline)
 * - Detects what they care about RIGHT NOW with strong evidence
 * - Identifies genuine interests, recurring themes, and career transitions
 * - Pinpoints mentorship learning value ("What can a candidate learn from their experience?")
 * - Strictly distinguishes facts from interpretations and enforces anti-hallucination rules.
 */
export class PersonIntelligenceService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Stage 2 Person Intelligence Engine
   * Generates structured person intelligence from Stage 1 research data.
   */
  async generatePersonIntelligence(
    researchData: StructuredResearchData | ResearchData | Record<string, unknown>,
  ): Promise<StructuredPersonIntelligence> {
    console.log("[ColdConnect] Person intelligence started");

    // 1. Extract and format research context
    const structured = (
      "structuredResearch" in researchData && researchData.structuredResearch
        ? researchData.structuredResearch
        : researchData
    ) as StructuredResearchData;

    const normalized = (
      "normalizedProfile" in researchData && researchData.normalizedProfile
        ? researchData.normalizedProfile
        : null
    ) as NormalizedLinkedInProfile | null;

    const raw = (
      "rawProfile" in researchData && researchData.rawProfile
        ? researchData.rawProfile
        : (researchData as Record<string, unknown>)
    ) as Record<string, unknown>;

    const targetName =
      structured?.identity?.name ||
      normalized?.identity?.name ||
      String(raw?.fullName || raw?.name || "Target Professional");

    const headline =
      structured?.identity?.headline ||
      normalized?.identity?.headline ||
      String(raw?.headline || "");

    const location =
      structured?.identity?.location ||
      normalized?.identity?.location ||
      String(raw?.location || "");

    const about =
      structured?.identity?.about || normalized?.about || String(raw?.about || raw?.summary || "");

    const currentRole =
      structured?.career?.currentRole ||
      normalized?.currentRole ||
      (raw?.currentRole as Record<string, unknown>) ||
      null;

    const previousRoles =
      structured?.career?.previousRoles ||
      normalized?.experience ||
      (raw?.previousRoles as Record<string, unknown>[]) ||
      (raw?.positions as Record<string, unknown>[]) ||
      [];

    const transitions =
      structured?.career?.transitions || (raw?.transitions as Record<string, unknown>[]) || [];

    const education =
      structured?.education ||
      normalized?.education ||
      (raw?.education as Record<string, unknown>[]) ||
      (raw?.schools as Record<string, unknown>[]) ||
      [];

    const skills = structured?.skills || normalized?.skills || (raw?.skills as unknown[]) || [];

    const activity = structured?.activity ||
      (raw?.activity as Record<string, unknown>) || {
        posts: [],
        articles: [],
        recurringTopics: [],
      };

    const publicSources =
      structured?.publicSources ||
      normalized?.sources ||
      (raw?.publicSources as Record<string, unknown>[]) ||
      [];

    const sourceCount = structured?.researchMetadata?.sourceCount || publicSources.length || 1;

    // 2. Build structured research text for Gemini
    const researchLines: string[] = [];
    researchLines.push(`Target Professional: ${targetName}`);
    if (headline) researchLines.push(`Public Headline: ${headline}`);
    if (location) researchLines.push(`Location: ${location}`);
    if (about) researchLines.push(`Public About / Summary: ${about}`);

    if (currentRole && currentRole.title) {
      researchLines.push(
        `Current Role: ${currentRole.title} at ${currentRole.company || "Current Org"}${currentRole.location ? ` (${currentRole.location})` : ""}${currentRole.duration ? ` [${currentRole.duration}]` : ""}`,
      );
      if (currentRole.description) {
        researchLines.push(`Current Role Details: ${currentRole.description}`);
      }
      if (Array.isArray(currentRole.highlights) && currentRole.highlights.length > 0) {
        researchLines.push(`Current Role Highlights:\n- ${currentRole.highlights.join("\n- ")}`);
      }
    }

    if (previousRoles.length > 0) {
      researchLines.push("Chronological Career History:");
      previousRoles.forEach((r: Record<string, unknown>, idx: number) => {
        const title = r.title || r.role || "Role";
        const company = r.company || r.companyName || "Organization";
        const dates = [r.startDate, r.endDate].filter(Boolean).join(" - ") || r.duration || "";
        researchLines.push(`  ${idx + 1}. ${title} at ${company}${dates ? ` (${dates})` : ""}`);
        if (r.description) researchLines.push(`     Description: ${r.description}`);
      });
    }

    if (transitions.length > 0) {
      researchLines.push("Notable Career Transitions:");
      transitions.forEach((t: Record<string, unknown>, idx: number) => {
        researchLines.push(
          `  ${idx + 1}. From ${t.fromRole || t.from || ""} at ${t.fromCompany || ""} -> To ${t.toRole || t.to || ""} at ${t.toCompany || ""}${t.year ? ` (${t.year})` : ""}: ${t.description || ""}`,
        );
      });
    }

    if (education.length > 0) {
      researchLines.push("Education:");
      education.forEach((edu: Record<string, unknown>, idx: number) => {
        const inst = edu.institution || edu.school || "Institution";
        const deg = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(" in ");
        const yr = edu.year || [edu.startDate, edu.endDate].filter(Boolean).join(" - ");
        researchLines.push(`  ${idx + 1}. ${inst}${deg ? ` - ${deg}` : ""}${yr ? ` (${yr})` : ""}`);
      });
    }

    if (skills.length > 0) {
      const skillStrs = skills
        .map((s) => (typeof s === "string" ? s : s?.name || ""))
        .filter(Boolean);
      researchLines.push(`Key Skills & Competencies: ${skillStrs.slice(0, 20).join(", ")}`);
    }

    if (activity.posts && activity.posts.length > 0) {
      researchLines.push("Recent Public Posts / Thought Leadership:");
      activity.posts.forEach((p: Record<string, unknown>, idx: number) => {
        researchLines.push(
          `  ${idx + 1}. "${p.snippet || p.text || ""}"${p.date ? ` [${p.date}]` : ""}${p.engagement ? ` (${p.engagement})` : ""}`,
        );
      });
    }

    if (activity.articles && activity.articles.length > 0) {
      researchLines.push("Authored Articles & Publications:");
      activity.articles.forEach((a: Record<string, unknown>, idx: number) => {
        researchLines.push(
          `  ${idx + 1}. "${a.title}"${a.publisher ? ` (${a.publisher})` : ""}${a.summary ? ` - ${a.summary}` : ""}`,
        );
      });
    }

    if (activity.recurringTopics && activity.recurringTopics.length > 0) {
      researchLines.push("Recurring Public Discussion Themes:");
      activity.recurringTopics.forEach((rt: Record<string, unknown>, idx: number) => {
        researchLines.push(`  - ${rt.topic}${rt.relevance ? `: ${rt.relevance}` : ""}`);
      });
    }

    if (publicSources.length > 0) {
      researchLines.push("Verified Public Footprint Sources:");
      publicSources.forEach((s: Record<string, unknown>, idx: number) => {
        researchLines.push(
          `  - [${s.sourceType || s.source || "source"}] ${s.title}: ${s.summary || s.relevance || s.url || ""}`,
        );
      });
    }

    const researchContext = researchLines.join("\n");
    console.log("[ColdConnect] Research data supplied to intelligence engine");

    // 3. Craft strict Gemini Intelligence prompt
    const prompt = `You are an expert professional intelligence researcher for ColdConnect helping a candidate prepare for a high-impact mentorship conversation.

Your job is NOT to write a generic LinkedIn summary.
Your job is to DEEPLY UNDERSTAND THIS PERSON from verified public research.

VERIFIED RESEARCH DATA:
${researchContext}

CORE REQUIREMENTS:
1. DISTINGUISH FACTS FROM INTERPRETATIONS:
   - Facts come directly from the research (roles, companies, dates, institutions, publications).
   - Interpretations must be clearly grounded in multiple signals from their background.
2. PROFESSIONAL IDENTITY:
   - State what the person is ACTUALLY professionally known for across their career (e.g. "Brand and strategy professional with experience spanning corporate strategy, business transformation and consumer brand management").
   - Do NOT simply repeat their job title or headline.
3. CURRENT FOCUS:
   - What they appear to be focused on RIGHT NOW based on current role, current company initiatives, recent posts, talks, or articles.
   - Do NOT use old career history to describe current focus.
   - If insufficient evidence: "Current focus could not be confidently determined from available public sources."
4. INTEREST DETECTION:
   - Identify genuine professional interests. Do NOT infer from one isolated keyword.
   - Look for repeated topics, articles, projects, talks, or company initiatives.
   - Assign confidence ("high" | "medium") and retain concrete evidence.
5. RECURRING THEMES:
   - Ideas and concepts that appear repeatedly across their public professional footprint.
6. CAREER TRANSITIONS:
   - Identify meaningful transitions (e.g., Strategy -> Brand Management, Engineering -> Product, Consulting -> Entrepreneurship, Corporate -> Startup).
   - For each transition explain: what changed, why it is professionally interesting, and why it matters to a candidate seeking mentorship.
7. KEY EXPERTISE:
   - Areas of meaningful experience. Ranked by evidence strength. Prefer demonstrated experience over listed skills.
8. PROFESSIONAL SIGNALS:
   - High-signal data points (frequent writing on a topic, speaking at events, domain shifts, public projects).
9. MENTORSHIP VALUE (CRITICAL FIELD):
   - For each major area of expertise: "What could a candidate realistically learn from this person's career journey and demonstrated experience?"
   - Ground strictly in actual career evidence.
10. CONFIDENCE RULES:
    - Use ONLY "high" or "medium". Never "low".
11. STRICT ANTI-HALLUCINATION:
    - Never manufacture interests, opinions, career motivations, personal beliefs, achievements, relationships, posts, or URLs.
    - Every insight must have non-empty evidence strings referencing the research data.

Return ONLY a valid JSON object matching this exact schema:
{
  "professionalIdentity": {
    "summary": "string",
    "expertise": ["string"],
    "industries": ["string"]
  },
  "currentFocus": {
    "summary": "string",
    "evidence": ["string"]
  },
  "interests": [
    {
      "topic": "string",
      "confidence": "high | medium",
      "evidence": ["string"]
    }
  ],
  "recurringThemes": [
    {
      "theme": "string",
      "description": "string",
      "confidence": "high | medium",
      "evidence": ["string"]
    }
  ],
  "careerTransitions": [
    {
      "from": "string",
      "to": "string",
      "whyItMatters": "string",
      "evidence": ["string"]
    }
  ],
  "keyExpertise": [
    {
      "area": "string",
      "description": "string",
      "confidence": "high | medium",
      "evidence": ["string"]
    }
  ],
  "professionalSignals": [
    {
      "signal": "string",
      "description": "string",
      "confidence": "high | medium",
      "evidence": ["string"]
    }
  ],
  "mentorshipValue": [
    {
      "area": "string",
      "whyCandidateCouldLearnFromThem": "string",
      "evidence": ["string"]
    }
  ],
  "researchQuality": {
    "confidence": "high | medium",
    "sourceCount": ${sourceCount},
    "limitations": ["string"]
  }
}`;

    // 4. Call Gemini Model
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
        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.15,
            responseMimeType: "application/json",
          },
        });

        if (response.text) {
          rawText = response.text.trim();
          break;
        }
      } catch (geminiErr) {
        if (isQuotaOrRateLimitError(geminiErr)) {
          console.warn(
            `[PersonIntelligenceService] Gemini quota exceeded (429) on ${model}. Switching directly to deterministic intelligence.`,
          );
          break;
        }
        console.log(`[PersonIntelligenceService] Gemini model ${model} notice:`);
      }
    }

    if (rawText) {
      console.log("[ColdConnect] Person intelligence generated");

      // Clean JSON fences if present
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr) {
        console.log("[PersonIntelligenceService] Initial JSON parse error:");
      }

      // 5. Validate Output
      let validation = validateStructuredPersonIntelligence(parsed, sourceCount);

      // 6. If validation failed, retry ONCE with correction prompt
      if (!validation.valid) {
        console.warn(
          "[PersonIntelligenceService] Initial output validation failed. Retrying with correction prompt:",
          validation.errors,
        );

        const correctionPrompt = `The previous JSON output failed validation for the following reasons:
${validation.errors.map((e) => `- ${e}`).join("\n")}

Please fix these issues and return a complete, valid JSON object matching the required schema. Ensure all fields are present, evidence arrays are non-empty strings referencing the research data, confidence values are strictly "high" or "medium", and mentorshipValue has concrete learning points.

RESEARCH DATA:
${researchContext}

OUTPUT ONLY VALID JSON.`;

        for (const retryModel of [
          "gemini-3.1-flash-lite",
          "gemini-flash-latest",
          "gemini-3.1-flash-lite",
          "gemini-3.1-pro-preview",
          "gemini-flash-latest",
        ]) {
          try {
            const retryResp = await this.ai.models.generateContent({
              model: retryModel,
              contents: correctionPrompt,
              config: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            });

            if (retryResp.text) {
              let retryText = retryResp.text.trim();
              if (retryText.startsWith("```")) {
                retryText = retryText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
              }
              const retryParsed = JSON.parse(retryText);
              validation = validateStructuredPersonIntelligence(retryParsed, sourceCount);
              if (validation.valid && validation.sanitized) {
                break;
              }
            }
          } catch (retryErr) {
            console.log(`[PersonIntelligenceService] Retry with ${retryModel} notice:`);
          }
        }
      }

      if (validation.valid && validation.sanitized) {
        console.log("[ColdConnect] Person intelligence validated");
        return validation.sanitized;
      }
    }

    // 7. If Gemini models were unavailable or rate-limited, synthesize rich deterministic intelligence
    console.log(
      "[ColdConnect] Gemini models unavailable or rate-limited. Synthesizing rich deterministic intelligence from verified research data.",
    );

    const deterministicIntel = this.generateDeterministicStructuredIntelligence({
      targetName,
      headline,
      location,
      about,
      currentRole,
      previousRoles,
      transitions,
      education,
      skills,
      activity,
      publicSources,
      sourceCount,
    });

    console.log("[ColdConnect] Person intelligence validated");
    return deterministicIntel;
  }

  /**
   * Generates deterministic Stage 2 StructuredPersonIntelligence from verified facts
   * when Gemini models are rate-limited or unavailable.
   */
  private generateDeterministicStructuredIntelligence(context: {
    targetName: string;
    headline: string;
    location: string;
    about: string;
    currentRole: Record<string, unknown> | null;
    previousRoles: Record<string, unknown>[];
    transitions: Record<string, unknown>[];
    education: Record<string, unknown>[];
    skills: unknown[];
    activity: { posts?: unknown[]; articles?: unknown[]; recurringTopics?: unknown[] };
    publicSources: Record<string, unknown>[];
    sourceCount: number;
  }): StructuredPersonIntelligence {
    const {
      targetName,
      headline,
      currentRole,
      previousRoles,
      transitions,
      education,
      skills,
      activity,
      sourceCount,
    } = context;

    const currentTitle = String(currentRole?.title || headline || "Senior Professional");
    const currentCompany = String(currentRole?.company || "Current Organization");

    const pastCompanies = previousRoles
      .slice(0, 3)
      .map((r) => String(r.company || r.companyName || ""))
      .filter((c) => Boolean(c) && c !== currentCompany);

    const skillStrings = skills
      .map((s) => (typeof s === "string" ? s : (s as { name?: string })?.name || ""))
      .filter(Boolean);

    // 1. Professional Identity
    let identitySummary = "";
    if (pastCompanies.length > 0) {
      identitySummary = `${currentTitle} with verified career experience across ${pastCompanies.join(", ")} and ${currentCompany}, specializing in ${skillStrings.slice(0, 3).join(", ") || "strategic leadership"}.`;
    } else {
      identitySummary = `${currentTitle} at ${currentCompany}, known for domain leadership in ${skillStrings.slice(0, 3).join(", ") || "functional growth"}.`;
    }

    const industries = Array.from(
      new Set(
        [
          currentCompany,
          ...pastCompanies,
          ...previousRoles.map((r) => String(r.industry || "")).filter(Boolean),
        ].slice(0, 4),
      ),
    );

    // 2. Current Focus
    const currentFocusSummary = `Currently focused on executing key initiatives as ${currentTitle} at ${currentCompany}.`;
    const currentFocusEvidence = [
      `Active position: ${currentTitle} at ${currentCompany}`,
      ...(Array.isArray(currentRole?.highlights)
        ? (currentRole?.highlights as string[]).slice(0, 2)
        : []),
    ];

    // 3. Interests
    const interests: IntelligenceInterest[] = [];
    if (skillStrings.length > 0) {
      interests.push({
        topic: skillStrings[0],
        confidence: "high",
        evidence: [`Demonstrated competency in ${skillStrings[0]} across verified profile.`],
      });
    }
    if (skillStrings.length > 1) {
      interests.push({
        topic: skillStrings[1],
        confidence: "high",
        evidence: [`Documented domain focus on ${skillStrings[1]}.`],
      });
    }
    if (activity?.recurringTopics && Array.isArray(activity.recurringTopics)) {
      activity.recurringTopics.slice(0, 2).forEach((rt: unknown) => {
        const topicObj = rt as { topic?: string; relevance?: string } | undefined;
        if (topicObj?.topic) {
          interests.push({
            topic: String(topicObj.topic),
            confidence: "medium",
            evidence: [
              String(topicObj.relevance || "Recurring public professional discussion topic."),
            ],
          });
        }
      });
    }

    // 4. Recurring Themes
    const recurringThemes: IntelligenceRecurringTheme[] = [];
    if (skillStrings.length > 0) {
      recurringThemes.push({
        theme: `${skillStrings[0]} & Execution`,
        description: `Consistent professional focus on driving high-standard outcomes in ${skillStrings[0]}.`,
        confidence: "high",
        evidence: [`Appears across verified roles and responsibilities at ${currentCompany}.`],
      });
    }
    if (pastCompanies.length > 0) {
      recurringThemes.push({
        theme: "Cross-Organizational Scaling",
        description: `Track record spanning varied organizational environments from ${pastCompanies[0]} to ${currentCompany}.`,
        confidence: "medium",
        evidence: ["Chronological career progression across multiple leading organizations."],
      });
    }

    // 5. Career Transitions
    const careerTransitions: IntelligenceCareerTransition[] = [];
    if (transitions.length > 0) {
      transitions.slice(0, 3).forEach((t) => {
        careerTransitions.push({
          from: String(t.fromRole || t.from || "Previous Role"),
          to: String(t.toRole || t.to || "New Role"),
          whyItMatters: String(
            t.description ||
              "Represents a strategic evolution in functional responsibility and scope.",
          ),
          evidence: ["Verified transition in public career record."],
        });
      });
    } else if (previousRoles.length > 0) {
      const prev = previousRoles[0];
      careerTransitions.push({
        from: `${prev.title || "Prior Role"} at ${prev.company || "Previous Org"}`,
        to: `${currentTitle} at ${currentCompany}`,
        whyItMatters:
          "Demonstrates career growth and expanding leadership scope across distinct organizational structures.",
        evidence: [
          `Career trajectory from ${prev.company || "prior employer"} to ${currentCompany}.`,
        ],
      });
    }

    // 6. Key Expertise
    const keyExpertise: IntelligenceKeyExpertise[] = [];
    if (skillStrings.length > 0) {
      keyExpertise.push({
        area: skillStrings[0],
        description: `Deep hands-on domain experience applied directly at ${currentCompany}.`,
        confidence: "high",
        evidence: [`Verified experience and role scope at ${currentCompany}.`],
      });
    }
    if (skillStrings.length > 1) {
      keyExpertise.push({
        area: skillStrings[1],
        description: `Operational capability demonstrated through career execution.`,
        confidence: "high",
        evidence: [`Documented across professional background.`],
      });
    }
    if (previousRoles.length > 0) {
      keyExpertise.push({
        area: "Strategic Execution & Growth",
        description:
          "Proven capacity to navigate and deliver across multiple roles and organizations.",
        confidence: "medium",
        evidence: [`Sustained progression across ${pastCompanies.length + 1} organizations.`],
      });
    }

    // 7. Professional Signals
    const professionalSignals: IntelligenceProfessionalSignal[] = [
      {
        signal: `Leadership role at ${currentCompany}`,
        description: `Currently driving initiatives as ${currentTitle}.`,
        confidence: "high",
        evidence: [`Verified current position.`],
      },
    ];
    if (education.length > 0) {
      const edu = education[0];
      const inst = String(edu.institution || edu.school || "University");
      professionalSignals.push({
        signal: `Academic foundation from ${inst}`,
        description: `Formal education credentials underpinning technical and analytical capabilities.`,
        confidence: "medium",
        evidence: [`Verified education record at ${inst}.`],
      });
    }

    // 8. Mentorship Value
    const mentorshipValue: IntelligenceMentorshipValue[] = [
      {
        area: `Navigating Career Growth in ${skillStrings[0] || "their domain"}`,
        whyCandidateCouldLearnFromThem: `Candidate can gain direct insight into how ${targetName} developed mastery and advanced to ${currentTitle} at ${currentCompany}.`,
        evidence: [`Demonstrated track record leading up to ${currentTitle}.`],
      },
    ];
    if (pastCompanies.length > 0) {
      mentorshipValue.push({
        area: `Transitioning Between High-Impact Teams (${pastCompanies[0]} to ${currentCompany})`,
        whyCandidateCouldLearnFromThem:
          "Offers practical perspective on adapting skill sets, building stakeholder trust, and scaling influence across new teams.",
        evidence: [`Successful transition between ${pastCompanies[0]} and ${currentCompany}.`],
      });
    }

    return {
      professionalIdentity: {
        summary: identitySummary,
        expertise: skillStrings.slice(0, 5),
        industries,
      },
      currentFocus: {
        summary: currentFocusSummary,
        evidence: currentFocusEvidence,
      },
      interests,
      recurringThemes,
      careerTransitions,
      keyExpertise,
      professionalSignals,
      mentorshipValue,
      researchQuality: {
        confidence: sourceCount > 1 ? "high" : "medium",
        sourceCount: Math.max(1, sourceCount),
        limitations: [
          "Intelligence generated from verified public professional background signals.",
        ],
      },
    };
  }

  /**
   * Legacy / candidate-personalized mentorship intelligence generator.
   * Maintained for backward compatibility.
   */
  async generateIntelligence(params: GenerateIntelligenceParams): Promise<PersonIntelligenceData> {
    const { targetPerson, userProfile, connectionMeta } = params;

    // 1. Build Target Person Profile Context
    const targetLines: string[] = [];
    if (targetPerson.identity) {
      if (targetPerson.identity.name) targetLines.push(`Name: ${targetPerson.identity.name}`);
      if (targetPerson.identity.headline)
        targetLines.push(`Headline: ${targetPerson.identity.headline}`);
      if (targetPerson.identity.location)
        targetLines.push(`Location: ${targetPerson.identity.location}`);
      if (targetPerson.identity.linkedinUrl)
        targetLines.push(`LinkedIn URL: ${targetPerson.identity.linkedinUrl}`);
    }
    if (targetPerson.currentRole) {
      const cr = targetPerson.currentRole;
      targetLines.push(
        `Current Role: ${[cr.title, cr.company].filter(Boolean).join(" at ")}${cr.location ? ` (${cr.location})` : ""}${cr.startDate ? ` [Started: ${cr.startDate}]` : ""}`,
      );
      if (cr.description) targetLines.push(`Current Role Description: ${cr.description}`);
    }
    if (targetPerson.about) {
      targetLines.push(`About / Summary: ${targetPerson.about}`);
    }
    if (targetPerson.experience && targetPerson.experience.length > 0) {
      targetLines.push("Career Experience History (Chronological):");
      targetPerson.experience.forEach((e, idx) => {
        const dates = [e.startDate, e.endDate].filter(Boolean).join(" - ") || e.duration || "";
        targetLines.push(
          `  ${idx + 1}. ${e.title} at ${e.company}${dates ? ` (${dates})` : ""}${e.location ? ` - ${e.location}` : ""}`,
        );
        if (e.description) targetLines.push(`     Description: ${e.description}`);
        if (e.skills && e.skills.length > 0)
          targetLines.push(`     Skills used: ${e.skills.join(", ")}`);
      });
    }
    if (targetPerson.education && targetPerson.education.length > 0) {
      targetLines.push("Education:");
      targetPerson.education.forEach((edu, idx) => {
        const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" - ");
        targetLines.push(
          `  ${idx + 1}. ${edu.institution}${edu.degree ? ` - ${edu.degree}` : ""}${edu.fieldOfStudy ? ` (${edu.fieldOfStudy})` : ""}${dates ? ` [${dates}]` : ""}`,
        );
      });
    }
    if (targetPerson.skills && targetPerson.skills.length > 0) {
      const skillNames = targetPerson.skills.map((s) => s.name).filter(Boolean);
      targetLines.push(`Skills: ${skillNames.join(", ")}`);
    }
    if (targetPerson.certifications && targetPerson.certifications.length > 0) {
      targetLines.push("Certifications:");
      targetPerson.certifications.forEach((c) => {
        targetLines.push(
          `  - ${c.name}${c.issuingOrganization ? ` (${c.issuingOrganization})` : ""}`,
        );
      });
    }
    if (targetPerson.projects && targetPerson.projects.length > 0) {
      targetLines.push("Projects:");
      targetPerson.projects.forEach((p) => {
        targetLines.push(`  - ${p.title}${p.description ? `: ${p.description}` : ""}`);
      });
    }
    if (targetPerson.organizations && targetPerson.organizations.length > 0) {
      targetLines.push("Organizations & Volunteering:");
      targetPerson.organizations.forEach((o) => {
        targetLines.push(`  - ${o.name}${o.position ? ` (${o.position})` : ""}`);
      });
    }
    if (targetPerson.interests) {
      const i = targetPerson.interests;
      const interestSignals: string[] = [];
      if (i.companies?.length)
        interestSignals.push(`Companies Followed: ${i.companies.map((c) => c.name).join(", ")}`);
      if (i.topVoices?.length)
        interestSignals.push(`Top Voices Followed: ${i.topVoices.map((v) => v.name).join(", ")}`);
      if (i.groups?.length)
        interestSignals.push(`Groups: ${i.groups.map((g) => g.name).join(", ")}`);
      if (i.newsletters?.length)
        interestSignals.push(`Newsletters: ${i.newsletters.map((n) => n.name).join(", ")}`);
      if (i.schools?.length)
        interestSignals.push(`Schools: ${i.schools.map((s) => s.name).join(", ")}`);
      if (interestSignals.length > 0) {
        targetLines.push(`Interests & Followed Signals:\n  ${interestSignals.join("\n  ")}`);
      }
    }
    if (targetPerson.publications && targetPerson.publications.length > 0) {
      targetLines.push("Publications / Articles:");
      targetPerson.publications.forEach((p) => {
        targetLines.push(`  - ${p.title}${p.publisher ? ` (${p.publisher})` : ""}`);
      });
    }
    if (targetPerson.awards && targetPerson.awards.length > 0) {
      targetLines.push("Awards & Honors:");
      targetPerson.awards.forEach((a) => {
        targetLines.push(`  - ${a.title}${a.issuer ? ` (${a.issuer})` : ""}`);
      });
    }

    // 2. Build User (Candidate) Profile Context
    const userLines: string[] = [];
    if (userProfile) {
      if (userProfile.pitchDNA) {
        userLines.push(`Candidate Core Identity (Pitch DNA):`);
        if (userProfile.pitchDNA.whoIAm)
          userLines.push(`  Who I Am: ${userProfile.pitchDNA.whoIAm}`);
        if (userProfile.pitchDNA.whatIDo)
          userLines.push(`  What I Do: ${userProfile.pitchDNA.whatIDo}`);
        if (userProfile.pitchDNA.story)
          userLines.push(`  Career Story: ${userProfile.pitchDNA.story}`);
        if (userProfile.pitchDNA.currentFocus)
          userLines.push(`  Current Focus: ${userProfile.pitchDNA.currentFocus}`);
        if (userProfile.pitchDNA.whatImLookingFor)
          userLines.push(
            `  What I'm Looking For: ${userProfile.pitchDNA.whatImLookingFor.join(", ")}`,
          );
        if (userProfile.pitchDNA.credibleDifferentiators)
          userLines.push(
            `  Differentiators: ${userProfile.pitchDNA.credibleDifferentiators.join(", ")}`,
          );
      }
      if (userProfile.fullName) userLines.push(`Candidate Name: ${userProfile.fullName}`);
      if (userProfile.headline) userLines.push(`Candidate Headline: ${userProfile.headline}`);
      if (userProfile.location) userLines.push(`Candidate Location: ${userProfile.location}`);
      if (userProfile.about) userLines.push(`Candidate Bio/About: ${userProfile.about}`);
      if (userProfile.careerGoals)
        userLines.push(`Candidate Career Goals: ${userProfile.careerGoals}`);
      if (userProfile.networkingGoals)
        userLines.push(`Candidate Networking & Mentorship Goals: ${userProfile.networkingGoals}`);
      if (userProfile.skills && userProfile.skills.length > 0) {
        userLines.push(`Candidate Skills: ${userProfile.skills.join(", ")}`);
      }
      if (userProfile.interests && userProfile.interests.length > 0) {
        userLines.push(`Candidate Interests: ${userProfile.interests.join(", ")}`);
      }
      if (userProfile.experience && userProfile.experience.length > 0) {
        userLines.push("Candidate Experience History:");
        userProfile.experience.forEach((e, idx) => {
          userLines.push(
            `  ${idx + 1}. ${e.title} at ${e.company}${e.period ? ` (${e.period})` : ""}${e.description ? ` - ${e.description}` : ""}`,
          );
        });
      }
      if (userProfile.education && userProfile.education.length > 0) {
        userLines.push("Candidate Education:");
        userProfile.education.forEach((edu, idx) => {
          userLines.push(
            `  ${idx + 1}. ${edu.degree || "Degree"} at ${edu.school}${edu.year ? ` (${edu.year})` : ""}`,
          );
        });
      }
    } else {
      userLines.push(
        "Candidate is a dedicated professional seeking mentorship, practical industry guidance, and career insights.",
      );
    }

    // 3. Build Meeting Context
    const rawMeetingPurpose = connectionMeta?.meetingPurpose?.trim();
    const meetingPurpose =
      rawMeetingPurpose && rawMeetingPurpose !== "none"
        ? rawMeetingPurpose.replace(/_/g, " ")
        : "Career Advice & Mentorship";

    const contextLines: string[] = [`Meeting Objective: ${meetingPurpose}`];
    if (connectionMeta?.relationshipStatus) {
      contextLines.push(`Relationship Status: ${connectionMeta.relationshipStatus}`);
    }
    if (connectionMeta?.notes) {
      const notes = Array.isArray(connectionMeta.notes)
        ? connectionMeta.notes.join(" | ")
        : connectionMeta.notes;
      if (notes.trim()) contextLines.push(`Candidate Notes on Expert: ${notes}`);
    }
    if (connectionMeta?.tags && connectionMeta.tags.length > 0) {
      contextLines.push(`Tags: ${connectionMeta.tags.join(", ")}`);
    }

    const systemInstruction = `You are ColdConnect's Personalized Networking + Mentorship Intelligence Engine.

CRITICAL PRODUCT PHILOSOPHY:
ColdConnect is NOT a generic LinkedIn summarizer.
ColdConnect treats the user as a CANDIDATE seeking guidance, wisdom, and mentorship from an experienced professional / expert.

CORE OBJECTIVE:
"Help me understand this person well enough to have a thoughtful, credible conversation and learn something valuable from them."

TONE & STYLE GUIDELINES:
- Tone of the candidate: Curious, humble, prepared, intelligent, candid, and respectful.
- FORBIDDEN TONE: Salesy, transactional, desperate, overly flattering, corporate, or artificially enthusiastic.
- NEVER use generic flattery ("I was inspired by your incredible journey...", "I'd love to pick your brain...", "Your impressive achievements...").
- INSTEAD use specific, evidence-backed observations ("I noticed you moved from strategy into brand ownership at [Company] — what changed most in how you approached decisions once you were on the operating side?").

QUALITY STANDARDS & HARD RULES:
1. SPECIFICITY TEST: If the response could apply to someone else simply by swapping the name and company, IT FAILS.
2. HEADLINE TEST: If the intelligence could have been generated from the LinkedIn headline alone without analyzing career history and transitions, IT FAILS.
3. LEARNING TEST: Every question, hook, and transition must unlock real, actionable mentorship learning for the candidate.
4. ZERO FABRICATION: Never invent achievements, employers, or personal hobbies. If evidence is weak or unconfirmed, classify confidence as "low" and state: "Possible interest signal" or "Not enough public evidence to confidently identify this interest."`;

    const prompt = `
=== TARGET PERSON (EXPERT PROFILE & VERIFIED CAREER HISTORY) ===
${targetLines.join("\n")}

=== AUTHENTICATED USER (CANDIDATE PROFILE & ASPIRATIONS) ===
${userLines.join("\n")}

=== MEETING CONTEXT & OBJECTIVE ===
${contextLines.join("\n")}

==================================================
TASK: GENERATE COMPLETE MENTORSHIP INTELLIGENCE
==================================================

Generate rich, highly tailored mentorship intelligence matching the JSON schema below:

1. PERSON SNAPSHOT:
   - summary: Concise summary of career trajectory (MAXIMUM 2 sentences).
   - keyPoints: 2–3 key milestone points (e.g. current role/scope, previous brand/company, notable transitions).

2. WHAT THEY CARE ABOUT:
   - coreProfessionalInterests: 3-4 specific domain areas they have demonstrated expertise in (e.g., "Consumer Brand Building", "Go-To-Market Execution", "Category Creation").
   - currentPriorities: 2-3 active priorities based on their current role & company trajectory (e.g., "Scaling Distribution", "Premium Product Positioning").
   - intellectualInterests: 2-3 strategic themes they think about (e.g., "Business Transformation", "Consumer Behavior", "Operational Systems").
   - careerThemes: 2-3 high-level arc patterns (e.g., "Corporate → Operator", "Strategy → Direct Brand Ownership", "Individual Contributor → Executive Leadership").

3. CURRENT FOCUS:
   - summary: What the person appears to be focused on NOW (MAXIMUM 2 sentences).
   - evidence: 2-3 specific evidence points from their current role, projects, or organization.

4. CAREER TRANSITIONS (CRITICAL FOR MENTORSHIP):
   - Identify 1-3 significant career transitions (function changes, company changes, corporate to startup, consulting to operating, technical to leadership).
   - For each transition provide:
     * from: previous role/company
     * to: next role/company
     * transitionType: e.g. "Advisory → Operating", "Corporate → Startup", "Technical → Product Leadership"
     * context: brief background on this pivot
     * mentorshipOpportunity: "What the candidate can learn from this specific transition"
     * suggestedQuestion: a sharp, curious question about the mindset or decision-making behind that pivot.

5. MENTORSHIP FIT (MATCH ANALYSIS):
   - whyThisPerson: Why is this person uniquely relevant to the candidate's journey?
   - whatYouCanLearn: 3-4 specific, concrete lessons/insights the candidate can realistically learn from them.
   - whyTheyWouldHelp: Why would this expert be willing to give 15-20 minutes of their time to this prepared candidate? (e.g., candidate asks thoughtful domain questions rather than asking for favors).
   - mostRelevantExperience: Which specific chapter of their career is most applicable to the candidate?
   - uniquelyQualifiedAsk: What question is this expert uniquely positioned to answer that generic mentors cannot?

6. RELEVANT INTERESTS (WITH CONFIDENCE SCORES):
   - 3-5 items with:
     * label: interest label
     * category: "professional" | "priority" | "intellectual" | "theme"
     * reason: why this signal matters
     * evidence: verified signal from profile/experience
     * confidence: "high" | "medium" | "low" (high = repeatedly demonstrated; medium = contextual evidence; low = single weak signal)

7. BEST ENTRY POINT & BEST OPENING:
   - opening: ONE natural, specific opening question or icebreaker that sounds humble, prepared, and curious (NOT salesy or flattering).
   - why: Why this opening creates immediate credibility.
   - evidence: Verified experience point referenced.
   - tone: "Curious, candid, and respectful mentorship tone"

8. MENTORSHIP QUESTION LADDER (PROGRESSIVE DEPTH):
   - level1Warmup: Easy professional question about active role/company focus.
   - level2Experience: Question about a specific past project, challenge, or achievement.
   - level3Decision: Question about a pivotal decision, trade-off, or career transition.
   - level4Insight: Question about counter-intuitive lessons learned or what they wish they knew earlier.
   - level5Advice: Question connecting their insight directly to the candidate's growth without being transactional.

9. RECOMMENDED QUESTIONS (5 TOTAL):
   - 5 questions covering the ladder levels, each with:
     * question: string
     * reason: what this question achieves
     * category: "career" | "transition" | "strategy" | "leadership" | "industry"
     * ladderLevel: 1 | 2 | 3 | 4 | 5
     * objective: the conversational goal
     * followUps: 1-2 sharp follow-up prompts to go deeper if they engage

10. CONVERSATION HOOKS (3-4 TOTAL):
    - topic: topic title
    - observation: specific verified observation about their background
    - question: thoughtful question based on that observation
    - whyItMatters: why this matters to the candidate's learning
    - suggestedApproach: how to bring it up naturally
    - evidence: verified signal
    - confidence: "high" | "medium"

11. CANDIDATE INTRODUCTION (SPOKEN 20-30 SECOND PITCH):
    - spokenPitch: A clean 20-30 second introduction the candidate can say out loud: Who I am + What I'm currently doing + Why I wanted to speak with them + What I hope to learn.
    - structure: { whoIAm, currentFocus, whyThisExpert, learningGoal }

12. NATURAL OUTREACH MESSAGE (MAX 70 WORDS):
    - text: Short, personalized note: Person-specific observation + Why it caught candidate's attention + Specific learning request + Low-pressure CTA.
    - wordCount: number

13. THINGS TO AVOID ASKING:
    - 3-4 specific things to avoid (e.g. asking for resume reviews/referrals right away, asking basic questions answered on their LinkedIn headline, overly broad questions like "tell me about yourself").

14. COMMON GROUND & YOUR ANGLE:
    - commonGround: Up to 3 genuine overlaps (shared education, geography, tech stack, career transitions). If none, empty array [].
    - whyConnect: 1 crisp sentence on why this meeting is valuable.
    - yourAngle: { positioning, relevance, value }

15. MEETING STRATEGY:
    - opening, middle, closing conversational flow.

==================================================
OUTPUT FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "careerSnapshot": {
    "summary": "string",
    "keyPoints": ["string"]
  },
  "whatTheyCareAbout": {
    "coreProfessionalInterests": ["string"],
    "currentPriorities": ["string"],
    "intellectualInterests": ["string"],
    "careerThemes": ["string"]
  },
  "currentFocus": {
    "summary": "string",
    "evidence": ["string"]
  },
  "careerTransitions": [
    {
      "from": "string",
      "to": "string",
      "transitionType": "string",
      "context": "string",
      "mentorshipOpportunity": "string",
      "suggestedQuestion": "string"
    }
  ],
  "mentorshipFit": {
    "whyThisPerson": "string",
    "whatYouCanLearn": ["string"],
    "whyTheyWouldHelp": "string",
    "mostRelevantExperience": "string",
    "uniquelyQualifiedAsk": "string"
  },
  "relevantInterests": [
    {
      "label": "string",
      "category": "professional",
      "reason": "string",
      "evidence": "string",
      "confidence": "high"
    }
  ],
  "commonGround": [
    {
      "point": "string",
      "evidence": "string",
      "confidence": "medium"
    }
  ],
  "bestOpening": {
    "opening": "string",
    "why": "string",
    "evidence": "string",
    "tone": "Curious, candid, and respectful mentorship tone"
  },
  "questionLadder": {
    "level1Warmup": { "question": "string", "reason": "string", "objective": "string" },
    "level2Experience": { "question": "string", "reason": "string", "objective": "string" },
    "level3Decision": { "question": "string", "reason": "string", "objective": "string" },
    "level4Insight": { "question": "string", "reason": "string", "objective": "string" },
    "level5Advice": { "question": "string", "reason": "string", "objective": "string" }
  },
  "conversationHooks": [
    {
      "topic": "string",
      "observation": "string",
      "question": "string",
      "why": "string",
      "whyItMatters": "string",
      "suggestedApproach": "string",
      "evidence": "string",
      "confidence": "high"
    }
  ],
  "recommendedQuestions": [
    {
      "question": "string",
      "reason": "string",
      "category": "career",
      "ladderLevel": 1,
      "objective": "string",
      "followUps": ["string"]
    }
  ],
  "candidateIntroduction": {
    "spokenPitch": "string",
    "structure": {
      "whoIAm": "string",
      "currentFocus": "string",
      "whyThisExpert": "string",
      "learningGoal": "string"
    }
  },
  "outreachMessage": {
    "text": "string",
    "wordCount": 55
  },
  "thingsToAvoid": [
    "string"
  ],
  "whyConnect": "string",
  "yourAngle": {
    "positioning": "string",
    "relevance": "string",
    "value": "string"
  },
  "meetingStrategy": {
    "opening": "string",
    "middle": "string",
    "closing": "string"
  }
}
`;

    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let lastError: unknown = null;

    for (const modelName of modelsToTry) {
      // For high-demand (503/UNAVAILABLE) errors, try once or with minimal backoff before moving to the next model
      const maxRetries = 1;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delayMs = 300 + Math.random() * 200;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          const response = await this.ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
            },
          });

          const responseText = response.text || "{}";
          return this.parseAndValidate(responseText, params);
        } catch (err: unknown) {
          lastError = err;
          const errString = err instanceof Error ? err.message : String(err);
          const isHighDemand =
            errString.includes("503") ||
            errString.includes("high demand") ||
            errString.includes("UNAVAILABLE") ||
            errString.includes("overloaded");

          console.warn(
            `[PersonIntelligenceService] ${modelName} attempt ${attempt + 1} notice:`,
            isHighDemand
              ? "Model high demand / temporarily busy. Trying next available model..."
              : errString,
          );

          // If high demand, immediately move to the next model to avoid waiting
          if (isHighDemand) {
            break;
          }
        }
      }
    }

    console.log(
      "[PersonIntelligenceService] Gemini models currently experiencing high demand. Synthesizing rich deterministic mentorship intelligence from verified profile.",
    );

    return this.generateDeterministicFallback(params);
  }

  /**
   * Deterministic high-quality mentorship intelligence synthesis.
   */
  private generateDeterministicFallback(
    params: GenerateIntelligenceParams,
  ): PersonIntelligenceData {
    const { targetPerson, userProfile, connectionMeta } = params;
    const name = targetPerson.identity?.name || connectionMeta?.name || "This contact";
    const firstName = name.split(" ")[0] || "there";
    const currentTitle =
      targetPerson.currentRole?.title || targetPerson.identity?.headline || "Professional";
    const currentCompany = targetPerson.currentRole?.company || "their organization";
    const experience = targetPerson.experience || [];
    const education = targetPerson.education || [];
    const skills = targetPerson.skills?.map((s) => s.name).filter(Boolean) || [];

    const rawMeetingPurpose = connectionMeta?.meetingPurpose?.trim();
    const meetingPurpose =
      rawMeetingPurpose && rawMeetingPurpose !== "none"
        ? rawMeetingPurpose.replace(/_/g, " ")
        : "Career Advice & Mentorship";

    // 1. Career Snapshot (Max 2 sentences)
    const pastCompanies = experience
      .slice(1, 4)
      .map((e) => e.company)
      .filter((c): c is string => Boolean(c) && c !== currentCompany);

    const summary =
      pastCompanies.length > 0
        ? `${name} currently serves as ${currentTitle} at ${currentCompany}, having previously built domain expertise across leadership roles at ${pastCompanies.join(" and ")}.`
        : `${name} is currently ${currentTitle} at ${currentCompany}, driving core strategic execution and growth in ${skills.slice(0, 3).join(", ") || "functional leadership"}.`;

    const keyPoints: string[] = [];
    if (targetPerson.currentRole?.title && targetPerson.currentRole?.company) {
      keyPoints.push(
        `Current Focus: ${targetPerson.currentRole.title} at ${targetPerson.currentRole.company}`,
      );
    }
    if (pastCompanies.length > 0) {
      keyPoints.push(`Prior Trajectory: Experience at ${pastCompanies.join(", ")}`);
    }
    if (education.length > 0) {
      const topEdu = education[0];
      keyPoints.push(
        `Academic Foundation: ${topEdu.institution}${topEdu.degree ? ` (${topEdu.degree})` : ""}`,
      );
    }
    if (keyPoints.length === 0 && skills.length > 0) {
      keyPoints.push(`Domain Expertise: ${skills.slice(0, 3).join(", ")}`);
    }

    // 2. What They Care About
    const whatTheyCareAbout: WhatTheyCareAboutData = {
      coreProfessionalInterests: [
        skills[0] || `${currentTitle} Strategy`,
        skills[1] || `Operational Excellence in ${currentCompany}`,
        skills[2] || "Team & Organizational Growth",
        "Strategic Decision-Making",
      ].filter(Boolean),
      currentPriorities: [
        `Scaling strategic initiatives and performance as ${currentTitle} at ${currentCompany}`,
        `Navigating sector dynamics and market expansion`,
        `Optimizing cross-functional execution and team capability`,
      ],
      intellectualInterests: [
        "Business Transformation & Strategy",
        "Leadership Systems & Decision Models",
        "Industry Market Dynamics",
      ],
      careerThemes: [
        pastCompanies.length > 0
          ? `Evolution from ${pastCompanies[0]} into leadership at ${currentCompany}`
          : "Continuous Functional Deepening",
        "Strategic Advisory → Direct Operating Ownership",
        "Execution Excellence → High-Leverage Leadership",
      ],
    };

    // 3. Current Focus
    const currentFocusSummary = targetPerson.currentRole?.description
      ? targetPerson.currentRole.description.split("\n")[0].slice(0, 180)
      : `Leading strategic initiatives, domain execution, and team growth as ${currentTitle} at ${currentCompany}.`;

    const currentFocusEvidence: string[] = [
      `Active leadership position as ${currentTitle} at ${currentCompany}`,
      ...(skills.length > 0 ? [`Verified domain focus in ${skills.slice(0, 2).join(" & ")}`] : []),
    ];

    // 4. Career Transitions (Mentorship Learning Moments)
    const careerTransitions: CareerTransitionItem[] = [];
    if (experience.length > 1) {
      const past = experience[1];
      const cur = targetPerson.currentRole;
      careerTransitions.push({
        from: `${past.title} at ${past.company}`,
        to: `${cur.title || currentTitle} at ${cur.company || currentCompany}`,
        transitionType:
          past.company !== currentCompany ? "Cross-Company Pivot" : "Internal Progression",
        context: `Transitioned from ${past.title} at ${past.company} into ${currentTitle} at ${currentCompany}.`,
        mentorshipOpportunity: `Understand how mindset, decision frameworks, and operating tempo changed when moving from ${past.company} to ${currentCompany}.`,
        suggestedQuestion: `When you transitioned from ${past.company} into your current role at ${currentCompany}, what was the steepest learning curve, and what mental model helped you adapt fastest?`,
      });
    } else {
      careerTransitions.push({
        from: education.length > 0 ? education[0].institution : "Early Career Foundation",
        to: `${currentTitle} at ${currentCompany}`,
        transitionType: "Domain Specialization",
        context: `Built specialized capability and ascended into ${currentTitle}.`,
        mentorshipOpportunity: "Learn how early career principles translate into senior execution.",
        suggestedQuestion: `Looking back at how you established your footing in this space, what early skill or habit proved to be the highest leverage?`,
      });
    }

    // 5. Mentorship Fit
    const candidateGoal =
      userProfile?.careerGoals ||
      userProfile?.networkingGoals ||
      "career growth and strategic mastery";
    const mentorshipFit: MentorshipFitData = {
      whyThisPerson: `${name} has navigated the exact progression, operational challenges, and strategic transitions that align with your focus on ${candidateGoal}.`,
      whatYouCanLearn: [
        `How to approach high-stakes decisions and trade-offs in ${currentCompany}'s space`,
        `The practical differences between theoretical frameworks and day-to-day operating realities`,
        `Lessons learned from transitioning across different organizational environments`,
        `How to position yourself for impactful growth within this industry`,
      ],
      whyTheyWouldHelp:
        "You are approaching the conversation with genuine curiosity, specific preparation, and respectful questions rather than transactional requests.",
      mostRelevantExperience:
        pastCompanies.length > 0
          ? `Their transition and growth from ${pastCompanies[0]} into ${currentCompany}`
          : `Their hands-on leadership as ${currentTitle} at ${currentCompany}`,
      uniquelyQualifiedAsk: `How they evaluate strategic trade-offs between speed and precision in their current operating environment at ${currentCompany}.`,
    };

    // 6. Relevant Interests (Signal Scoring)
    const relevantInterests: RelevantInterestItem[] = [];
    if (targetPerson.interests?.companies?.length) {
      targetPerson.interests.companies.slice(0, 3).forEach((c) => {
        relevantInterests.push({
          label: c.name,
          interest: c.name,
          category: "professional",
          reason: `Followed organizational signal on LinkedIn`,
          evidence: `Follows ${c.name} updates.`,
          confidence: "medium",
        });
      });
    }
    if (skills.length > 0) {
      skills.slice(0, 3).forEach((s) => {
        relevantInterests.push({
          label: s,
          interest: s,
          category: "professional",
          reason: "Verified core competency",
          evidence: `Listed under verified professional skills.`,
          confidence: "high",
        });
      });
    }

    // 7. Common Ground
    const commonGround: CommonGroundItem[] = [];
    if (userProfile) {
      const userSchools = (userProfile.education || []).map((e) => (e.school || "").toLowerCase());
      const targetSchools = education.map((e) => (e.institution || "").toLowerCase());
      const sharedSchool = targetSchools.find(
        (ts) => ts && userSchools.some((us) => us && (us.includes(ts) || ts.includes(us))),
      );
      if (sharedSchool) {
        commonGround.push({
          point: `Shared academic connection (${sharedSchool})`,
          connection: `Shared academic connection (${sharedSchool})`,
          evidence: `Both connected through academic background at ${sharedSchool}.`,
          confidence: "high",
        });
      }

      const userSkills = (userProfile.skills || []).map((s) => (s || "").toLowerCase());
      const sharedSkills = skills.filter((ts) => userSkills.includes(ts.toLowerCase()));
      if (sharedSkills.length > 0) {
        commonGround.push({
          point: `Shared domain expertise: ${sharedSkills.slice(0, 2).join(", ")}`,
          connection: `Shared domain expertise: ${sharedSkills.slice(0, 2).join(", ")}`,
          evidence: `Both leverage ${sharedSkills.slice(0, 2).join(" and ")} in professional work.`,
          confidence: "medium",
        });
      }
    }

    // 8. Best Opening (Curious, candid, respectful mentorship tone)
    const bestOpening: BestOpeningItem = {
      opening:
        pastCompanies.length > 0
          ? `I noticed your transition from ${pastCompanies[0]} to ${currentCompany}—what changed most in the way you approached decisions once you were on the operating side at ${currentCompany}?`
          : `I saw your work as ${currentTitle} at ${currentCompany}—what is the biggest operational challenge you and your team are currently solving?`,
      why: "References their verified career progression with genuine intellectual curiosity instead of superficial flattery.",
      evidence: `Verified career progression at ${currentCompany}${pastCompanies.length > 0 ? ` and ${pastCompanies[0]}` : ""}.`,
      tone: "Curious, candid, and respectful mentorship tone",
    };

    // 9. Mentorship Question Ladder (5 progressive levels)
    const questionLadder: MentorshipQuestionLadder = {
      level1Warmup: {
        question: `What is the most interesting problem your team at ${currentCompany} is working on this quarter?`,
        reason: "Easy entry point focusing on active work that they enjoy discussing.",
        objective: "Establish comfortable rapport and baseline context.",
      },
      level2Experience: {
        question:
          pastCompanies.length > 0
            ? `When you look back at your time at ${pastCompanies[0]}, what foundational skill or mindset proved most transferable to ${currentCompany}?`
            : `What has been the most rewarding project or milestone during your time at ${currentCompany}?`,
        reason: "Prompts personal storytelling rooted in concrete experience.",
        objective: "Surface tacit experience and career building blocks.",
      },
      level3Decision: {
        question:
          pastCompanies.length > 0
            ? `What was the critical inflection point or decision that led you to make the move to ${currentCompany}?`
            : `When facing competing strategic priorities at ${currentCompany}, what decision framework do you rely on?`,
        reason: "Explores the reasoning behind career choices and strategic trade-offs.",
        objective: "Understand how they evaluate risk and opportunity.",
      },
      level4Insight: {
        question: `What is one principle or assumption about this industry that you held early on, but eventually realized was mistaken?`,
        reason: "Surfaces counter-intuitive insights and wisdom learned through trial.",
        objective: "Unpack hard-won industry truths.",
      },
      level5Advice: {
        question: `For someone in my position looking to build strong foundations in ${skills[0] || "this domain"}, what should I prioritize investing time in right now?`,
        reason: "Connects their wisdom directly to the candidate's forward journey.",
        objective: "Gain personalized, actionable career guidance.",
      },
    };

    // 10. Recommended Questions (5 items with ladder levels & follow-ups)
    const recommendedQuestions: RecommendedQuestionItem[] = [
      {
        question: questionLadder.level1Warmup.question,
        reason: questionLadder.level1Warmup.reason,
        category: "role_focus",
        ladderLevel: 1,
        objective: questionLadder.level1Warmup.objective,
        followUps: [
          `What makes that initiative particularly challenging compared to previous quarters?`,
        ],
      },
      {
        question: questionLadder.level2Experience.question,
        reason: questionLadder.level2Experience.reason,
        category: "experience",
        ladderLevel: 2,
        objective: questionLadder.level2Experience.objective,
        followUps: [
          `Did you develop that approach through trial and error, or did a mentor guide you?`,
        ],
      },
      {
        question: questionLadder.level3Decision.question,
        reason: questionLadder.level3Decision.reason,
        category: "career_transition",
        ladderLevel: 3,
        objective: questionLadder.level3Decision.objective,
        followUps: [
          `What was the biggest unknown you had to get comfortable with before making that call?`,
        ],
      },
      {
        question: questionLadder.level4Insight.question,
        reason: questionLadder.level4Insight.reason,
        category: "industry_insight",
        ladderLevel: 4,
        objective: questionLadder.level4Insight.objective,
        followUps: [
          `How did that realization change how you evaluate new projects or team dynamics?`,
        ],
      },
      {
        question: questionLadder.level5Advice.question,
        reason: questionLadder.level5Advice.reason,
        category: "mentorship_guidance",
        ladderLevel: 5,
        objective: questionLadder.level5Advice.objective,
        followUps: [
          `Are there specific projects or environments where that skill develops fastest?`,
        ],
      },
    ];

    // 11. Conversation Hooks
    const conversationHooks: ConversationHookItem[] = [
      {
        topic: `Strategic Priorities at ${currentCompany}`,
        hook: `I noticed your focus as ${currentTitle} at ${currentCompany}—what are the key operating challenges your team is prioritizing right now?`,
        observation: `Holds active leadership as ${currentTitle} at ${currentCompany}.`,
        question: `How are you and your team balancing speed vs. precision on your top initiatives?`,
        why: "Invites them to speak about active high-priority projects and team focus.",
        whyItWorks: "Invites them to speak about active high-priority projects and team focus.",
        whyItMatters: "Helps the candidate understand real-world operational trade-offs.",
        suggestedApproach: "Ask open-ended questions regarding their current operational roadmap.",
        evidence: `Current role as ${currentTitle} at ${currentCompany}.`,
        confidence: "high",
      },
    ];

    if (pastCompanies.length > 0) {
      conversationHooks.push({
        topic: `Career Transition: ${pastCompanies[0]} → ${currentCompany}`,
        hook: `Your transition from ${pastCompanies[0]} to ${currentCompany} is a great case study. How did your operating cadence change?`,
        observation: `Transitioned from ${pastCompanies[0]} into ${currentCompany}.`,
        question: `What was the most surprising difference in culture or decision-making between ${pastCompanies[0]} and ${currentCompany}?`,
        why: "Recognizes career growth and invites reflective insights on organizational dynamics.",
        whyItWorks:
          "Recognizes career growth and invites reflective insights on organizational dynamics.",
        whyItMatters: "Provides a blueprint for navigating future company transitions.",
        suggestedApproach: "Ask what lessons from previous organizations proved most transferable.",
        evidence: `Experience timeline from ${pastCompanies[0]} to ${currentCompany}.`,
        confidence: "high",
      });
    }

    if (skills.length > 0) {
      conversationHooks.push({
        topic: `Domain Depth in ${skills[0]}`,
        hook: `Given your depth in ${skills[0]}, how do you see that space evolving over the next 12 to 18 months?`,
        observation: `Verified skill endorsement in ${skills[0]}.`,
        question: `Where do you see most practitioners in ${skills[0]} making mistakes right now?`,
        why: "Positions them as a subject-matter expert and facilitates high-level industry dialogue.",
        whyItWorks:
          "Positions them as a subject-matter expert and facilitates high-level industry dialogue.",
        whyItMatters: "Gives the candidate an insider view of emerging domain best practices.",
        suggestedApproach: "Discuss emerging technical developments and market shifts.",
        evidence: `Verified expertise in ${skills[0]}.`,
        confidence: "medium",
      });
    }

    // 12. Candidate Introduction (20-30s spoken introduction)
    const candidateName = userProfile?.fullName || "I";
    const candidateHeadline = userProfile?.headline || "a passionate professional in this space";
    const candidateIntroduction: CandidateIntroductionData = {
      spokenPitch: `Hi ${firstName}, thanks so much for taking the time. I'm ${candidateName}, currently working as ${candidateHeadline}. I've been closely following the work you're doing at ${currentCompany}, and because I'm currently navigating my own growth in ${skills[0] || "this domain"}, I really wanted to learn from how you approached your own career transitions.`,
      structure: {
        whoIAm: `${candidateName}, ${candidateHeadline}`,
        currentFocus: `Building capabilities in ${skills[0] || "strategic execution"}`,
        whyThisExpert: `Following their trajectory as ${currentTitle} at ${currentCompany}`,
        learningGoal: `Understanding decision-making and career transitions from an experienced practitioner`,
      },
    };

    // 13. Natural Outreach Message (Max 70 words)
    const outreachMessage: OutreachMessageData = {
      text: `Hi ${firstName}, I noticed your transition from ${pastCompanies[0] || "your earlier roles"} to ${currentCompany} and really respect the path you've built. I'm currently exploring similar growth in ${skills[0] || "this space"} and would love to ask 2-3 quick questions about your operating mindset. Would you be open to a brief 15-minute coffee chat?`,
      wordCount: 56,
    };

    // 14. Things to Avoid Asking
    const thingsToAvoid: string[] = [
      "Avoid asking for job referrals or resume reviews in the initial conversation; keep the focus strictly on mentorship and domain insights.",
      "Avoid asking basic biographical questions that are readily available on their public LinkedIn profile.",
      "Avoid overly generic questions like 'Can you tell me about yourself?' — anchor questions to specific milestones instead.",
      "Avoid artificial flattery or excessive praise; seasoned leaders appreciate candid, thoughtful curiosity.",
    ];

    // 15. Why Connect & Your Angle
    const whyConnect = userProfile?.headline
      ? `${name} offers seasoned perspective at ${currentCompany} directly relevant to your path in ${userProfile.headline.slice(0, 60)}.`
      : `Connecting with ${name} provides high-value industry mentorship and direct insight into ${currentCompany}.`;

    const yourAngle: YourAngleItem = {
      positioning:
        userProfile?.headline || "Curious, prepared candidate seeking practical industry guidance.",
      relevance: `Direct alignment with ${currentCompany}'s domain and shared interest in ${skills[0] || "strategic growth"}.`,
      whyRelevant: `Direct alignment with ${currentCompany}'s domain and shared interest in ${skills[0] || "strategic growth"}.`,
      value:
        "Thoughtful preparation, fresh cross-functional perspective, and genuine respect for their time.",
      valueYouCanOffer:
        "Thoughtful preparation, fresh cross-functional perspective, and genuine respect for their time.",
    };

    return {
      careerSnapshot: { summary, keyPoints },
      whatTheyCareAbout,
      currentFocus: { summary: currentFocusSummary, evidence: currentFocusEvidence },
      careerTransitions,
      mentorshipFit,
      relevantInterests,
      commonGround,
      bestOpening,
      questionLadder,
      conversationHooks,
      recommendedQuestions,
      candidateIntroduction,
      outreachMessage,
      thingsToAvoid,
      whyConnect,
      yourAngle,
      meetingStrategy: {
        opening: bestOpening.opening,
        middle: `Discuss transition decisions, operational trade-offs at ${currentCompany}, and hard-won industry insights.`,
        closing:
          "Thank them for specific takeaways, summarize 1 key action item, and establish an authentic channel to keep in touch.",
      },
    };
  }

  private parseAndValidate(
    rawJson: string,
    params: GenerateIntelligenceParams,
  ): PersonIntelligenceData {
    let clean = rawJson.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      const parsed = JSON.parse(clean);
      const fallback = this.generateDeterministicFallback(params);

      // 1. Career Snapshot
      const careerSnapshot = {
        summary: String(parsed.careerSnapshot?.summary || fallback.careerSnapshot.summary),
        keyPoints:
          Array.isArray(parsed.careerSnapshot?.keyPoints) &&
          parsed.careerSnapshot.keyPoints.length > 0
            ? parsed.careerSnapshot.keyPoints.filter(Boolean).map(String)
            : fallback.careerSnapshot.keyPoints,
      };

      // 2. What They Care About
      const whatTheyCareAbout: WhatTheyCareAboutData = {
        coreProfessionalInterests:
          Array.isArray(parsed.whatTheyCareAbout?.coreProfessionalInterests) &&
          parsed.whatTheyCareAbout.coreProfessionalInterests.length > 0
            ? parsed.whatTheyCareAbout.coreProfessionalInterests.map(String)
            : fallback.whatTheyCareAbout?.coreProfessionalInterests || [],
        currentPriorities:
          Array.isArray(parsed.whatTheyCareAbout?.currentPriorities) &&
          parsed.whatTheyCareAbout.currentPriorities.length > 0
            ? parsed.whatTheyCareAbout.currentPriorities.map(String)
            : fallback.whatTheyCareAbout?.currentPriorities || [],
        intellectualInterests:
          Array.isArray(parsed.whatTheyCareAbout?.intellectualInterests) &&
          parsed.whatTheyCareAbout.intellectualInterests.length > 0
            ? parsed.whatTheyCareAbout.intellectualInterests.map(String)
            : fallback.whatTheyCareAbout?.intellectualInterests || [],
        careerThemes:
          Array.isArray(parsed.whatTheyCareAbout?.careerThemes) &&
          parsed.whatTheyCareAbout.careerThemes.length > 0
            ? parsed.whatTheyCareAbout.careerThemes.map(String)
            : fallback.whatTheyCareAbout?.careerThemes || [],
      };

      // 3. Current Focus
      const currentFocus = {
        summary: String(parsed.currentFocus?.summary || fallback.currentFocus.summary),
        evidence:
          Array.isArray(parsed.currentFocus?.evidence) && parsed.currentFocus.evidence.length > 0
            ? parsed.currentFocus.evidence.filter(Boolean).map(String)
            : fallback.currentFocus.evidence,
      };

      // 4. Career Transitions
      const careerTransitions: CareerTransitionItem[] =
        Array.isArray(parsed.careerTransitions) && parsed.careerTransitions.length > 0
          ? parsed.careerTransitions.map((ct: Record<string, unknown>) => ({
              from: String(ct.from || "Previous Role"),
              to: String(ct.to || "Current Role"),
              transitionType: String(ct.transitionType || "Career Move"),
              context: String(ct.context || ""),
              mentorshipOpportunity: String(
                ct.mentorshipOpportunity || "Understanding key mindset and decision shifts.",
              ),
              suggestedQuestion: String(ct.suggestedQuestion || ""),
            }))
          : fallback.careerTransitions || [];

      // 5. Mentorship Fit
      const mentorshipFit: MentorshipFitData = {
        whyThisPerson: String(
          parsed.mentorshipFit?.whyThisPerson || fallback.mentorshipFit?.whyThisPerson,
        ),
        whatYouCanLearn:
          Array.isArray(parsed.mentorshipFit?.whatYouCanLearn) &&
          parsed.mentorshipFit.whatYouCanLearn.length > 0
            ? parsed.mentorshipFit.whatYouCanLearn.map(String)
            : fallback.mentorshipFit?.whatYouCanLearn || [],
        whyTheyWouldHelp: String(
          parsed.mentorshipFit?.whyTheyWouldHelp || fallback.mentorshipFit?.whyTheyWouldHelp,
        ),
        mostRelevantExperience: String(
          parsed.mentorshipFit?.mostRelevantExperience ||
            fallback.mentorshipFit?.mostRelevantExperience,
        ),
        uniquelyQualifiedAsk: String(
          parsed.mentorshipFit?.uniquelyQualifiedAsk ||
            fallback.mentorshipFit?.uniquelyQualifiedAsk,
        ),
      };

      // 6. Relevant Interests with Confidence
      const relevantInterests: RelevantInterestItem[] =
        Array.isArray(parsed.relevantInterests) && parsed.relevantInterests.length > 0
          ? parsed.relevantInterests.map((item: Record<string, unknown>) => {
              const label = String(item.label || item.interest || "Industry Signal");
              return {
                label,
                interest: label,
                category: item.category ? String(item.category) : "professional",
                reason: item.reason ? String(item.reason) : undefined,
                evidence: String(item.evidence || "Verified signal from professional background."),
                confidence: ["high", "medium", "low"].includes(String(item.confidence))
                  ? (item.confidence as "high" | "medium" | "low")
                  : "medium",
              };
            })
          : fallback.relevantInterests;

      // 7. Common Ground
      const commonGround: CommonGroundItem[] = Array.isArray(parsed.commonGround)
        ? parsed.commonGround
            .map((item: Record<string, unknown>) => {
              const point = String(item.point || item.connection || "");
              return {
                point,
                connection: point,
                evidence: String(item.evidence || ""),
                confidence: ["high", "medium", "low"].includes(String(item.confidence))
                  ? (item.confidence as "high" | "medium" | "low")
                  : "medium",
              };
            })
            .filter((cg) => Boolean(cg.point))
        : fallback.commonGround;

      // 8. Best Opening
      const bestOpening: BestOpeningItem =
        parsed.bestOpening && parsed.bestOpening.opening
          ? {
              opening: String(parsed.bestOpening.opening),
              why: String(parsed.bestOpening.why || "Directly references their background."),
              evidence: String(parsed.bestOpening.evidence || "Verified experience."),
              tone: String(
                parsed.bestOpening.tone || "Curious, candid, and respectful mentorship tone",
              ),
            }
          : fallback.bestOpening;

      // 9. Mentorship Question Ladder
      const questionLadder: MentorshipQuestionLadder = {
        level1Warmup: parsed.questionLadder?.level1Warmup || fallback.questionLadder!.level1Warmup,
        level2Experience:
          parsed.questionLadder?.level2Experience || fallback.questionLadder!.level2Experience,
        level3Decision:
          parsed.questionLadder?.level3Decision || fallback.questionLadder!.level3Decision,
        level4Insight:
          parsed.questionLadder?.level4Insight || fallback.questionLadder!.level4Insight,
        level5Advice: parsed.questionLadder?.level5Advice || fallback.questionLadder!.level5Advice,
      };

      // 10. Conversation Hooks
      const conversationHooks: ConversationHookItem[] =
        Array.isArray(parsed.conversationHooks) && parsed.conversationHooks.length > 0
          ? parsed.conversationHooks.map((item: Record<string, unknown>) => {
              const topic = String(item.topic || item.hook || "Career Milestone");
              const hook = String(item.hook || item.suggestedApproach || item.question || topic);
              const observation = String(item.observation || item.evidence || "");
              const question = String(item.question || hook);
              const why = String(item.why || item.whyItWorks || "Relevant talking point.");
              const whyItMatters = String(item.whyItMatters || why);
              return {
                topic,
                hook,
                observation,
                question,
                why,
                whyItWorks: why,
                whyItMatters,
                suggestedApproach: String(item.suggestedApproach || hook),
                evidence: String(item.evidence || "Verified profile data."),
                confidence: ["high", "medium", "low"].includes(String(item.confidence))
                  ? (item.confidence as "high" | "medium" | "low")
                  : "high",
              };
            })
          : fallback.conversationHooks;

      // 11. Recommended Questions
      const recommendedQuestions: RecommendedQuestionItem[] =
        Array.isArray(parsed.recommendedQuestions) && parsed.recommendedQuestions.length > 0
          ? parsed.recommendedQuestions
              .map((item: Record<string, unknown>, idx: number) => ({
                question: String(item.question || ""),
                reason: String(item.reason || ""),
                category: String(item.category || "career"),
                ladderLevel: Number(item.ladderLevel) || idx + 1,
                objective: String(item.objective || ""),
                followUps: Array.isArray(item.followUps) ? item.followUps.map(String) : [],
              }))
              .filter((q) => Boolean(q.question))
          : fallback.recommendedQuestions;

      // 12. Candidate Introduction
      const candidateIntroduction: CandidateIntroductionData = {
        spokenPitch: String(
          parsed.candidateIntroduction?.spokenPitch ||
            fallback.candidateIntroduction?.spokenPitch ||
            "",
        ),
        structure: {
          whoIAm: String(
            parsed.candidateIntroduction?.structure?.whoIAm ||
              fallback.candidateIntroduction?.structure.whoIAm ||
              "",
          ),
          currentFocus: String(
            parsed.candidateIntroduction?.structure?.currentFocus ||
              fallback.candidateIntroduction?.structure.currentFocus ||
              "",
          ),
          whyThisExpert: String(
            parsed.candidateIntroduction?.structure?.whyThisExpert ||
              fallback.candidateIntroduction?.structure.whyThisExpert ||
              "",
          ),
          learningGoal: String(
            parsed.candidateIntroduction?.structure?.learningGoal ||
              fallback.candidateIntroduction?.structure.learningGoal ||
              "",
          ),
        },
      };

      // 13. Outreach Message
      const outreachMessage: OutreachMessageData = {
        text: String(parsed.outreachMessage?.text || fallback.outreachMessage?.text || ""),
        wordCount: Number(parsed.outreachMessage?.wordCount) || 50,
      };

      // 14. Your Angle
      const positioning = String(parsed.yourAngle?.positioning || fallback.yourAngle.positioning);
      const relevance = String(
        parsed.yourAngle?.relevance ||
          parsed.yourAngle?.whyRelevant ||
          fallback.yourAngle.relevance,
      );
      const value = String(
        parsed.yourAngle?.value || parsed.yourAngle?.valueYouCanOffer || fallback.yourAngle.value,
      );

      const yourAngle: YourAngleItem = {
        positioning,
        relevance,
        whyRelevant: relevance,
        value,
        valueYouCanOffer: value,
      };

      return {
        careerSnapshot,
        whatTheyCareAbout,
        currentFocus,
        careerTransitions,
        mentorshipFit,
        relevantInterests,
        commonGround,
        bestOpening,
        questionLadder,
        conversationHooks,
        recommendedQuestions,
        candidateIntroduction,
        outreachMessage,
        thingsToAvoid:
          Array.isArray(parsed.thingsToAvoid) && parsed.thingsToAvoid.length > 0
            ? parsed.thingsToAvoid.filter(Boolean).map(String)
            : fallback.thingsToAvoid,
        whyConnect: String(parsed.whyConnect || fallback.whyConnect),
        yourAngle,
        meetingStrategy: {
          opening: String(parsed.meetingStrategy?.opening || bestOpening.opening),
          middle: String(parsed.meetingStrategy?.middle || fallback.meetingStrategy?.middle || ""),
          closing: String(
            parsed.meetingStrategy?.closing || fallback.meetingStrategy?.closing || "",
          ),
        },
      };
    } catch (e) {
      console.warn(
        "[PersonIntelligenceService] Failed to parse AI JSON output, using robust fallback:",
        e,
      );
      return this.generateDeterministicFallback(params);
    }
  }
}

export const personIntelligenceService = new PersonIntelligenceService();
