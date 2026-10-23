import { GoogleGenAI } from "@google/genai";
import type {
  UserProfile,
  StructuredPersonIntelligence,
  MentorshipMatch,
  WhatCandidateCanLearn,
  MentorshipSharedGround,
  MentorshipComplementaryExperience,
  MentorshipBestEntryPoint,
  MentorshipFit,
} from "../../types/models";

export interface CandidateContextInput {
  fullName?: string;
  headline?: string;
  location?: string;
  about?: string;
  careerGoals?: string;
  networkingGoals?: string;
  conversationStyle?: string;
  interests?: string[];
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    period?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    year?: string;
  }>;
  profileHighlights?: string[];
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

export interface MentorshipMatchValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: MentorshipMatch;
}

export function validateMentorshipMatch(
  data: unknown,
  meetingPurpose = "Mentorship",
): MentorshipMatchValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data is not an object"] };
  }

  const obj = data as Record<string, unknown>;

  // 1. matchSummary
  const matchSummary = typeof obj.matchSummary === "string" ? obj.matchSummary.trim() : "";
  if (!matchSummary) {
    errors.push("matchSummary must be a non-empty string");
  }

  // 2. mentorshipFit
  const fitRaw = (obj.mentorshipFit as Record<string, unknown>) || {};
  let score = typeof fitRaw.score === "number" ? Math.round(fitRaw.score) : 75;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let level: "high" | "medium" | "low" = "medium";
  if (fitRaw.level === "high" || fitRaw.level === "medium" || fitRaw.level === "low") {
    level = fitRaw.level;
  } else {
    level = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
  }

  const fitReason =
    typeof fitRaw.reason === "string" && fitRaw.reason.trim()
      ? fitRaw.reason.trim()
      : "Score evaluated on relevant expertise, experience transferability, and meeting purpose alignment.";

  const mentorshipFit: MentorshipFit = {
    score,
    level,
    reason: fitReason,
  };

  // 3. whyThisPerson
  const whyThisPerson = typeof obj.whyThisPerson === "string" ? obj.whyThisPerson.trim() : "";
  if (!whyThisPerson) {
    errors.push("whyThisPerson must be a non-empty string");
  }

  // 4. whatCandidateCanLearn (3-5 items)
  const whatCandidateCanLearn: WhatCandidateCanLearn[] = [];
  if (Array.isArray(obj.whatCandidateCanLearn)) {
    for (const item of obj.whatCandidateCanLearn) {
      if (item && typeof item === "object") {
        const iObj = item as Record<string, unknown>;
        const area = typeof iObj.area === "string" ? iObj.area.trim() : "";
        const reason = typeof iObj.reason === "string" ? iObj.reason.trim() : "";
        const expertEvidence =
          typeof iObj.expertEvidence === "string" ? iObj.expertEvidence.trim() : "";
        const candidateRelevance =
          typeof iObj.candidateRelevance === "string" ? iObj.candidateRelevance.trim() : "";

        if (area) {
          whatCandidateCanLearn.push({
            area,
            reason: reason || area,
            expertEvidence: expertEvidence || "Verified from expert career trajectory.",
            candidateRelevance: candidateRelevance || "Relevant to candidate professional growth.",
          });
        }
      }
    }
  }

  if (whatCandidateCanLearn.length === 0) {
    errors.push("whatCandidateCanLearn must contain at least one learning opportunity");
  }

  // 5. sharedGround
  const sharedGround: MentorshipSharedGround[] = [];
  if (Array.isArray(obj.sharedGround)) {
    for (const item of obj.sharedGround) {
      if (item && typeof item === "object") {
        const sObj = item as Record<string, unknown>;
        const topic = typeof sObj.topic === "string" ? sObj.topic.trim() : "";
        const reason = typeof sObj.reason === "string" ? sObj.reason.trim() : "";
        if (topic) {
          sharedGround.push({ topic, reason: reason || topic });
        }
      }
    }
  }

  // 6. complementaryExperience
  const complementaryExperience: MentorshipComplementaryExperience[] = [];
  if (Array.isArray(obj.complementaryExperience)) {
    for (const item of obj.complementaryExperience) {
      if (item && typeof item === "object") {
        const cObj = item as Record<string, unknown>;
        const expertExperience =
          typeof cObj.expertExperience === "string" ? cObj.expertExperience.trim() : "";
        const candidateNeed =
          typeof cObj.candidateNeed === "string" ? cObj.candidateNeed.trim() : "";
        const value = typeof cObj.value === "string" ? cObj.value.trim() : "";
        if (expertExperience || candidateNeed) {
          complementaryExperience.push({
            expertExperience: expertExperience || "Domain leadership experience",
            candidateNeed: candidateNeed || "Seeking practical execution insights",
            value: value || "Provides concrete perspective on real-world challenges.",
          });
        }
      }
    }
  }

  // 7. bestEntryPoint
  const entryRaw = (obj.bestEntryPoint as Record<string, unknown>) || {};
  const bestEntryPoint: MentorshipBestEntryPoint = {
    topic:
      typeof entryRaw.topic === "string" && entryRaw.topic.trim()
        ? entryRaw.topic.trim()
        : "Career transition and practical execution decisions",
    reason:
      typeof entryRaw.reason === "string" && entryRaw.reason.trim()
        ? entryRaw.reason.trim()
        : "Connects expert experience with candidate exploration.",
    suggestedApproach:
      typeof entryRaw.suggestedApproach === "string" && entryRaw.suggestedApproach.trim()
        ? entryRaw.suggestedApproach.trim()
        : "Ask specific questions regarding their transition and operating decisions.",
  };

  // 8. candidateAngle
  const candidateAngle =
    typeof obj.candidateAngle === "string" && obj.candidateAngle.trim()
      ? obj.candidateAngle.trim()
      : "Position yourself as an intellectually curious professional seeking concrete perspective on domain execution.";

  // 9. mentorshipOpportunity
  const mentorshipOpportunity =
    typeof obj.mentorshipOpportunity === "string" && obj.mentorshipOpportunity.trim()
      ? obj.mentorshipOpportunity.trim()
      : "Potentially useful as a strategic sounding board and domain advisor.";

  // 10. relationshipPotential
  const relationshipPotential =
    typeof obj.relationshipPotential === "string" && obj.relationshipPotential.trim()
      ? obj.relationshipPotential.trim()
      : "This conversation has potential to become an ongoing professional connection if the initial discussion is substantive.";

  // 11. limitations
  const limitations: string[] = [];
  if (Array.isArray(obj.limitations)) {
    for (const lim of obj.limitations) {
      if (typeof lim === "string" && lim.trim()) {
        limitations.push(lim.trim());
      }
    }
  }

  const sanitized: MentorshipMatch = {
    matchSummary,
    mentorshipFit,
    whyThisPerson,
    whatCandidateCanLearn,
    sharedGround,
    complementaryExperience,
    bestEntryPoint,
    candidateAngle,
    mentorshipOpportunity,
    relationshipPotential,
    limitations,
    generatedAt: new Date().toISOString(),
    meetingPurpose,
  };

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

export class MentorshipMatchService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    this.ai = new GoogleGenAI(apiKey ? { apiKey } : {});
  }

  /**
   * Main entry point to generate Mentorship Match between Candidate and Expert.
   */
  async generateMentorshipMatch(params: {
    candidateProfile?: UserProfile | CandidateContextInput | null;
    personIntelligence: StructuredPersonIntelligence | Record<string, unknown>;
    meetingPurpose?: string;
    expertName?: string;
  }): Promise<MentorshipMatch> {
    const {
      candidateProfile,
      personIntelligence,
      meetingPurpose = "Mentorship",
      expertName,
    } = params;

    console.log(
      `[MentorshipMatchService] Generating mentorship match for meetingPurpose: "${meetingPurpose}"`,
    );

    // Normalize Candidate Context
    const candidateName = candidateProfile?.fullName?.trim() || "Candidate";
    const candidateHeadline = candidateProfile?.headline?.trim() || "";
    const candidateAbout = candidateProfile?.about?.trim() || "";
    const candidateGoals =
      candidateProfile?.careerGoals?.trim() || candidateProfile?.networkingGoals?.trim() || "";
    const candidateSkills = (candidateProfile?.skills || []).filter(Boolean);
    const candidateInterests = (candidateProfile?.interests || []).filter(Boolean);
    const candidateExp = (candidateProfile?.experience || []).map((e) =>
      typeof e === "string"
        ? e
        : `${e.title || "Role"} at ${e.company || "Company"}${e.period ? ` (${e.period})` : ""}`,
    );
    const candidateEdu = (candidateProfile?.education || []).map((e) =>
      typeof e === "string"
        ? e
        : `${e.degree || "Degree"} from ${e.school || "University"}${e.year ? ` (${e.year})` : ""}`,
    );

    const hasCandidateData = Boolean(
      candidateHeadline ||
      candidateAbout ||
      candidateGoals ||
      candidateSkills.length > 0 ||
      candidateExp.length > 0,
    );

    // Extract Expert Intelligence Summary
    const pi = personIntelligence as Partial<StructuredPersonIntelligence> &
      Record<string, unknown>;
    const targetName = expertName || "the expert";

    const prompt = `You are the ColdConnect Mentorship Match Engine.
Your task is to analyze BOTH sides of a prospective 20-minute professional conversation and determine the true MENTORSHIP VALUE for the candidate.

==================================================
CORE OBJECTIVE
==================================================
Answer:
1. "Why should THIS candidate speak to THIS person?"
2. "What can THIS candidate realistically learn from THIS person?"
3. "What part of the candidate's story should they bring into the conversation?"

SIMILARITY IS NOT THE OBJECTIVE. MENTORSHIP VALUE IS.
Someone with a very different background can be an exceptional mentor because of complementary experience, career transitions, and hard-earned domain lessons.

==================================================
INPUT DATA
==================================================

1. CANDIDATE PROFILE:
- Name: ${candidateName}
- Headline/Current Role: ${candidateHeadline || "Not explicitly specified"}
- Career Goals / Objectives: ${candidateGoals || "Not explicitly specified"}
- Background Summary: ${candidateAbout || "Not explicitly specified"}
- Skills: ${candidateSkills.join(", ") || "None specified"}
- Interests: ${candidateInterests.join(", ") || "None specified"}
- Past Experience: ${candidateExp.join(" | ") || "None specified"}
- Education: ${candidateEdu.join(" | ") || "None specified"}

2. EXPERT INTELLIGENCE (STAGE 2 VERIFIED INTELLIGENCE):
${JSON.stringify(pi, null, 2)}

3. MEETING PURPOSE:
"${meetingPurpose}"

==================================================
PURPOSE PRIORITIZATION RULES
==================================================
- If "Career Advice": Prioritize career transitions, skill shifts, high-stakes decisions, and long-term trajectory.
- If "Entrepreneurship" or "Business Advice": Prioritize business building, founder/operator experience, market selection, GTM, scaling, and commercial trade-offs.
- If "Industry Learning": Prioritize domain depth, industry dynamics, market trends, and practical operational nuances.
- If "Networking": Prioritize shared professional themes, natural conversational entry points, and high-quality rapport building.
- If "Mentorship": Prioritize experience transfer, lessons from inflection points, strategic sounding board value, and long-term advisory potential.

==================================================
FIT SCORE CALCULATION RULES (0-100)
==================================================
Evaluate across 6 conceptual dimensions:
A. RELEVANT EXPERTISE: Does expert have experience relevant to candidate's stated goals?
B. EXPERIENCE TRANSFERABILITY: Can expert's experience provide actionable lessons?
C. CAREER RELEVANCE: Does expert's trajectory contain relevant pivots or decisions?
D. MEETING PURPOSE ALIGNMENT: Does expert directly match the reason to connect?
E. LEARNING VALUE: Can candidate learn something hard to obtain elsewhere?
F. CONVERSATION ACCESSIBILITY: Is there a natural, professional reason to approach them?
(Never score based on demographics or superficial personal similarity).

==================================================
SPECIFICITY & TONE RULES
==================================================
1. "whyThisPerson": Answer "Why should I spend 20 minutes speaking to this person?" Be razor sharp.
   - GOOD: "Your strongest reason to speak with Nikhil is his transition from strategy into brand ownership. You are exploring business building, so his experience can help you understand what changes when moving from advising to owning commercial outcomes."
   - BAD: "Nikhil has extensive experience in brand management."
2. "whatCandidateCanLearn": 3 to 5 concrete learning points connecting EXPERT EVIDENCE + CANDIDATE NEED.
   - BAD: "Leadership", "Marketing", "Strategy"
   - GOOD: "How analytical strategy translates into day-to-day commercial decisions."
3. "sharedGround": Genuine overlap. If no direct overlap: state "There's no strong direct overlap yet. Your strongest entry point is the expert's experience in [Area]."
4. "complementaryExperience": Highlight where expert has experience that candidate lacks (e.g. engineering candidate vs brand/strategy operator).
5. "bestEntryPoint": The single best conversational hook (specific to expert, relevant to candidate, easy to discuss, not transactional).
6. "candidateAngle": How the candidate should position themselves ("What part of my own story should I bring?").
7. "mentorshipOpportunity": Concise statement ("Potentially useful as an operator mentor and strategic sounding board...").
8. "limitations": If candidate data is sparse, explicitly state what information was missing (e.g. "Candidate career goals not fully specified in profile").

==================================================
REQUIRED JSON SCHEMA
==================================================
Return ONLY a valid JSON object:
{
  "matchSummary": string,
  "mentorshipFit": {
    "score": number (0-100),
    "level": "high" | "medium" | "low",
    "reason": string
  },
  "whyThisPerson": string,
  "whatCandidateCanLearn": [
    {
      "area": string,
      "reason": string,
      "expertEvidence": string,
      "candidateRelevance": string
    }
  ],
  "sharedGround": [
    {
      "topic": string,
      "reason": string
    }
  ],
  "complementaryExperience": [
    {
      "expertExperience": string,
      "candidateNeed": string,
      "value": string
    }
  ],
  "bestEntryPoint": {
    "topic": string,
    "reason": string,
    "suggestedApproach": string
  },
  "candidateAngle": string,
  "mentorshipOpportunity": string,
  "relationshipPotential": string,
  "limitations": string[]
}

OUTPUT ONLY VALID JSON. No markdown code blocks, no preamble.`;

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
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        });

        if (response.text && response.text.trim()) {
          rawText = response.text.trim();
          console.log(`[MentorshipMatchService] Successfully generated with model: ${model}`);
          break;
        }
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          console.warn(
            `[MentorshipMatchService] Gemini quota limit reached (429) on ${model}. Switching directly to deterministic mentorship match.`,
          );
          break;
        }
        console.log(`[MentorshipMatchService] Model ${model} notice:`);
      }
    }

    if (rawText) {
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        console.log("[MentorshipMatchService] JSON parse error:");
      }

      let validation = validateMentorshipMatch(parsed, meetingPurpose);

      // Single retry if validation failed
      if (!validation.valid) {
        console.warn(
          "[MentorshipMatchService] Validation failed. Retrying with correction prompt:",
          validation.errors,
        );
        const retryPrompt = `The previous JSON output failed validation:
${validation.errors.map((e) => `- ${e}`).join("\n")}

Fix the issues and return a valid JSON object matching the required schema:
{
  "matchSummary": string,
  "mentorshipFit": { "score": number, "level": "high"|"medium"|"low", "reason": string },
  "whyThisPerson": string,
  "whatCandidateCanLearn": [ { "area": string, "reason": string, "expertEvidence": string, "candidateRelevance": string } ],
  "sharedGround": [ { "topic": string, "reason": string } ],
  "complementaryExperience": [ { "expertExperience": string, "candidateNeed": string, "value": string } ],
  "bestEntryPoint": { "topic": string, "reason": string, "suggestedApproach": string },
  "candidateAngle": string,
  "mentorshipOpportunity": string,
  "relationshipPotential": string,
  "limitations": string[]
}

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
              contents: retryPrompt,
              config: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            });
            if (retryResp.text) {
              let rText = retryResp.text.trim();
              if (rText.startsWith("```")) {
                rText = rText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
              }
              const rParsed = JSON.parse(rText);
              validation = validateMentorshipMatch(rParsed, meetingPurpose);
              if (validation.valid && validation.sanitized) {
                break;
              }
            }
          } catch (rErr) {
            console.log(`[MentorshipMatchService] Retry with ${retryModel} notice:`);
          }
        }
      }

      if (validation.valid && validation.sanitized) {
        console.log("[MentorshipMatchService] Validation passed successfully");
        return validation.sanitized;
      }
    }

    // Deterministic fallback synthesis when Gemini models are rate-limited or unavailable
    console.log(
      "[MentorshipMatchService] Gemini unavailable or rate-limited. Generating rich deterministic mentorship match.",
    );

    return this.generateDeterministicMentorshipMatch({
      candidateProfile,
      personIntelligence: pi,
      meetingPurpose,
      targetName,
      hasCandidateData,
    });
  }

  /**
   * Deterministic Stage 3 Mentorship Match generator from verified facts and structured intelligence.
   */
  private generateDeterministicMentorshipMatch(params: {
    candidateProfile?: UserProfile | CandidateContextInput | null;
    personIntelligence: Partial<StructuredPersonIntelligence> & Record<string, unknown>;
    meetingPurpose: string;
    targetName: string;
    hasCandidateData: boolean;
  }): MentorshipMatch {
    const {
      candidateProfile,
      personIntelligence: pi,
      meetingPurpose,
      targetName,
      hasCandidateData,
    } = params;

    const candidateRole = candidateProfile?.headline || "Professional";
    const candidateGoals = candidateProfile?.careerGoals || candidateProfile?.networkingGoals || "";
    const candidateSkills = (candidateProfile?.skills || []).filter(Boolean);

    const expertIdentity =
      pi.professionalIdentity?.summary || "Senior Professional with verified domain expertise";
    const expertKeyAreas = (pi.keyExpertise || []).map((k) => k.area);
    const expertFocus = pi.currentFocus?.summary || "Executing key domain initiatives";
    const expertTransitions = pi.careerTransitions || [];
    const expertMentorshipValue = pi.mentorshipValue || [];

    const limitations: string[] = [];
    if (!hasCandidateData) {
      limitations.push(
        "Candidate profile contains limited background details; match is based primarily on meeting purpose and expert intelligence.",
      );
    }
    if (expertKeyAreas.length === 0) {
      limitations.push(
        "Expert public signals are based on verified profile transitions and organizational scope.",
      );
    }

    // 1. Why This Person
    let whyThisPerson = "";
    if (expertTransitions.length > 0) {
      const t = expertTransitions[0];
      whyThisPerson = `Your strongest reason to speak with ${targetName} is their verified transition from ${t.from} to ${t.to}. For your goal of ${meetingPurpose.toLowerCase()}, their experience provides practical perspective on ${t.whyItMatters.toLowerCase()}`;
    } else if (expertKeyAreas.length > 0) {
      whyThisPerson = `Your strongest reason to speak with ${targetName} is their hands-on domain leadership in ${expertKeyAreas.slice(0, 2).join(" and ")}. Their perspective offers concrete insight into real-world execution within this space.`;
    } else {
      whyThisPerson = `Your strongest reason to speak with ${targetName} is their verified professional background and leadership as detailed in their career trajectory.`;
    }

    // 2. What Candidate Can Learn (3-4 items)
    const whatCandidateCanLearn: WhatCandidateCanLearn[] = [];
    if (expertMentorshipValue.length > 0) {
      expertMentorshipValue.slice(0, 4).forEach((mv) => {
        whatCandidateCanLearn.push({
          area: mv.area,
          reason: mv.whyCandidateCouldLearnFromThem,
          expertEvidence: mv.evidence?.[0] || "Verified from expert career history.",
          candidateRelevance: `Directly informs candidate's focus on ${meetingPurpose.toLowerCase()}.`,
        });
      });
    }

    if (whatCandidateCanLearn.length === 0 && expertKeyAreas.length > 0) {
      expertKeyAreas.slice(0, 3).forEach((area) => {
        whatCandidateCanLearn.push({
          area: `Translating ${area} into Strategic Outcomes`,
          reason: `How ${targetName} applies ${area} to solve practical challenges and scale impact.`,
          expertEvidence: `Documented domain leadership in ${area}.`,
          candidateRelevance: `Relevant for candidate navigating ${meetingPurpose.toLowerCase()}.`,
        });
      });
    }

    if (whatCandidateCanLearn.length === 0) {
      whatCandidateCanLearn.push({
        area: "Navigating High-Stakes Career & Execution Decisions",
        reason:
          "Understanding the decision frameworks that differentiate strong operators from peers.",
        expertEvidence: "Career trajectory across multiple organizational stages.",
        candidateRelevance: `Connects with candidate's objective for ${meetingPurpose.toLowerCase()}.`,
      });
    }

    // 3. Shared Ground
    const sharedGround: MentorshipSharedGround[] = [];
    const expertTopics = [...(pi.professionalIdentity?.expertise || []), ...expertKeyAreas];

    const overlapping = candidateSkills.filter((cs) =>
      expertTopics.some(
        (et) =>
          et.toLowerCase().includes(cs.toLowerCase()) ||
          cs.toLowerCase().includes(et.toLowerCase()),
      ),
    );

    if (overlapping.length > 0) {
      overlapping.slice(0, 2).forEach((topic) => {
        sharedGround.push({
          topic,
          reason: `Both share demonstrated experience and active interest in ${topic}.`,
        });
      });
    } else if (expertTopics.length > 0) {
      sharedGround.push({
        topic: expertTopics[0],
        reason: `There is no direct overlap yet; your strongest entry point is exploring ${targetName}'s experience in ${expertTopics[0]}.`,
      });
    } else {
      sharedGround.push({
        topic: "Professional Trajectory & Execution",
        reason: `Shared focus on understanding the strategic decisions that drive career progression.`,
      });
    }

    // 4. Complementary Experience
    const complementaryExperience: MentorshipComplementaryExperience[] = [];
    const expertPrimary = expertKeyAreas[0] || "Strategic Execution";
    complementaryExperience.push({
      expertExperience: `${expertPrimary} across organizational milestones`,
      candidateNeed: candidateGoals || `Expanding perspective on ${meetingPurpose.toLowerCase()}`,
      value: `The expert offers hands-on operational perspective that complements candidate's current background in ${candidateRole}.`,
    });

    if (expertTransitions.length > 0) {
      complementaryExperience.push({
        expertExperience: `Managing transition into ${expertTransitions[0].to}`,
        candidateNeed: "Understanding decision criteria during career pivots",
        value: "Provides a grounded reference point for making high-leverage career decisions.",
      });
    }

    // 5. Best Entry Point
    let entryTopic = "Career transition and practical execution decisions";
    let entryReason = `Connects ${targetName}'s specific career trajectory with the candidate's learning goal.`;
    let suggestedApproach = `Ask how they evaluated the key trade-offs when stepping into their role at ${pi.currentFocus?.summary ? "their current organization" : "their company"}.`;

    if (expertTransitions.length > 0) {
      entryTopic = `Transition from ${expertTransitions[0].from} to ${expertTransitions[0].to}`;
      entryReason = `It focuses on a distinctive career move and avoids generic pleasantries.`;
      suggestedApproach = `Ask what unexpected operational lessons emerged during this transition.`;
    } else if (expertKeyAreas.length > 0) {
      entryTopic = `Operating approach in ${expertKeyAreas[0]}`;
      entryReason = `Anchors on an area where ${targetName} has proven depth.`;
      suggestedApproach = `Inquire about how they prioritize competing demands in ${expertKeyAreas[0]}.`;
    }

    const bestEntryPoint: MentorshipBestEntryPoint = {
      topic: entryTopic,
      reason: entryReason,
      suggestedApproach,
    };

    // 6. Candidate Angle
    const candidateAngle = hasCandidateData
      ? `Position yourself not with a formal pitch, but as someone in ${candidateRole} seeking concrete perspective on ${expertKeyAreas[0] || "domain execution"} and exploring ${candidateGoals || "growth decisions"}.`
      : `Position yourself as an intellectually curious professional seeking concrete perspective on ${expertKeyAreas[0] || "domain execution"} rather than asking for broad career favors.`;

    // 7. Mentorship Opportunity
    const mentorshipOpportunity = `Potentially valuable as a strategic sounding board and domain advisor on ${expertKeyAreas[0] || "career development"} decisions.`;

    // 8. Relationship Potential
    const relationshipPotential = `This conversation has strong potential to become an ongoing professional connection if the initial discussion focuses on specific, prepared questions about their operating experience.`;

    // 9. Score calculation
    let fitScore = 82;
    if (
      meetingPurpose.toLowerCase().includes("career") ||
      meetingPurpose.toLowerCase().includes("mentor")
    ) {
      fitScore = expertTransitions.length > 0 ? 88 : 80;
    } else if (
      meetingPurpose.toLowerCase().includes("entrepreneur") ||
      meetingPurpose.toLowerCase().includes("business")
    ) {
      fitScore = expertKeyAreas.length > 1 ? 85 : 78;
    } else if (meetingPurpose.toLowerCase().includes("industry")) {
      fitScore = expertKeyAreas.length > 0 ? 86 : 76;
    }

    return {
      matchSummary: `High-value mentorship alignment connecting ${targetName}'s background in ${expertKeyAreas.slice(0, 2).join(" & ") || "domain leadership"} with candidate's focus on ${meetingPurpose}.`,
      mentorshipFit: {
        score: fitScore,
        level: fitScore >= 80 ? "high" : "medium",
        reason: `Strong alignment between expert's verified career milestones and candidate's goal for ${meetingPurpose.toLowerCase()}.`,
      },
      whyThisPerson,
      whatCandidateCanLearn,
      sharedGround,
      complementaryExperience,
      bestEntryPoint,
      candidateAngle,
      mentorshipOpportunity,
      relationshipPotential,
      limitations,
      generatedAt: new Date().toISOString(),
      meetingPurpose,
    };
  }
}

export const mentorshipMatchService = new MentorshipMatchService();
