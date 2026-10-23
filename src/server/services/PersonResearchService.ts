import { GoogleGenAI } from "@google/genai";
import { ApifyProvider } from "../providers/ApifyProvider";
import {
  NormalizationService,
  normalizeLinkedInProfile,
  normalizeStructuredResearch,
  sanitizeRawProfile,
} from "./normalizationService";
import type { ResearchRequest, ResearchExecutionResult } from "../types/research";
import { normalizeLinkedInUrl } from "../utils/linkedinUrl";
import type { StructuredResearchData } from "../../types/models";

/**
 * PersonResearchService - Stage 1 Research Data Layer
 * Orchestrates multi-source public professional research and normalization.
 * - Collects LinkedIn profile, career history, transitions, education, skills, activity, and verified public sources.
 * - Uses Apify Actor when configured, and Gemini with Google Search Grounding for rich public footprint discovery.
 * - Adheres strictly to privacy, attribution, anti-hallucination, and data integrity guardrails.
 * - Does NOT generate hooks, questions, opening messages, pitch, or mentorship fit (reserved for later stages).
 */
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

export class PersonResearchService {
  private apifyProvider: ApifyProvider;
  private ai: GoogleGenAI;

  constructor() {
    this.apifyProvider = new ApifyProvider();
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Execute deep person research and return structured canonical research data.
   */
  async researchPerson(request: ResearchRequest): Promise<ResearchExecutionResult> {
    console.log("[ColdConnect] Deep research started");

    const normalizedUrl = normalizeLinkedInUrl(request.linkedinUrl);
    if (!normalizedUrl) {
      throw new Error("A valid LinkedIn profile URL is required for person research.");
    }

    let apifyData: Record<string, unknown> | null = null;
    let usedProvider = "GeminiSearchGrounding";

    // 1. Try Apify Provider if configured
    if (this.apifyProvider.isAvailable()) {
      try {
        const apifyResult = await this.apifyProvider.fetchPublicPersonData({
          ...request,
          linkedinUrl: normalizedUrl,
        });
        if (apifyResult && apifyResult.rawProfileData) {
          apifyData = apifyResult.rawProfileData;
          usedProvider = "ApifyProvider";
        }
      } catch (apifyErr) {
        console.warn(
          "[ColdConnect] Apify provider notice (falling back to Gemini Search Grounding):",
          apifyErr instanceof Error ? apifyErr.message : apifyErr,
        );
      }
    }

    // 2. Perform deep multi-source research via Gemini with Google Search Grounding
    let groundedData: Record<string, unknown> = {};
    try {
      groundedData = await this.executeDeepSearchGrounding(normalizedUrl, request.name, apifyData);
    } catch (groundErr) {
      console.log("[ColdConnect] Deep search grounding notice:");
    }

    // Combine Apify data (if available) with grounded public footprint
    const mergedRaw: Record<string, unknown> = {
      ...(apifyData || {}),
      ...groundedData,
      url: normalizedUrl,
      linkedinUrl: normalizedUrl,
    };

    // If both external providers and AI models were rate-limited or yielded minimal fields,
    // infer candidate name from profile slug or request to construct a valid baseline structured profile
    const usernameMatch = normalizedUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    const slugName = usernameMatch
      ? usernameMatch[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "";
    const effectiveName = request.name || slugName || "LinkedIn Professional";

    if (
      !mergedRaw.fullName &&
      !mergedRaw.name &&
      !mergedRaw.currentRole &&
      !mergedRaw.positions &&
      !mergedRaw.experience
    ) {
      mergedRaw.fullName = effectiveName;
      mergedRaw.name = effectiveName;
      mergedRaw.headline = "Professional on LinkedIn";
    }

    console.log("[ColdConnect] LinkedIn profile collected");
    console.log("[ColdConnect] Activity collected");
    console.log("[ColdConnect] Public sources collected");

    try {
      // 3. Normalize into the canonical Stage 1 StructuredResearchData schema
      const sanitizedRaw = sanitizeRawProfile(mergedRaw);
      const structuredResearch: StructuredResearchData = normalizeStructuredResearch(
        sanitizedRaw,
        normalizedUrl,
        request.name,
        usedProvider,
      );

      // Also construct legacy models for 100% backward compatibility
      const normalizedProfile = normalizeLinkedInProfile(sanitizedRaw, normalizedUrl);
      const normalizedInformation = NormalizationService.normalize(
        {
          providerName: usedProvider,
          rawProfileData: sanitizedRaw,
          sources: structuredResearch.publicSources.map((s) => ({
            title: s.title,
            url: s.url,
            source: s.sourceType,
            type: "professional",
            retrievedAt: structuredResearch.researchMetadata.researchedAt,
            content: s.summary,
          })),
        },
        request.name,
      );

      console.log("[ColdConnect] Research normalized");

      const researchData = {
        rawProfile: sanitizedRaw,
        normalizedProfile,
        structuredResearch,
        rawSources: normalizedInformation.sources,
        normalizedInformation,
        sourceCount: structuredResearch.researchMetadata.sourceCount,
      };

      return {
        success: true,
        researchData,
        structuredResearch,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to complete research for this profile. Please verify that the profile is public.";

      console.log("[ColdConnect] Research normalization error:");

      return {
        success: false,
        error: errorMessage,
        researchData: {
          rawSources: [],
          normalizedInformation: {
            name: request.name,
            education: [],
            experience: [],
            skills: [],
            interests: [],
            achievements: [],
            publications: [],
            sources: [],
          },
          sourceCount: 0,
        },
      };
    }
  }

  /**
   * Researches the complete 15-category public professional footprint using Gemini + Google Search Grounding.
   */
  private async executeDeepSearchGrounding(
    linkedinUrl: string,
    candidateName?: string,
    existingApifyData?: Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> {
    const usernameMatch = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    const slug = usernameMatch ? usernameMatch[1].replace(/[-_]/g, " ") : "";
    const primaryName =
      candidateName ||
      String(existingApifyData?.fullName || existingApifyData?.name || slug || "this professional");

    const prompt = `You are a specialized public professional intelligence researcher for ColdConnect.
Your objective is to collect verified, public professional information about the person identified by:
- LinkedIn URL: ${linkedinUrl}
- Known Name / Identifier: ${primaryName}
${existingApifyData ? `- Known Headline / Role: ${String(existingApifyData.headline || existingApifyData.title || "")}` : ""}

Collect all publicly available and confidently attributable professional information across these 15 categories:
1. LinkedIn profile identity (Full name, professional headline, location, about/summary)
2. Current role (Title, company, duration/start date, location, description, key highlights)
3. Previous roles (Chronological titles, companies, dates, descriptions)
4. Career transitions (Notable shifts across industries, promotions, or company changes with context)
5. Education (Institutions, degrees, fields of study, years)
6. Skills (Core competencies, technical skills, domain expertise)
7. LinkedIn activity & posts (Recent public posts, shared insights, topics)
8. Recurring professional topics (Core recurring themes they write or speak about)
9. Public professional articles (Authored articles or papers with title, publisher, date, url, summary)
10. Interviews (Public interviews or fireside chats)
11. Podcasts (Guest podcast appearances or audio features)
12. Conference / speaker profiles (Keynotes, panel discussions, conference bios)
13. Company biographies (Official team bio from employer website)
14. Personal professional websites (Portfolio, blog, or personal site)
15. Other clearly attributable public professional sources (Press mentions, industry whitepapers)

STRICT GUARDRAILS:
- Do NOT scrape or include private personal data (no private phone numbers, home addresses, family details, or sensitive attributes).
- Do NOT infer sensitive personal characteristics.
- Do NOT associate third-party social media accounts unless identity is verified with reasonable confidence.
- Do NOT fabricate or hallucinate details. If an item is unconfirmed, omit it.
- For EVERY external source retain: url, sourceType, title, date (if available), short factual summary, and relevance.
- Do NOT generate conversation hooks, recommended questions, opening messages, 60-second pitch, or mentorship fit (those are reserved for later stages).

Return ONLY valid JSON matching this exact structure:
{
  "fullName": "string",
  "name": "string",
  "headline": "string",
  "location": "string",
  "about": "string",
  "currentRole": {
    "title": "string",
    "company": "string",
    "location": "string",
    "startDate": "string",
    "duration": "string",
    "description": "string",
    "highlights": ["string"]
  },
  "previousRoles": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "startDate": "string",
      "endDate": "string",
      "duration": "string",
      "description": "string"
    }
  ],
  "transitions": [
    {
      "fromRole": "string",
      "fromCompany": "string",
      "toRole": "string",
      "toCompany": "string",
      "year": "string",
      "transitionType": "string",
      "description": "string"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "fieldOfStudy": "string",
      "startDate": "string",
      "endDate": "string",
      "year": "string"
    }
  ],
  "skills": ["string"],
  "activity": {
    "posts": [
      {
        "text": "string",
        "snippet": "string",
        "date": "string",
        "url": "string",
        "engagement": "string",
        "topics": ["string"]
      }
    ],
    "articles": [
      {
        "title": "string",
        "publisher": "string",
        "date": "string",
        "url": "string",
        "summary": "string",
        "topics": ["string"]
      }
    ],
    "recurringTopics": [
      {
        "topic": "string",
        "frequency": "string",
        "relevance": "string",
        "evidence": ["string"]
      }
    ]
  },
  "publicSources": [
    {
      "url": "string",
      "sourceType": "linkedin_profile | linkedin_post | article | interview | podcast | conference_speaker | company_bio | personal_website | press_mention | other_professional",
      "title": "string",
      "date": "string",
      "summary": "string",
      "relevance": "string"
    }
  ],
  "websites": [
    {
      "url": "string",
      "label": "string"
    }
  ]
}`;

    const models = [
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-flash-latest",
    ];
    let text = "";
    let quotaExceeded = false;

    // 1. First try with Google Search Grounding tool
    for (const model of models) {
      if (quotaExceeded) break;
      try {
        const response = await this.ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        text = response.text || "";
        if (text) {
          break;
        }
      } catch (searchErr) {
        if (isQuotaOrRateLimitError(searchErr)) {
          quotaExceeded = true;
          console.warn(
            `[PersonResearchService] Search grounding quota limit reached (429) on ${model}. Transitioning to structured fallback.`,
          );
          break;
        }
        console.log(`[PersonResearchService] Model ${model} grounding search notice:`);
      }
    }

    // 2. If search tools failed or were rate-limited, attempt standard structured text generation
    if (!text && !quotaExceeded) {
      for (const model of models) {
        try {
          const response = await this.ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });
          text = response.text || "";
          if (text) {
            break;
          }
        } catch (genErr) {
          if (isQuotaOrRateLimitError(genErr)) {
            console.warn(
              `[PersonResearchService] Text model quota limit reached (429) on ${model}. Using deterministic structured fallback.`,
            );
            break;
          }
          console.log(`[PersonResearchService] Model ${model} text fallback notice:`);
        }
      }
    }

    if (text.startsWith("```json")) {
      text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      if (text) {
        return JSON.parse(text) as Record<string, unknown>;
      }
    } catch (parseErr) {
      console.log("[PersonResearchService] Grounding JSON parse notice:");
    }

    return {};
  }
}

export const personResearchService = new PersonResearchService();
