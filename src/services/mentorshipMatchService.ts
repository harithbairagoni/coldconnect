import { generateConnectionMentorshipMatch, fetchConnectionMentorshipMatch } from "./dataServices";
import type {
  MentorshipMatch,
  MentorshipStatus,
  UserProfile,
  StructuredPersonIntelligence,
} from "@/types/models";

export interface GenerateMentorshipMatchOptions {
  forceRefresh?: boolean;
  meetingPurpose?: string;
}

/**
 * Client service to generate or fetch Candidate ↔ Expert Mentorship Match.
 * All Gemini AI generation happens securely server-side.
 */
export async function generateMentorshipMatch(
  connectionId: string,
  options?: GenerateMentorshipMatchOptions,
): Promise<{
  success: boolean;
  connectionId?: string;
  mentorshipStatus?: MentorshipStatus;
  mentorshipMatch?: MentorshipMatch;
  error?: string;
  cached?: boolean;
  message?: string;
}> {
  return generateConnectionMentorshipMatch(connectionId, options);
}

/**
 * Fetch cached Mentorship Match from Firestore without regeneration.
 */
export async function fetchMentorshipMatch(connectionId: string): Promise<{
  success: boolean;
  connectionId?: string;
  mentorshipStatus?: MentorshipStatus;
  mentorshipMatch?: MentorshipMatch;
  error?: string;
  cached?: boolean;
}> {
  return fetchConnectionMentorshipMatch(connectionId);
}

/**
 * Recalculate Mentorship Match when meeting purpose changes (e.g. Networking → Career Advice).
 */
export async function recalculateMentorshipMatchForPurpose(
  connectionId: string,
  newMeetingPurpose: string,
): Promise<{
  success: boolean;
  connectionId?: string;
  mentorshipStatus?: MentorshipStatus;
  mentorshipMatch?: MentorshipMatch;
  error?: string;
}> {
  return generateConnectionMentorshipMatch(connectionId, {
    forceRefresh: true,
    meetingPurpose: newMeetingPurpose,
  });
}

export type { MentorshipMatch, MentorshipStatus, UserProfile, StructuredPersonIntelligence };
