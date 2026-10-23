import type { IResearchProvider } from "./ResearchProvider";
import type { ResearchRequest, RawResearchResult } from "../types/research";
import { normalizeLinkedInUrl } from "../utils/linkedinUrl";

/**
 * ApifyProvider
 * Server-side provider that executes public LinkedIn profile research via Apify Actor.
 * Adheres strictly to security, privacy, sanitization, and cost control rules.
 */
export class ApifyProvider implements IResearchProvider {
  readonly name = "ApifyProvider";
  readonly isTestProvider = false;

  private get apiKey(): string | undefined {
    return process.env.APIFY_API_TOKEN?.trim();
  }

  private get actorId(): string | undefined {
    return process.env.APIFY_LINKEDIN_ACTOR_ID?.trim();
  }

  isAvailable(): boolean {
    return Boolean(
      this.apiKey && this.apiKey.length > 0 && this.actorId && this.actorId.length > 0,
    );
  }

  /**
   * Constructs standard input payload compatible with Apify LinkedIn profile actors
   */
  private buildActorInput(normalizedUrl: string): Record<string, unknown> {
    return {
      profileUrls: [normalizedUrl],
      urls: [normalizedUrl],
      linkedinUrls: [normalizedUrl],
      url: normalizedUrl,
      profileUrl: normalizedUrl,
      queries: [normalizedUrl],
      maxItems: 1,
    };
  }

  /**
   * Executes the Apify actor and extracts the resulting profile dataset
   */
  async fetchPublicPersonData(request: ResearchRequest): Promise<RawResearchResult> {
    const token = this.apiKey;
    const actorId = this.actorId;

    if (!token || !actorId) {
      throw new Error(
        "Apify LinkedIn research service is not configured. Missing API token or Actor ID.",
      );
    }

    const normalizedUrl = normalizeLinkedInUrl(request.linkedinUrl);
    if (!normalizedUrl) {
      throw new Error("A valid LinkedIn profile URL is required.");
    }

    const actorInput = this.buildActorInput(normalizedUrl);
    const sanitizedActorId = actorId.replace(/\//g, "~"); // Support username/actor-name or username~actor-name

    const retrievedAt = new Date().toISOString();

    try {
      // Method 1: Try run-sync-get-dataset-items (most efficient for single profile lookups)
      const syncUrl = `https://api.apify.com/v2/acts/${sanitizedActorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 125000); // 125 second timeout

      let items: Record<string, unknown>[] = [];
      let executionSuccess = false;

      try {
        const response = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(actorInput),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            items = data as Record<string, unknown>[];
            executionSuccess = true;
          } else if (data && typeof data === "object" && !Array.isArray(data)) {
            items = [data as Record<string, unknown>];
            executionSuccess = true;
          }
        } else if (response.status === 401 || response.status === 403) {
          throw new Error(
            "Unable to authenticate with research service. Please check configuration.",
          );
        } else if (response.status === 404) {
          throw new Error("Specified research actor could not be found.");
        } else if (response.status === 429) {
          throw new Error(
            "Research service rate limit reached. Please try again in a few moments.",
          );
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("Profile research request timed out. Please retry.");
        }
        // If sync execution threw an auth/actor error, bubble it up
        if (
          err instanceof Error &&
          (err.message.includes("authenticate") || err.message.includes("actor could not"))
        ) {
          throw err;
        }
      }

      // Method 2: Fallback to standard run execution + wait if sync endpoint was not supported
      if (!executionSuccess || items.length === 0) {
        const startRunUrl = `https://api.apify.com/v2/acts/${sanitizedActorId}/runs?token=${encodeURIComponent(token)}&waitForFinish=120`;
        const runRes = await fetch(startRunUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(actorInput),
        });

        if (!runRes.ok) {
          if (runRes.status === 401 || runRes.status === 403) {
            throw new Error("Unable to authenticate with research service.");
          }
          if (runRes.status === 429) {
            throw new Error("Research service rate limit reached. Please try again shortly.");
          }
          throw new Error("Failed to start research execution.");
        }

        const runJson = (await runRes.json()) as {
          data?: {
            id?: string;
            status?: string;
            defaultDatasetId?: string;
          };
        };

        const runData = runJson?.data;
        if (!runData || !runData.defaultDatasetId) {
          throw new Error("Research execution did not produce a dataset.");
        }

        if (runData.status && runData.status !== "SUCCEEDED" && runData.status !== "READY") {
          if (runData.status === "TIMED-OUT") {
            throw new Error("Profile research timed out.");
          }
          throw new Error(`Research execution did not succeed (status: ${runData.status}).`);
        }

        // Fetch dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${runData.defaultDatasetId}/items?token=${encodeURIComponent(token)}&clean=true`;
        const datasetRes = await fetch(datasetUrl);
        if (datasetRes.ok) {
          const datasetItems = (await datasetRes.json()) as Record<string, unknown>[];
          if (Array.isArray(datasetItems) && datasetItems.length > 0) {
            items = datasetItems;
          }
        }
      }

      if (!items || !Array.isArray(items) || items.length === 0 || !items[0]) {
        throw new Error("LinkedIn profile data could not be retrieved.");
      }

      // Pick the first item as raw profile
      const rawProfile = items[0];

      return {
        providerName: this.name,
        rawProfileData: rawProfile,
        sources: [
          {
            title: `${String(rawProfile.fullName || rawProfile.name || request.name)} - LinkedIn`,
            url: normalizedUrl,
            source: "LinkedIn",
            type: "professional",
            retrievedAt,
          },
        ],
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error("Unable to research this profile right now. Please try again.");
    }
  }
}
