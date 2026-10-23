import {
  generateConnectionConversationStrategy,
  fetchConnectionConversationStrategy,
} from "./dataServices";
import type {
  ConversationStrategy,
  ConversationStatus,
  ConversationHook,
  QuestionLadderItem,
  FollowUpQuestionGroup,
  MentorshipQuestionItem,
  QuestionToAvoidItem,
  UserProfile,
  StructuredPersonIntelligence,
} from "@/types/models";

export interface GenerateConversationStrategyOptions {
  forceRefresh?: boolean;
  meetingPurpose?: string;
}

/**
 * Client service to generate or fetch Personalized Conversation Strategy.
 * All Gemini AI generation happens securely server-side.
 */
export async function generateConversationStrategy(
  connectionId: string,
  options?: GenerateConversationStrategyOptions,
): Promise<{
  success: boolean;
  connectionId?: string;
  conversationStatus?: ConversationStatus;
  conversationStrategy?: ConversationStrategy;
  error?: string;
  cached?: boolean;
  message?: string;
}> {
  return generateConnectionConversationStrategy(connectionId, options);
}

/**
 * Fetch cached Conversation Strategy from Firestore without regeneration.
 */
export async function fetchConversationStrategy(connectionId: string): Promise<{
  success: boolean;
  connectionId?: string;
  conversationStatus?: ConversationStatus;
  conversationStrategy?: ConversationStrategy;
  error?: string;
  cached?: boolean;
}> {
  return fetchConnectionConversationStrategy(connectionId);
}

/**
 * Recalculate Conversation Strategy when meeting purpose changes (e.g. Networking → Career Advice).
 */
export async function recalculateConversationStrategyForPurpose(
  connectionId: string,
  newMeetingPurpose: string,
): Promise<{
  success: boolean;
  connectionId?: string;
  conversationStatus?: ConversationStatus;
  conversationStrategy?: ConversationStrategy;
  error?: string;
}> {
  return generateConnectionConversationStrategy(connectionId, {
    forceRefresh: true,
    meetingPurpose: newMeetingPurpose,
  });
}

export type {
  ConversationStrategy,
  ConversationStatus,
  ConversationHook,
  QuestionLadderItem,
  FollowUpQuestionGroup,
  MentorshipQuestionItem,
  QuestionToAvoidItem,
  UserProfile,
  StructuredPersonIntelligence,
};
