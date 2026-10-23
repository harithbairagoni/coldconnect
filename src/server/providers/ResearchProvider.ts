import { ResearchRequest, RawResearchResult } from "../types/research";

export interface IResearchProvider {
  readonly name: string;
  readonly isTestProvider: boolean;
  isAvailable(): boolean;
  fetchPublicPersonData(request: ResearchRequest): Promise<RawResearchResult>;
}
