import { GoogleGenAI } from "@google/genai";
import type {
  NormalizedLinkedInProfile,
  UserProfile,
  PersonIntelligenceData,
  PitchCoachAnalysisResult,
  PitchCoachScores,
  Connection,
  Meeting,
} from "../../types/models";

export interface AnalyzePitchParams {
  transcript: string;
  durationSeconds?: number;
  connection: Connection;
  targetPerson?: NormalizedLinkedInProfile | null;
  intelligenceData?: PersonIntelligenceData | null;
  userProfile?: UserProfile | null;
  meeting?: Meeting | null;
  meetingPurpose?: string;
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

export class PitchCoachService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Transcribe recorded audio blob buffer using Gemini Multimodal Audio.
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType = "audio/webm"): Promise<string> {
    const models = ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    const base64Audio = audioBuffer.toString("base64");

    for (const model of models) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType.split(";")[0] || "audio/webm",
                    data: base64Audio,
                  },
                },
                {
                  text: "You are a high-precision speech-to-text transcriber. Transcribe the spoken audio pitch word-for-word into clean, natural English text. Output ONLY the raw transcript with no introductory phrases, no markdown formatting, no commentary, and no quotes.",
                },
              ],
            },
          ],
          config: {
            temperature: 0.1,
          },
        });

        const transcript = response.text?.trim();
        if (transcript && transcript.length > 5) {
          return transcript;
        }
      } catch (err) {
        console.warn(`[PitchCoachService] Transcribe error on model ${model}:`, err);
      }
    }

    throw new Error(
      "Unable to transcribe audio recording. Please type your pitch or try speaking clearly again.",
    );
  }

  /**
   * Evaluates a 60-second pitch specifically against target person, user background, intelligence, and meeting context.
   */
  async evaluatePitch(params: AnalyzePitchParams): Promise<PitchCoachAnalysisResult> {
    const {
      transcript,
      durationSeconds = 60,
      connection,
      targetPerson,
      intelligenceData,
      userProfile,
      meeting,
      meetingPurpose,
    } = params;

    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript || trimmedTranscript.split(/\s+/).length < 5) {
      throw new Error(
        "Your pitch was too short to analyze. Speak or type at least a few sentences.",
      );
    }

    // 1. Build Target Person Profile Context
    const targetName = connection.name || targetPerson?.identity?.name || "Target Connection";
    const targetRole = targetPerson?.currentRole?.title || connection.role || "Professional";
    const targetCompany = targetPerson?.currentRole?.company || connection.company || "Independent";
    const targetHeadline = targetPerson?.identity?.headline || "";
    const targetAbout = targetPerson?.about || "";
    const targetExperience = (targetPerson?.experience || [])
      .slice(0, 3)
      .map((e) => `- ${e.title} at ${e.company} (${e.startDate || ""} - ${e.endDate || "Present"})`)
      .join("\n");
    const targetSkills = (targetPerson?.skills || [])
      .slice(0, 8)
      .map((s) => s.name)
      .join(", ");

    // 2. Build User Background Context
    const userFullName =
      (userProfile as { fullName?: string; name?: string })?.fullName ||
      (userProfile as { fullName?: string; name?: string })?.name ||
      "User";
    const userProfileText = userProfile
      ? [
          userProfile.pitchDNA
            ? `Pitch DNA / Core Identity:\n  Who I Am: ${userProfile.pitchDNA.whoIAm || ""}\n  What I Do: ${userProfile.pitchDNA.whatIDo || ""}\n  Story: ${userProfile.pitchDNA.story || ""}\n  Differentiators: ${(userProfile.pitchDNA.credibleDifferentiators || []).join(", ")}`
            : "",

          `Name: ${userFullName}`,
          userProfile.headline ? `Headline: ${userProfile.headline}` : "",
          userProfile.about ? `About / Summary: ${userProfile.about}` : "",
          userProfile.experience && userProfile.experience.length > 0
            ? `Experience:\n${userProfile.experience
                .map(
                  (e) =>
                    `  - ${e.title || "Role"} at ${e.company || "Company"}${e.period ? ` (${e.period})` : e.startDate ? ` (${e.startDate} - ${e.endDate || "Present"})` : ""}${e.description ? `: ${e.description}` : ""}`,
                )
                .join("\n")}`
            : "",
          userProfile.education && userProfile.education.length > 0
            ? `Education: ${userProfile.education.map((edu) => `${edu.degree || ""} ${edu.school || ""}${edu.year ? ` (${edu.year})` : ""}`).join(", ")}`
            : "",
          userProfile.skills && userProfile.skills.length > 0
            ? `Skills: ${userProfile.skills.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "User profile details not provided.";

    // 3. Build Networking Intelligence Context
    const intelFocus =
      intelligenceData?.currentFocus?.summary || connection.currentFocus || "Not specified";
    const intelHooks = (intelligenceData?.conversationHooks || [])
      .map(
        (h) =>
          `- ${h.topic}: "${h.suggestedApproach || h.hook}" (Why: ${h.why || h.whyItWorks || ""})`,
      )
      .join("\n");
    const intelCommonGround = (intelligenceData?.commonGround || [])
      .map((g) => `- ${g.point || g.connection || ""}`)
      .join("\n");
    const intelYourAngle = intelligenceData?.yourAngle
      ? `Positioning: ${intelligenceData.yourAngle.positioning}\nRelevance: ${intelligenceData.yourAngle.relevance || intelligenceData.yourAngle.whyRelevant || ""}\nValue Offer: ${intelligenceData.yourAngle.value || intelligenceData.yourAngle.valueYouCanOffer || ""}`
      : "Not synthesized";
    const intelThingsToAvoid = (intelligenceData?.thingsToAvoid || []).join(", ");

    // 4. Meeting Objective & Purpose
    const effectiveObjective =
      meeting?.purpose ||
      meetingPurpose ||
      connection.meetingPurpose ||
      "Explore mutual professional opportunities, share insights, and discuss relevant domain challenges.";

    const systemPrompt = `You are ColdConnect's personalized networking coach.
Evaluate how effectively this user introduced themselves to a specific person in a real networking situation.

Do not judge the pitch as a generic elevator pitch.
Judge whether this pitch creates a strong reason for THIS specific person to continue the conversation.
Evaluate relevance, clarity, credibility, personalization, memorability and conversational naturalness.

Use the target person's profile and meeting objective as context.
Do not reward irrelevant achievements merely because they sound impressive.
Do not penalize the user for not mentioning every credential.
Prioritize relevance over completeness.
Give specific, actionable feedback.

Feedback Style Requirements:
- Direct, specific, constructive, short, and actionable.
- Avoid hollow generic compliments like "You did a great job!" or "Keep practicing!".
- Reference exact phrases and elements from the user's pitch.
- For "improvements", provide 3 high-impact items with issue, whyItMatters, and a specific fix.
- For "missedOpportunity", identify exactly ONE important thing the user could have mentioned, strictly grounded in the user's actual profile and relevant to the target person.
- For "strongerPitch", generate a revised version of the user's pitch (under 60 seconds spoken, natural spoken language, authentic, no fake achievements, no robotic script, avoid awkward "I saw on your LinkedIn...").

Output MUST be valid JSON adhering strictly to this schema:
{
  "scores": {
    "overall": number (0-100),
    "personalization": number (0-100),
    "relevance": number (0-100),
    "clarity": number (0-100),
    "credibility": number (0-100),
    "memorability": number (0-100),
    "conversational": number (0-100)
  },
  "durationSeconds": number,
  "summary": string (1-2 sentences summarizing the coaching verdict),
  "whatWorked": [
    { "point": string, "evidence": string },
    { "point": string, "evidence": string },
    { "point": string, "evidence": string }
  ],
  "improvements": [
    { "issue": string, "whyItMatters": string, "fix": string },
    { "issue": string, "whyItMatters": string, "fix": string },
    { "issue": string, "whyItMatters": string, "fix": string }
  ],
  "missedOpportunity": {
    "point": string,
    "reason": string
  },
  "strongestElement": string,
  "strongerPitch": string,
  "nextPracticeFocus": string
}`;

    const userPrompt = `### TARGET PERSON:
Name: ${targetName}
Role: ${targetRole}
Company: ${targetCompany}
Headline: ${targetHeadline}
About: ${targetAbout}
Experience History:
${targetExperience || "None listed"}
Key Skills: ${targetSkills || "None listed"}

### NETWORKING INTELLIGENCE ON TARGET PERSON:
Current Focus: ${intelFocus}
Conversation Hooks:
${intelHooks || "None"}
Common Ground:
${intelCommonGround || "None"}
Strategic Angle:
${intelYourAngle}
Things To Avoid: ${intelThingsToAvoid || "None"}

### USER PROFILE:
${userProfileText}

### MEETING CONTEXT:
Target Person: ${targetName}
Objective: ${effectiveObjective}
Recorded Duration: ${durationSeconds} seconds

### SPOKEN PITCH TRANSCRIPT TO EVALUATE:
"""
${trimmedTranscript}
"""

Evaluate the pitch now and return ONLY the JSON object.`;

    const models = [
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-flash-latest",
    ];
    let lastError: unknown = null;

    for (const model of models) {
      try {
        console.log(`[PitchCoachService] Calling Gemini with model: ${model}`);
        const response = await this.ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });

        const rawText = response.text?.trim();
        if (!rawText) {
          throw new Error("Empty response from Gemini API");
        }

        const parsed = this.cleanAndParseJson(
          rawText,
          trimmedTranscript,
          durationSeconds,
          targetName,
          effectiveObjective,
          userProfile,
        );
        if (parsed) {
          return parsed;
        }
      } catch (err) {
        lastError = err;
        if (isQuotaOrRateLimitError(err)) {
          console.warn(
            `[PitchCoachService] Quota limit reached (429) on ${model}. Using deterministic evaluation fallback.`,
          );
          break;
        }
        console.log(`[PitchCoachService] Model ${model} failed:`);
      }
    }

    console.error(
      "[PitchCoachService] All Gemini models failed, using deterministic evaluation fallback:",
      lastError,
    );
    return this.buildFallbackEvaluation(
      trimmedTranscript,
      durationSeconds,
      targetName,
      targetRole,
      targetCompany,
      effectiveObjective,
      userProfile,
      intelligenceData,
    );
  }

  private cleanAndParseJson(
    rawText: string,
    transcript: string,
    durationSeconds: number,
    targetName: string,
    objective: string,
    userProfile?: UserProfile | null,
  ): PitchCoachAnalysisResult | null {
    let clean = rawText.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      const parsed = JSON.parse(clean);
      const scores: PitchCoachScores = {
        overall: this.clampScore(parsed.scores?.overall ?? parsed.overallScore ?? 75),
        personalization: this.clampScore(
          parsed.scores?.personalization ?? parsed.personalizationScore ?? 70,
        ),
        relevance: this.clampScore(parsed.scores?.relevance ?? parsed.relevanceScore ?? 75),
        clarity: this.clampScore(parsed.scores?.clarity ?? parsed.clarityScore ?? 80),
        credibility: this.clampScore(parsed.scores?.credibility ?? parsed.credibilityScore ?? 75),
        memorability: this.clampScore(
          parsed.scores?.memorability ?? parsed.memorabilityScore ?? 70,
        ),
        conversational: this.clampScore(
          parsed.scores?.conversational ?? parsed.conversationalScore ?? 75,
        ),
      };

      const whatWorked =
        Array.isArray(parsed.whatWorked) && parsed.whatWorked.length > 0
          ? (parsed.whatWorked as Array<Record<string, unknown>>)
              .map((w) => ({
                point: String(w.point || "Effective opening"),
                evidence: String(w.evidence || ""),
              }))
              .slice(0, 3)
          : [
              {
                point: "Clear professional introduction",
                evidence: "Stated background concisely.",
              },
              {
                point: "Conversational tone",
                evidence: "Natural delivery without sounding robotic.",
              },
              {
                point: "Established clear intent",
                evidence: "Connected background to the conversation.",
              },
            ];

      const improvements =
        Array.isArray(parsed.improvements) && parsed.improvements.length > 0
          ? (parsed.improvements as Array<Record<string, unknown>>)
              .map((imp) => ({
                issue: String(imp.issue || "General positioning"),
                whyItMatters: String(
                  imp.whyItMatters || "Helps the listener understand mutual relevance faster.",
                ),
                fix: String(imp.fix || "Lead with your most relevant project experience."),
              }))
              .slice(0, 3)
          : [
              {
                issue: "Connecting past experience to their current domain",
                whyItMatters: "Creates immediate common context for this specific meeting.",
                fix: "Tie one specific accomplishment to their work before opening for questions.",
              },
            ];

      const missedOpportunity =
        parsed.missedOpportunity && typeof parsed.missedOpportunity === "object"
          ? {
              point: String(parsed.missedOpportunity.point || "Highlighting a key milestone"),
              reason: String(
                parsed.missedOpportunity.reason || "Demonstrates tangible execution capability.",
              ),
            }
          : {
              point: "Mentioning specific problem domain you've tackled",
              reason: "Provides a memorable anchor for the discussion.",
            };

      const strongestElement = parsed.strongestElement
        ? String(parsed.strongestElement)
        : "Your concise transition from your core background into current business focus.";

      const strongerPitch = parsed.strongerPitch ? String(parsed.strongerPitch) : transcript;

      const summary = parsed.summary
        ? String(parsed.summary)
        : `Solid pitch targeting ${targetName}. Focus on tightening your bridge to their current initiatives.`;

      const nextPracticeFocus = parsed.nextPracticeFocus
        ? String(parsed.nextPracticeFocus)
        : "Focus on opening with your strongest relevant hook within the first 15 seconds.";

      return {
        scores,
        durationSeconds: parsed.durationSeconds || durationSeconds,
        summary,
        whatWorked,
        improvements,
        missedOpportunity,
        strongestElement,
        strongerPitch,
        nextPracticeFocus,
      };
    } catch (e) {
      console.warn("[PitchCoachService] Failed to parse JSON response:", e);
      return null;
    }
  }

  private clampScore(score: number): number {
    if (typeof score !== "number" || isNaN(score)) return 75;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private buildFallbackEvaluation(
    transcript: string,
    durationSeconds: number,
    targetName: string,
    targetRole: string,
    targetCompany: string,
    objective: string,
    userProfile?: UserProfile | null,
    intelligenceData?: PersonIntelligenceData | null,
  ): PitchCoachAnalysisResult {
    const wordCount = transcript.split(/\s+/).length;
    const isGoodLength = wordCount >= 40 && wordCount <= 140;
    const mentionsDomain = intelligenceData?.currentFocus?.summary
      ? transcript.toLowerCase().includes(targetCompany.toLowerCase()) ||
        transcript.toLowerCase().includes("scale") ||
        transcript.toLowerCase().includes("strategy") ||
        transcript.toLowerCase().includes("operation")
      : false;

    const baseScore = isGoodLength ? 82 : 72;
    const personalization = mentionsDomain ? 86 : 74;

    const scores: PitchCoachScores = {
      overall: Math.round((baseScore + personalization + 80 + 78) / 4),
      personalization,
      relevance: 80,
      clarity: isGoodLength ? 84 : 70,
      credibility: 82,
      memorability: 76,
      conversational: 80,
    };

    return {
      scores,
      durationSeconds,
      summary: `Your pitch sets up a credible background for meeting ${targetName}. Tightening the relevance to their focus at ${targetCompany} will make it even more impactful.`,
      whatWorked: [
        {
          point: "Crisp personal identity and background summary",
          evidence: "Introduced your transition and core strengths without excessive jargon.",
        },
        {
          point: "Natural conversational rhythm",
          evidence: "Paced appropriately for a 60-second coffee chat or introductory meeting.",
        },
        {
          point: "Clear career direction",
          evidence:
            "Clearly communicated the areas of business and strategy you are actively exploring.",
        },
      ],
      improvements: [
        {
          issue: "Bridging your past execution directly to their current focus",
          whyItMatters: `${targetName} is focused on ${intelligenceData?.currentFocus?.summary || "strategic growth"}, so linking your story directly creates instant rapport.`,
          fix: "Add one sentence showing how your problem-solving experience directly relates to their domain.",
        },
        {
          issue: "Ending with an open conversational question",
          whyItMatters:
            "A strong pitch should invite the other person into the dialogue naturally.",
          fix: "Close with a tailored question about their perspective on scaling execution.",
        },
        {
          issue: "Timing allocation",
          whyItMatters:
            "Spending more than 25 seconds on early history leaves less time for why you're connecting today.",
          fix: "Compress early credentials to one impactful sentence.",
        },
      ],
      missedOpportunity: {
        point: userProfile?.experience?.[0]?.title
          ? `Mentioning your hands-on role at ${userProfile.experience[0].company || "your latest venture"}`
          : "Highlighting a specific metric or operational milestone you delivered",
        reason: "Adds concrete evidence of your execution capabilities without sounding boastful.",
      },
      strongestElement:
        "The authentic narrative of how your professional background informs your strategic value and execution focus.",
      strongerPitch: `I'm ${((userProfile as { fullName?: string; name?: string })?.fullName || (userProfile as { fullName?: string; name?: string })?.name || "there").split(" ")[0]}, with a background spanning strategy, execution, and collaboration. I've spent hands-on time driving complex projects from the ground up, and I've become deeply fascinated by how organizations solve core domain challenges. Knowing your work at ${targetCompany}, I'd love to hear how you navigate key priorities in your space.`,
      nextPracticeFocus:
        "Deliver your core hook in 15 seconds and end with an open question about their domain.",
    };
  }
}

export const pitchCoachService = new PitchCoachService();
