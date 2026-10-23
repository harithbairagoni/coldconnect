import { GoogleGenAI } from "@google/genai";
import type {
  UserProfile,
  StructuredPersonIntelligence,
  MentorshipMatch,
  ConversationStrategy,
  ConversationHook,
  QuestionLadderItem,
  FollowUpQuestionGroup,
  MentorshipQuestionItem,
  QuestionToAvoidItem,
} from "../../types/models";
import type { CandidateContextInput } from "./MentorshipMatchService";

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

export interface ConversationStrategyValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: ConversationStrategy;
}

export function validateConversationStrategy(
  data: unknown,
  meetingPurpose = "Mentorship",
): ConversationStrategyValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data is not an object"] };
  }

  const obj = data as Record<string, unknown>;

  // 1. conversationStrategy meta
  const metaRaw = (obj.conversationStrategy as Record<string, unknown>) || {};
  const coreObjective =
    typeof metaRaw.coreObjective === "string" && metaRaw.coreObjective.trim()
      ? metaRaw.coreObjective.trim()
      : typeof obj.coreObjective === "string" && (obj.coreObjective as string).trim()
        ? (obj.coreObjective as string).trim()
        : "Understand real-world execution decisions, transitions, and domain insights from the expert.";

  const bestEntryPoint =
    typeof metaRaw.bestEntryPoint === "string" && metaRaw.bestEntryPoint.trim()
      ? metaRaw.bestEntryPoint.trim()
      : typeof obj.bestEntryPoint === "string" && (obj.bestEntryPoint as string).trim()
        ? (obj.bestEntryPoint as string).trim()
        : "Career transition and practical execution decisions";

  const whyThisEntryPoint =
    typeof metaRaw.whyThisEntryPoint === "string" && metaRaw.whyThisEntryPoint.trim()
      ? metaRaw.whyThisEntryPoint.trim()
      : typeof obj.whyThisEntryPoint === "string" && (obj.whyThisEntryPoint as string).trim()
        ? (obj.whyThisEntryPoint as string).trim()
        : "Gives a genuine reason to ask about a transition you want to understand without asking them to repeat their resume.";

  // 2. bestOpening
  const openingRaw = (obj.bestOpening as Record<string, unknown>) || {};
  const openingText =
    typeof openingRaw.text === "string" && openingRaw.text.trim()
      ? openingRaw.text.trim()
      : typeof obj.bestOpening === "string" && (obj.bestOpening as string).trim()
        ? (obj.bestOpening as string).trim()
        : "";

  const openingWhy =
    typeof openingRaw.whyItWorks === "string" && openingRaw.whyItWorks.trim()
      ? openingRaw.whyItWorks.trim()
      : "Combines a specific verified career observation with candidate context and genuine curiosity.";

  if (!openingText) {
    errors.push("bestOpening.text must be a non-empty string");
  }

  // 3. candidateIntroduction
  const introRaw = (obj.candidateIntroduction as Record<string, unknown>) || {};
  const introText =
    typeof introRaw.text === "string" && introRaw.text.trim()
      ? introRaw.text.trim()
      : typeof obj.candidateIntroduction === "string" &&
          (obj.candidateIntroduction as string).trim()
        ? (obj.candidateIntroduction as string).trim()
        : "";

  const introWhy =
    typeof introRaw.whyItWorks === "string" && introRaw.whyItWorks.trim()
      ? introRaw.whyItWorks.trim()
      : "Frames who you are, what you're exploring, why this expert caught your attention, and what you want to learn in 25 seconds.";

  if (!introText) {
    errors.push("candidateIntroduction.text must be a non-empty string");
  }

  // 4. conversationHooks (at least 3)
  const conversationHooks: ConversationHook[] = [];
  if (Array.isArray(obj.conversationHooks)) {
    for (const h of obj.conversationHooks) {
      if (h && typeof h === "object") {
        const hObj = h as Record<string, unknown>;
        const topic = typeof hObj.topic === "string" ? hObj.topic.trim() : "";
        const observation = typeof hObj.observation === "string" ? hObj.observation.trim() : "";
        const question = typeof hObj.question === "string" ? hObj.question.trim() : "";
        const whyItMatters = typeof hObj.whyItMatters === "string" ? hObj.whyItMatters.trim() : "";

        if (topic && question) {
          conversationHooks.push({
            topic,
            observation: observation || `Verified background in ${topic}.`,
            question,
            whyItMatters:
              whyItMatters || "Connects verified expert background to candidate exploration.",
          });
        }
      }
    }
  }

  if (conversationHooks.length < 2) {
    errors.push("conversationHooks must contain at least 2 distinct hooks");
  }

  // 5. questionLadder (5 levels: 1 to 5)
  const questionLadder: QuestionLadderItem[] = [];
  const levelsFound = new Set<number>();

  if (Array.isArray(obj.questionLadder)) {
    for (const q of obj.questionLadder) {
      if (q && typeof q === "object") {
        const qObj = q as Record<string, unknown>;
        const levelNum = Number(qObj.level);
        const question = typeof qObj.question === "string" ? qObj.question.trim() : "";
        const intent = typeof qObj.intent === "string" ? qObj.intent.trim() : "";

        if (
          !isNaN(levelNum) &&
          levelNum >= 1 &&
          levelNum <= 5 &&
          question &&
          !levelsFound.has(levelNum)
        ) {
          levelsFound.add(levelNum);
          questionLadder.push({
            level: levelNum as 1 | 2 | 3 | 4 | 5,
            question,
            intent: intent || `Level ${levelNum} conversation depth objective.`,
          });
        }
      }
    }
  }

  // Sort question ladder by level
  questionLadder.sort((a, b) => a.level - b.level);

  // 6. followUpQuestions
  const followUpQuestions: FollowUpQuestionGroup[] = [];
  if (Array.isArray(obj.followUpQuestions)) {
    for (const f of obj.followUpQuestions) {
      if (f && typeof f === "object") {
        const fObj = f as Record<string, unknown>;
        const trigger = typeof fObj.trigger === "string" ? fObj.trigger.trim() : "";
        const followUps: string[] = [];
        if (Array.isArray(fObj.followUps)) {
          for (const fu of fObj.followUps) {
            if (typeof fu === "string" && fu.trim()) {
              followUps.push(fu.trim());
            }
          }
        }
        if (trigger && followUps.length > 0) {
          followUpQuestions.push({ trigger, followUps });
        }
      }
    }
  }

  // 7. mentorshipQuestions (at least 3)
  const mentorshipQuestions: Array<string | MentorshipQuestionItem> = [];
  if (Array.isArray(obj.mentorshipQuestions)) {
    for (const mq of obj.mentorshipQuestions) {
      if (typeof mq === "string" && mq.trim()) {
        mentorshipQuestions.push(mq.trim());
      } else if (mq && typeof mq === "object") {
        const mqObj = mq as Record<string, unknown>;
        const question = typeof mqObj.question === "string" ? mqObj.question.trim() : "";
        const intent = typeof mqObj.intent === "string" ? mqObj.intent.trim() : undefined;
        if (question) {
          mentorshipQuestions.push(intent ? { question, intent } : question);
        }
      }
    }
  }

  // 8. questionsToAvoid (3-5 items)
  const questionsToAvoid: Array<string | QuestionToAvoidItem> = [];
  if (Array.isArray(obj.questionsToAvoid)) {
    for (const qa of obj.questionsToAvoid) {
      if (typeof qa === "string" && qa.trim()) {
        questionsToAvoid.push(qa.trim());
      } else if (qa && typeof qa === "object") {
        const qaObj = qa as Record<string, unknown>;
        const avoid = typeof qaObj.avoid === "string" ? qaObj.avoid.trim() : "";
        const reason = typeof qaObj.reason === "string" ? qaObj.reason.trim() : "";
        const betterAlternative =
          typeof qaObj.betterAlternative === "string" ? qaObj.betterAlternative.trim() : undefined;

        if (avoid) {
          questionsToAvoid.push({
            avoid,
            reason: reason || "Already publicly visible or overly transactional.",
            betterAlternative,
          });
        }
      }
    }
  }

  // 9. candidateAngle
  const candidateAngle =
    typeof obj.candidateAngle === "string" && obj.candidateAngle.trim()
      ? obj.candidateAngle.trim()
      : "Lead with curiosity around practical execution and domain decisions. Bring in your relevant background as context rather than a full resume pitch.";

  // 10. mentorshipAsk
  const mentorshipAsk =
    typeof obj.mentorshipAsk === "string" && obj.mentorshipAsk.trim()
      ? obj.mentorshipAsk.trim()
      : "I've found your perspective particularly helpful. Would you be open to me staying in touch and occasionally reaching out as I navigate this transition?";

  // 11. closingStrategy
  const closingStrategy =
    typeof obj.closingStrategy === "string" && obj.closingStrategy.trim()
      ? obj.closingStrategy.trim()
      : "Thank them specifically for one concrete lesson discussed, and mention you will keep them updated on your progress.";

  const sanitized: ConversationStrategy = {
    conversationStrategy: {
      coreObjective,
      bestEntryPoint,
      whyThisEntryPoint,
    },
    bestOpening: {
      text: openingText,
      whyItWorks: openingWhy,
    },
    candidateIntroduction: {
      text: introText,
      whyItWorks: introWhy,
    },
    conversationHooks,
    questionLadder,
    followUpQuestions,
    mentorshipQuestions,
    questionsToAvoid,
    candidateAngle,
    mentorshipAsk,
    closingStrategy,
    generatedAt: new Date().toISOString(),
    meetingPurpose,
  };

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

export class ConversationIntelligenceService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    this.ai = new GoogleGenAI(apiKey ? { apiKey } : {});
  }

  /**
   * Generates a Personalized Conversation Strategy for the candidate and expert.
   */
  async generateConversationStrategy(params: {
    candidateProfile?: UserProfile | CandidateContextInput | null;
    personIntelligence: StructuredPersonIntelligence | Record<string, unknown>;
    mentorshipMatch?: MentorshipMatch | Record<string, unknown> | null;
    meetingPurpose?: string;
    expertName?: string;
  }): Promise<ConversationStrategy> {
    const {
      candidateProfile,
      personIntelligence,
      mentorshipMatch,
      meetingPurpose = "Mentorship",
      expertName,
    } = params;

    console.log(
      `[ConversationIntelligenceService] Generating strategy for purpose: "${meetingPurpose}", expert: "${expertName || "Target"}"`,
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

    // Normalize Intelligence
    const pi = personIntelligence as Partial<StructuredPersonIntelligence> &
      Record<string, unknown>;
    const targetName = expertName || "the expert";

    const prompt = `You are the ColdConnect Conversation Intelligence Engine (Stage 4).
Your objective is to transform the verified Candidate Profile, Person Intelligence, Mentorship Match, and Meeting Purpose into an actionable, tailored, professional conversation preparation strategy.

==================================================
CORE PRINCIPLES
==================================================
1. ColdConnect is NOT a generic messaging generator. It is a strategic conversation preparation system for a 20-minute meeting.
2. Tone must be CURIOUS, PREPARED, HUMBLE, CANDID, and SPECIFIC.
3. NEVER make the candidate sound salesy, desperate, flattering, corporate, or AI-generated.
4. FORBIDDEN CLICHÉS:
   - "I've been following your incredible journey"
   - "I'm really impressed by your career"
   - "Your profile is truly inspiring"
   - "I'd love to pick your brain"
   - "Given your extensive experience"
5. Do NOT manufacture intimacy (do not sound like a stalker who analyzed private social posts). Sound like: "I did some homework and have a genuine question."
6. Allow human, candid phrases: "I'm trying to understand...", "What I'm struggling with is...", "I don't have a clear answer to this yet...".

==================================================
INPUT DATA
==================================================
[MEETING PURPOSE]: "${meetingPurpose}"

[CANDIDATE PROFILE]:
- Name: ${candidateName}
- Headline: ${candidateHeadline || "Exploring professional development & mentorship"}
- About/Bio: ${candidateAbout || "Professional seeking strategic mentorship and domain perspective"}
- Goals: ${candidateGoals || "Seeking grounded perspective on domain execution and career transitions"}
- Skills: ${candidateSkills.join(", ") || "Analytical problem solving, cross-functional execution"}
- Relevant Experience: ${candidateExp.slice(0, 3).join(" | ") || "Professional track record"}

[EXPERT INTELLIGENCE]:
- Name: ${targetName}
- Identity: ${JSON.stringify(pi.professionalIdentity || {})}
- Current Focus: ${JSON.stringify(pi.currentFocus || {})}
- Key Expertise: ${JSON.stringify((pi.keyExpertise || []).slice(0, 3))}
- Career Transitions: ${JSON.stringify((pi.careerTransitions || []).slice(0, 3))}
- Recurring Themes: ${JSON.stringify((pi.recurringThemes || []).slice(0, 3))}
- Mentorship Value: ${JSON.stringify((pi.mentorshipValue || []).slice(0, 3))}

[MENTORSHIP MATCH (STAGE 3)]:
- Why This Person: ${(mentorshipMatch as MentorshipMatch)?.whyThisPerson || "Verified domain transition and execution experience."}
- What Candidate Can Learn: ${JSON.stringify((mentorshipMatch as MentorshipMatch)?.whatCandidateCanLearn || [])}
- Complementary Experience: ${JSON.stringify((mentorshipMatch as MentorshipMatch)?.complementaryExperience || [])}
- Best Entry Point: ${JSON.stringify((mentorshipMatch as MentorshipMatch)?.bestEntryPoint || {})}
- Candidate Angle: ${(mentorshipMatch as MentorshipMatch)?.candidateAngle || ""}

==================================================
MEETING PURPOSE DIRECTIVES
==================================================
- "Career Advice": Focus on career transitions, decision frameworks, skills that matter most, and navigating inflection points.
- "Entrepreneurship" / "Business Advice": Focus on zero-to-one building, commercial ownership, market selection, GTM, and operating realities.
- "Industry Learning": Focus on deep domain knowledge, supply/distribution dynamics, and counter-intuitive market realities.
- "Networking": Focus on genuine shared themes, intellectual curiosity, and conversational entry points.
- "Mentorship": Focus on experience transfer, hard-won lessons, and building a long-term advisory foundation.

==================================================
OUTPUT SCHEMA (JSON ONLY)
==================================================
{
  "conversationStrategy": {
    "coreObjective": "Single primary objective for the 20-minute discussion",
    "bestEntryPoint": "Single strongest entry point topic",
    "whyThisEntryPoint": "Why this specific entry point works without repeating their resume"
  },
  "bestOpening": {
    "text": "First thing to say (25-50 spoken words). Specific observation + candidate context + genuine curiosity. No fake praise.",
    "whyItWorks": "Explanation of why this opening establishes credibility and comfort"
  },
  "candidateIntroduction": {
    "text": "20-30 second conversational pitch (Who I am + What I'm currently exploring + Why this person + What I want to learn).",
    "whyItWorks": "Why this frames the meeting productively"
  },
  "conversationHooks": [
    {
      "topic": "Distinct theme/pivot 1",
      "observation": "Verified observation from expert trajectory",
      "question": "Deep, grounded question",
      "whyItMatters": "How it connects to candidate's growth"
    },
    {
      "topic": "Distinct theme/pivot 2",
      "observation": "Verified observation from expert trajectory",
      "question": "Deep, grounded question",
      "whyItMatters": "How it connects to candidate's growth"
    },
    {
      "topic": "Distinct theme/pivot 3",
      "observation": "Verified observation from expert trajectory",
      "question": "Deep, grounded question",
      "whyItMatters": "How it connects to candidate's growth"
    }
  ],
  "questionLadder": [
    {
      "level": 1,
      "question": "Warm-up / low-pressure opening question about top-of-mind active focus",
      "intent": "Establish comfortable rapport"
    },
    {
      "level": 2,
      "question": "Question rooted in their personal, concrete past experience",
      "intent": "Surface tacit experience"
    },
    {
      "level": 3,
      "question": "Question about a major decision, trade-off, or inflection point",
      "intent": "Understand their mental models and decision criteria"
    },
    {
      "level": 4,
      "question": "Question about what they learned that was counter-intuitive or surprising",
      "intent": "Extract hard-won industry insights"
    },
    {
      "level": 5,
      "question": "Advice question connecting the expert's lessons directly to candidate's stage",
      "intent": "Gain high-leverage, actionable guidance"
    }
  ],
  "followUpQuestions": [
    {
      "trigger": "If they emphasize speed of decision-making or incomplete information...",
      "followUps": [
        "How did you know when you had 'enough' information to commit?",
        "What was the biggest operational mistake you avoided by trusting that instinct?"
      ]
    },
    {
      "trigger": "If they highlight customer or market understanding...",
      "followUps": [
        "Was there a specific customer insight that completely reversed your initial plan?",
        "How do you distinguish genuine product differentiation from marketing noise?"
      ]
    },
    {
      "trigger": "If they talk about team alignment or organizational transition...",
      "followUps": [
        "What was the most difficult mindset shift when moving from advisor to owner?",
        "How did your communication style have to adapt?"
      ]
    }
  ],
  "mentorshipQuestions": [
    "What would you do differently if you were navigating that transition today?",
    "What foundational capability turned out to matter much more than you expected?",
    "If you were advising someone at my stage who wants to move in this direction, what should I prioritize over the next 12 months?"
  ],
  "questionsToAvoid": [
    {
      "avoid": "What does your company do?",
      "reason": "Publicly visible on LinkedIn/website. Asking this shows a lack of basic preparation.",
      "betterAlternative": "What has been the most interesting operating problem you've tackled this quarter?"
    },
    {
      "avoid": "Can you give me a job or referral?",
      "reason": "Overly transactional and premature for a mentorship / networking chat.",
      "betterAlternative": "What capabilities are most valued on teams solving problems like yours?"
    },
    {
      "avoid": "Will you be my mentor?",
      "reason": "Puts high pressure on a first conversation. Mentorship develops organically from useful conversations.",
      "betterAlternative": "Would you be open to me staying in touch and occasionally sharing how I'm applying what we discussed?"
    }
  ],
  "candidateAngle": "Clear explanation of how the candidate should position their background candidly without over-selling.",
  "mentorshipAsk": "Low-pressure ask at the end of a good conversation (e.g., 'I found your perspective on X really helpful. Would you be open to me staying in touch and occasionally reaching out as I navigate this?').",
  "closingStrategy": "Natural wrap-up referencing a specific insight discussed, expressing genuine gratitude, and setting up a natural reason to reconnect."
}

==================================================
ANTI-TEMPLATE VERIFICATION
==================================================
- Every question must be tailored specifically to ${targetName}'s verified trajectory and the candidate's stated goals.
- Question ladder MUST have 5 levels (1, 2, 3, 4, 5).
- Return ONLY valid raw JSON with no Markdown wrappers or extra commentary.`;

    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-flash-latest",
    ];

    try {
      let responseText = "";
      for (const model of candidateModels) {
        try {
          const response = await this.ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.3,
            },
          });
          if (response.text && response.text.trim()) {
            responseText = response.text.trim();
            break;
          }
        } catch (mErr) {
          if (isQuotaOrRateLimitError(mErr)) {
            console.warn(
              `[ConversationIntelligenceService] Quota limit reached (429) on ${model}. Transitioning to deterministic synthesis.`,
            );
            break;
          }
          console.log(`[ConversationIntelligenceService] Model ${model} notice:`);
        }
      }

      let parsed: unknown;
      try {
        const cleanJson = responseText
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn(
          "[ConversationIntelligenceService] Initial JSON parse failed, retrying once...",
          parseErr,
        );
        parsed = await this.retryJsonGeneration(prompt);
      }

      const validation = validateConversationStrategy(parsed, meetingPurpose);
      if (validation.valid && validation.sanitized) {
        return validation.sanitized;
      }

      console.warn(
        "[ConversationIntelligenceService] Validation errors in LLM output:",
        validation.errors,
      );

      // Attempt repair or fallback
      if (validation.sanitized) {
        return validation.sanitized;
      }

      throw new Error(`Conversation strategy validation failed: ${validation.errors.join(", ")}`);
    } catch (err: unknown) {
      console.error(
        "[ConversationIntelligenceService] Generation failed, using deterministic synthesis:",
        err,
      );
      return this.synthesizeDeterministicStrategy({
        candidateProfile,
        personIntelligence,
        mentorshipMatch,
        meetingPurpose,
        expertName: targetName,
      });
    }
  }

  private async retryJsonGeneration(prompt: string): Promise<unknown> {
    const retryPrompt = `${prompt}\n\nCRITICAL: Output ONLY a valid JSON object. Ensure all brackets are closed and keys are quoted properly.`;
    const retryModels = [
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-flash-latest",
    ];
    let responseText = "";

    for (const model of retryModels) {
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: retryPrompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });
        if (response.text && response.text.trim()) {
          responseText = response.text.trim();
          break;
        }
      } catch (err) {
        console.log(`[ConversationIntelligenceService] Retry model ${model} notice:`);
      }
    }

    const cleanJson = responseText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleanJson);
  }

  /**
   * Deterministic synthesis engine ensuring high-quality conversation intelligence
   * even when network/quota constraints arise.
   */
  private synthesizeDeterministicStrategy(params: {
    candidateProfile?: UserProfile | CandidateContextInput | null;
    personIntelligence: StructuredPersonIntelligence | Record<string, unknown>;
    mentorshipMatch?: MentorshipMatch | Record<string, unknown> | null;
    meetingPurpose: string;
    expertName: string;
  }): ConversationStrategy {
    const { candidateProfile, personIntelligence, mentorshipMatch, meetingPurpose, expertName } =
      params;

    const firstName = expertName.split(" ")[0] || "there";
    const myName = candidateProfile?.fullName?.split(" ")[0] || "I";
    const myHeadline = candidateProfile?.headline || "exploring domain transitions";
    const pi = personIntelligence as Partial<StructuredPersonIntelligence> &
      Record<string, unknown>;
    const mm = (mentorshipMatch as MentorshipMatch) || null;

    const roleSummary = pi.professionalIdentity?.summary || "domain leader & operator";
    const currentFocus = pi.currentFocus?.summary || "scaling high-impact initiatives";
    const firstTransition = pi.careerTransitions?.[0];
    const bestEntryPointTopic =
      mm?.bestEntryPoint?.topic ||
      (firstTransition
        ? `Transition from ${firstTransition.from} to ${firstTransition.to}`
        : "Operational execution and leadership decisions");

    const coreObjective =
      meetingPurpose === "Career Advice"
        ? `Understand the key decision criteria and mental models ${firstName} used when navigating career inflection points.`
        : meetingPurpose === "Entrepreneurship" || meetingPurpose === "Business Advice"
          ? `Learn how ${firstName} translates strategy into commercial execution and direct business ownership.`
          : meetingPurpose === "Industry Learning"
            ? `Gain deep domain perspective on operational trade-offs and market realities from ${firstName}.`
            : `Learn from ${firstName}'s verified trajectory and explore potential long-term professional mentorship.`;

    const openingText = firstTransition
      ? `I noticed your transition from ${firstTransition.from} to ${firstTransition.to}. I'm exploring navigating my own transition from analytical work toward owning commercial outcomes, so I'm curious — what changed most in how you approached decisions once you made that shift?`
      : `I came across your work focusing on ${currentFocus.slice(0, 60)}... I'm currently working through similar execution challenges myself, so I was curious — what was the steepest learning curve when you stepped into that responsibility?`;

    const introText = `Hi ${firstName}, I'm ${myName}. I'm currently working as ${myHeadline}, and I'm actively exploring how to bridge analytical problem-solving into real-world business building. Your background in ${bestEntryPointTopic} really stood out to me, so I was eager to learn from your decision-making frameworks and operating lessons.`;

    const conversationHooks: ConversationHook[] = [
      {
        topic: firstTransition
          ? `Career Pivot: ${firstTransition.from} → ${firstTransition.to}`
          : "Navigating Career Inflection Points",
        observation: firstTransition
          ? `Successfully transitioned from ${firstTransition.from} to ${firstTransition.to}.`
          : "Built a track record across distinct leadership and operating stages.",
        question: `When you moved into that role, what was the biggest assumption from your earlier work that turned out to be mistaken?`,
        whyItMatters:
          "Surfaces real-world adaptation lessons and decision-making under uncertainty.",
      },
      {
        topic: "Translating Strategy into Execution",
        observation: `Verified focus on ${currentFocus.slice(0, 70)}.`,
        question: `How do you decide between analyzing a strategic problem further vs. moving forward with imperfect information?`,
        whyItMatters:
          "Connects directly to the candidate's desire to bridge analysis with operating outcomes.",
      },
      {
        topic: "Domain Capabilities That Matter",
        observation: `Expertise in ${pi.professionalIdentity?.expertise?.slice(0, 2).join(", ") || "commercial execution and leadership"}.`,
        question: `Looking back over the last few years, what foundational skill ended up providing the highest leverage?`,
        whyItMatters: "Provides concrete, actionable guidance on where to invest growth effort.",
      },
    ];

    const questionLadder: QuestionLadderItem[] = [
      {
        level: 1,
        question: `What is the most interesting project or challenge your team is currently tackling?`,
        intent: "Establish comfortable rapport around active, top-of-mind work.",
      },
      {
        level: 2,
        question: `Looking back at your transition into ${bestEntryPointTopic}, what surprised you most during your first six months?`,
        intent: "Prompt personal storytelling rooted in concrete experience.",
      },
      {
        level: 3,
        question: `Was there a specific decision or challenge where you realized the operating realities were completely different from the plan?`,
        intent: "Understand their mental models and criteria when evaluating trade-offs.",
      },
      {
        level: 4,
        question: `What has that experience changed about how you evaluate new opportunities and business risks today?`,
        intent: "Extract hard-won counter-intuitive insights.",
      },
      {
        level: 5,
        question: `If you were advising someone at my stage looking to build capabilities in this space, what should I prioritize investing time into right now?`,
        intent: "Gain high-leverage, personalized advice.",
      },
    ];

    const followUpQuestions: FollowUpQuestionGroup[] = [
      {
        trigger: "If they emphasize speed of execution or moving fast...",
        followUps: [
          "How do you establish enough confidence to act when the data is noisy?",
          "What was the most important metric you tracked to ensure you weren't off course?",
        ],
      },
      {
        trigger: "If they discuss managing cross-functional stakeholders or teams...",
        followUps: [
          "How did your communication style evolve when leading people with different backgrounds?",
          "What helped you align commercial goals with operational realities?",
        ],
      },
      {
        trigger: "If they highlight market positioning and consumer insights...",
        followUps: [
          "Was there a specific customer pattern that completely shifted your roadmap?",
          "How do you test whether an idea has genuine demand before committing resources?",
        ],
      },
    ];

    const mentorshipQuestions: string[] = [
      "What would you do differently if you were making that transition today?",
      "What foundational capability turned out to matter much more than you expected?",
      "If you were advising someone at my stage who wants to move in this direction, what would you prioritize over the next 12 months?",
    ];

    const questionsToAvoid: QuestionToAvoidItem[] = [
      {
        avoid: `What exactly does your team do day-to-day?`,
        reason: "Publicly visible on LinkedIn/company page; shows a lack of prior research.",
        betterAlternative: `What has been the most challenging operational bottleneck you've had to navigate recently?`,
      },
      {
        avoid: `Can you refer me or help me get a job?`,
        reason: "Overly transactional and premature for an initial mentorship exploration.",
        betterAlternative: `What skill sets or problem-solving approaches do the strongest performers in your field demonstrate?`,
      },
      {
        avoid: `Will you be my mentor?`,
        reason:
          "Creates immediate obligation and pressure; mentorship forms naturally from high-value conversations.",
        betterAlternative: `Would you be open to me staying in touch and letting you know how I apply what we discussed today?`,
      },
    ];

    return {
      conversationStrategy: {
        coreObjective,
        bestEntryPoint: bestEntryPointTopic,
        whyThisEntryPoint:
          mm?.bestEntryPoint?.reason ||
          `Gives a genuine reason to ask about a transition you want to understand without asking them to repeat their resume.`,
      },
      bestOpening: {
        text: openingText,
        whyItWorks:
          "Connects a verified career milestone with candidate context and genuine curiosity, without generic flattery.",
      },
      candidateIntroduction: {
        text: introText,
        whyItWorks:
          "Frames who you are, what you're exploring, why this person, and what you want to learn in 25 seconds.",
      },
      conversationHooks,
      questionLadder,
      followUpQuestions,
      mentorshipQuestions,
      questionsToAvoid,
      candidateAngle:
        mm?.candidateAngle ||
        `Position yourself as an intellectually curious professional seeking grounded operating perspectives on domain execution, rather than pitching or asking for favors.`,
      mentorshipAsk: `I've found your perspective particularly helpful. Would you be open to me staying in touch and occasionally reaching out as I navigate this transition?`,
      closingStrategy: `This was really helpful, especially your perspective on ${bestEntryPointTopic.toLowerCase()}. I'm going to apply that as I work through my next steps. I'd love to stay in touch and let you know how it develops.`,
      generatedAt: new Date().toISOString(),
      meetingPurpose,
    };
  }
}

export const conversationIntelligenceService = new ConversationIntelligenceService();
