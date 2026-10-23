import {
  ResearchRawSource,
  NormalizedPersonInfo,
  NormalizedLinkedInProfile,
  PersonIntelligence,
  ResearchData,
  StructuredResearchData,
} from "../../types/models";

export interface ResearchRequest {
  name: string;
  linkedinUrl: string;
  connectionId: string;
  userId: string;
  forceRefresh?: boolean;
}

export interface RawResearchResult {
  providerName: string;
  rawProfileData: Record<string, unknown>;
  sources: ResearchRawSource[];
}

export interface ResearchExecutionResult {
  success: boolean;
  researchData: ResearchData;
  structuredResearch?: StructuredResearchData;
  intelligence?: PersonIntelligence;
  error?: string;
}
