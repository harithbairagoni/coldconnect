import {
  db,
  auth,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "@/lib/firebase";
import {
  Connection,
  Meeting,
  PitchSession,
  Followup,
  Interaction,
  PitchCoachAnalysisResult,
  PitchCoachScores,
  PitchCoachWhatWorked,
  PitchCoachImprovement,
  PitchCoachMissedOpportunity,
} from "@/types/models";

// ================= CONNECTIONS =================
export async function fetchUserConnections(userId: string): Promise<Connection[]> {
  if (!userId) return [];
  const colRef = collection(db, "users", userId, "connections");
  const snap = await getDocs(colRef);
  const items = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Connection, "id">),
  }));
  // Sort by most recently updated/created
  return items.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

export async function fetchUserConnection(
  userId: string,
  connectionId: string,
): Promise<Connection | null> {
  if (!userId || !connectionId) return null;
  const docRef = doc(db, "users", userId, "connections", connectionId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Connection, "id">),
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

export async function createUserConnection(
  userId: string,
  conn: Omit<Connection, "id">,
): Promise<Connection & { id: string }> {
  if (!userId) throw new Error("User ID is required");
  const colRef = collection(db, "users", userId, "connections");
  const now = new Date().toISOString();
  const rawData: Omit<Connection, "id"> = {
    ...conn,
    relationshipStatus: conn.relationshipStatus || "new",
    researchStatus: conn.researchStatus || "not_started",
    fieldSources: conn.fieldSources || {
      name: "user",
      ...(conn.linkedinURL || conn.linkedinUrl ? { linkedinURL: "user" } : {}),
      ...(conn.company ? { company: "user" } : {}),
      ...(conn.role ? { role: "user" } : {}),
      ...(conn.email ? { email: "user" } : {}),
      ...(conn.instagramHandle ? { instagramHandle: "user" } : {}),
      ...(conn.meetingPurpose ? { meetingPurpose: "user" } : {}),
      ...(conn.notes ? { notes: "user" } : {}),
    },
    createdAt: conn.createdAt || now,
    updatedAt: now,
  };
  const dataToSave = stripUndefined(rawData);
  const docRef = await addDoc(colRef, dataToSave);
  return {
    id: docRef.id,
    ...rawData,
  } as Connection & { id: string };
}

export async function updateUserConnection(
  userId: string,
  connectionId: string,
  data: Partial<Connection>,
): Promise<void> {
  if (!userId || !connectionId) throw new Error("User ID and Connection ID are required");
  const docRef = doc(db, "users", userId, "connections", connectionId);
  const dataToUpdate = stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(docRef, dataToUpdate);
}

export async function deleteUserConnection(userId: string, connectionId: string): Promise<void> {
  if (!userId || !connectionId) throw new Error("User ID and Connection ID are required");
  const docRef = doc(db, "users", userId, "connections", connectionId);
  await deleteDoc(docRef);
}

// ================= PERSON RESEARCH ENGINE =================
export async function researchConnection(
  connectionId: string,
  forceRefresh: boolean = false,
): Promise<{
  success: boolean;
  connection?: Connection;
  structuredResearch?: import("@/types/models").StructuredResearchData;
  researchData?: import("@/types/models").ResearchData;
  research?: import("@/types/models").ResearchData;
  intelligence?: import("@/types/models").StructuredPersonIntelligence;
  researchStatus?: string;
  intelligenceStatus?: string;
  error?: string;
  cached?: boolean;
}> {
  if (!connectionId) {
    throw new Error("Connection ID is required for research");
  }

  const { auth } = await import("@/lib/firebase");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to research a connection.");
  }

  const idToken = await currentUser.getIdToken();
  const endpoint = `/api/connections/${encodeURIComponent(connectionId)}/research`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      connectionId,
      forceRefresh,
    }),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    throw new Error(
      `Research API returned non-JSON response (${response.status}): ${rawText.slice(0, 150)}`,
    );
  }

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Research failed (${response.status})`);
  }

  return data;
}

export const triggerResearchPerson = researchConnection;

// ================= PERSON INTELLIGENCE ENGINE =================
export async function generateConnectionIntelligence(
  connectionId: string,
  forceRefresh: boolean = false,
): Promise<{
  success: boolean;
  connectionId?: string;
  intelligenceStatus?: string;
  intelligenceData?: import("@/types/models").PersonIntelligenceData;
  error?: string;
}> {
  if (!connectionId) {
    throw new Error("Connection ID is required for intelligence generation");
  }

  const { auth } = await import("@/lib/firebase");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to generate intelligence.");
  }

  const idToken = await currentUser.getIdToken();
  const endpoint = `/api/connections/${encodeURIComponent(connectionId)}/intelligence`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      connectionId,
      forceRefresh,
    }),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    throw new Error(
      `Intelligence API returned non-JSON response (${response.status}): ${rawText.slice(0, 150)}`,
    );
  }

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Intelligence generation failed (${response.status})`);
  }

  return data;
}

export const triggerPersonIntelligence = generateConnectionIntelligence;

// ================= STAGE 3: MENTORSHIP MATCH ENGINE =================
export async function generateConnectionMentorshipMatch(
  connectionId: string,
  params?: {
    forceRefresh?: boolean;
    meetingPurpose?: string;
  },
): Promise<{
  success: boolean;
  connectionId?: string;
  mentorshipStatus?: import("@/types/models").MentorshipStatus;
  mentorshipMatch?: import("@/types/models").MentorshipMatch;
  error?: string;
  cached?: boolean;
  message?: string;
}> {
  if (!connectionId) {
    throw new Error("Connection ID is required for mentorship match calculation");
  }

  const { auth } = await import("@/lib/firebase");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to calculate mentorship match.");
  }

  const idToken = await currentUser.getIdToken();
  const endpoint = `/api/connections/${encodeURIComponent(connectionId)}/mentorship-match`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      connectionId,
      forceRefresh: params?.forceRefresh ?? false,
      meetingPurpose: params?.meetingPurpose,
    }),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    throw new Error(
      `Mentorship API returned non-JSON response (${response.status}): ${rawText.slice(0, 150)}`,
    );
  }

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Mentorship match failed (${response.status})`);
  }

  return data;
}

export const triggerMentorshipMatch = generateConnectionMentorshipMatch;

export async function fetchConnectionMentorshipMatch(connectionId: string): Promise<{
  success: boolean;
  connectionId?: string;
  mentorshipStatus?: import("@/types/models").MentorshipStatus;
  mentorshipMatch?: import("@/types/models").MentorshipMatch;
  error?: string;
  cached?: boolean;
}> {
  if (!connectionId) {
    throw new Error("Connection ID is required");
  }

  const { auth } = await import("@/lib/firebase");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to fetch mentorship match.");
  }

  const idToken = await currentUser.getIdToken();
  const endpoint = `/api/connections/${encodeURIComponent(connectionId)}/mentorship-match`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch mentorship match.");
  }

  return data;
}

// ================= STAGE 4: PERSONALIZED CONVERSATION STRATEGY =================
export async function generateConnectionConversationStrategy(
  connectionId: string,
  params?: { forceRefresh?: boolean; meetingPurpose?: string },
): Promise<{
  success: boolean;
  connectionId?: string;
  conversationStatus?: import("@/types/models").ConversationStatus;
  conversationStrategy?: import("@/types/models").ConversationStrategy;
  error?: string;
  cached?: boolean;
  message?: string;
}> {
  if (!connectionId) {
    throw new Error("Connection ID is required");
  }

  const { auth } = await import("@/lib/firebase");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to generate conversation strategy.");
  }

  const idToken = await currentUser.getIdToken();
  const endpoint = `/api/connections/${encodeURIComponent(connectionId)}/conversation-strategy`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      connectionId,
      forceRefresh: params?.forceRefresh ?? false,
      meetingPurpose: params?.meetingPurpose,
    }),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const rawText = await response.text();
    throw new Error(
      `Conversation Strategy API returned non-JSON response (${response.status}): ${rawText.slice(0, 150)}`,
    );
  }

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Conversation strategy failed (${response.status})`);
  }

  return data;
}

export const triggerConversationStrategy = generateConnectionConversationStrategy;

export async function fetchConnectionConversationStrategy(connectionId: string): Promise<{
  success: boolean;
  connectionId?: string;
  conversationStatus?: import("@/types/models").ConversationStatus;
  conversationStrategy?: import("@/types/models").ConversationStrategy;
  error?: string;
  cached?: boolean;
}> {
  if (!connectionId) {
    throw new Error("Connection ID is required");
  }

  const { auth } = await import("@/lib/firebase");
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to fetch conversation strategy.");
  }

  const idToken = await currentUser.getIdToken();
  const endpoint = `/api/connections/${encodeURIComponent(connectionId)}/conversation-strategy`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch conversation strategy.");
  }

  return data;
}

// ================= MEETINGS =================
export async function fetchUserMeetings(userId: string): Promise<Meeting[]> {
  if (!userId) return [];
  const colRef = collection(db, "users", userId, "meetings");
  const snap = await getDocs(colRef);
  const meetings = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Meeting, "id">),
  }));
  // Sort chronologically by scheduledAt
  return meetings.sort((a, b) => {
    const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return timeA - timeB;
  });
}

export async function fetchUserMeeting(userId: string, meetingId: string): Promise<Meeting | null> {
  if (!userId || !meetingId) return null;
  const docRef = doc(db, "users", userId, "meetings", meetingId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Meeting, "id">),
  };
}

export async function createUserMeeting(
  userId: string,
  meeting: Omit<Meeting, "id">,
): Promise<string> {
  if (!userId) throw new Error("User ID is required");
  const colRef = collection(db, "users", userId, "meetings");
  const now = new Date().toISOString();
  const dataToSave = stripUndefined({
    ...meeting,
    status: meeting.status || "upcoming",
    preparationScore: meeting.preparationScore ?? 25,
    createdAt: now,
    updatedAt: now,
  });
  const docRef = await addDoc(colRef, dataToSave);
  return docRef.id;
}

export async function updateUserMeeting(
  userId: string,
  meetingId: string,
  data: Partial<Meeting>,
): Promise<void> {
  if (!userId || !meetingId) throw new Error("User ID and Meeting ID are required");
  const docRef = doc(db, "users", userId, "meetings", meetingId);
  const dataToUpdate = stripUndefined({
    ...data,
    updatedAt: new Date().toISOString(),
  });
  await updateDoc(docRef, dataToUpdate);
}

export async function deleteUserMeeting(userId: string, meetingId: string): Promise<void> {
  if (!userId || !meetingId) throw new Error("User ID and Meeting ID are required");
  const docRef = doc(db, "users", userId, "meetings", meetingId);
  await deleteDoc(docRef);
}

export async function removeMeeting(meetingId: string): Promise<void> {
  const { auth } = await import("@/lib/firebase");
  if (!auth.currentUser) throw new Error("User must be logged in to remove a meeting.");
  if (!meetingId) throw new Error("Meeting ID is required.");

  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`/api/meetings/${meetingId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    let errMsg = "Unable to remove meeting.";
    try {
      const data = await res.json();
      if (data.error) errMsg = data.error;
    } catch (e) {
      // Ignore JSON parse errors
    }
    throw new Error(errMsg);
  }
}

// ================= INTERACTIONS =================
export async function fetchUserInteractions(
  userId: string,
  connectionId?: string,
): Promise<Interaction[]> {
  if (!userId) return [];
  const colRef = collection(db, "users", userId, "interactions");
  const snap = await getDocs(colRef);
  let interactions = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Interaction, "id">),
  }));
  if (connectionId) {
    interactions = interactions.filter((i) => i.connectionId === connectionId);
  }
  return interactions.sort((a, b) => {
    const timeA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const timeB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return timeB - timeA;
  });
}

export async function createUserInteraction(
  userId: string,
  interaction: Omit<Interaction, "id">,
): Promise<string> {
  if (!userId) throw new Error("User ID is required");
  const colRef = collection(db, "users", userId, "interactions");
  const now = new Date().toISOString();
  const docRef = await addDoc(colRef, {
    ...interaction,
    occurredAt: interaction.occurredAt || now,
    createdAt: now,
  });
  return docRef.id;
}

export async function updateUserInteraction(
  userId: string,
  interactionId: string,
  data: Partial<Interaction>,
): Promise<void> {
  if (!userId || !interactionId) throw new Error("User ID and Interaction ID are required");
  const docRef = doc(db, "users", userId, "interactions", interactionId);
  await updateDoc(docRef, data);
}

export async function completeMeetingAndRecordInteraction(
  userId: string,
  meetingId: string,
  params: {
    connectionId: string;
    scheduledAt: string;
    location?: string;
    notes?: string;
    rating?: "great" | "good" | "okay" | "not_great" | string;
  },
): Promise<string> {
  if (!userId || !meetingId) throw new Error("User ID and Meeting ID are required");
  const now = new Date().toISOString();

  // 1. Update Meeting status to completed
  const meetingRef = doc(db, "users", userId, "meetings", meetingId);
  await updateDoc(meetingRef, {
    status: "completed",
    updatedAt: now,
  });

  // 2. Create Interaction
  const interactionId = await createUserInteraction(userId, {
    connectionId: params.connectionId,
    type: "meeting",
    channel: params.location || "Meeting",
    notes: params.notes || "",
    rating: params.rating || "good",
    occurredAt: params.scheduledAt || now,
  });

  // 3. Update Connection relationship status to 'met' and lastInteractionAt
  if (params.connectionId) {
    const connRef = doc(db, "users", userId, "connections", params.connectionId);
    await updateDoc(connRef, {
      lastInteractionAt: params.scheduledAt || now,
      relationshipStatus: "met",
      updatedAt: now,
    });
  }

  return interactionId;
}

// ================= PITCH SESSIONS =================
export async function fetchConnectionPitchSessions(
  userId: string,
  connectionId: string,
): Promise<PitchSession[]> {
  if (!userId || !connectionId) return [];
  try {
    const colRef = collection(db, "users", userId, "connections", connectionId, "pitchSessions");
    const snap = await getDocs(colRef);
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PitchSession, "id">),
    })) as PitchSession[];
    return list.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
  } catch (err) {
    console.warn("[dataServices] Could not fetch connection pitch sessions:", err);
    return [];
  }
}

export async function createConnectionPitchSession(
  userId: string,
  connectionId: string,
  session: Omit<PitchSession, "id">,
): Promise<string> {
  if (!userId || !connectionId) throw new Error("User ID and Connection ID are required");
  const colRef = collection(db, "users", userId, "connections", connectionId, "pitchSessions");
  const docRef = await addDoc(colRef, {
    ...session,
    createdAt: session.createdAt || new Date().toISOString(),
  });
  return docRef.id;
}

export async function fetchUserPitchSessions(userId: string): Promise<PitchSession[]> {
  if (!userId) return [];
  const colRef = collection(db, "users", userId, "pitchSessions");
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PitchSession, "id">),
  }));
}

export async function fetchUserPitchSession(
  userId: string,
  pitchId: string,
): Promise<PitchSession | null> {
  if (!userId || !pitchId) return null;
  const docRef = doc(db, "users", userId, "pitchSessions", pitchId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<PitchSession, "id">),
  };
}

export async function createUserPitchSession(
  userId: string,
  session: Omit<PitchSession, "id">,
): Promise<string> {
  if (!userId) throw new Error("User ID is required");
  const colRef = collection(db, "users", userId, "pitchSessions");
  const docRef = await addDoc(colRef, {
    ...session,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

/**
 * Client-side API caller for server-side Pitch Evaluation
 */
export async function triggerPitchEvaluation(params: {
  connectionId: string;
  transcript?: string;
  durationSeconds?: number;
  meetingId?: string;
  audioBase64?: string;
  audioMimeType?: string;
}): Promise<{
  success: boolean;
  sessionId?: string;
  analysis?: PitchCoachAnalysisResult;
  scores?: PitchCoachScores;
  whatWorked?: PitchCoachWhatWorked[];
  improvements?: PitchCoachImprovement[];
  missedOpportunity?: PitchCoachMissedOpportunity;
  strongestElement?: string;
  strongerPitch?: string;
  nextPracticeFocus?: string;
  summary?: string;
  transcript?: string;
  error?: string;
}> {
  const { auth } = await import("@/lib/firebase");
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("You must be signed in to practice your pitch.");
  }

  const response = await fetch(
    `/api/connections/${encodeURIComponent(params.connectionId)}/pitch/evaluate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        connectionId: params.connectionId,
        transcript: params.transcript,
        durationSeconds: params.durationSeconds || 60,
        meetingId: params.meetingId,
        audioBase64: params.audioBase64,
        audioMimeType: params.audioMimeType,
      }),
    },
  );

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to analyze pitch.");
  }

  return data;
}

/**
 * Client-side API caller for server-side Speech-to-Text Transcription
 */
export async function triggerPitchTranscribe(
  audioBase64: string,
  mimeType = "audio/webm",
): Promise<{ success: boolean; transcript?: string; error?: string }> {
  const { auth } = await import("@/lib/firebase");
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("You must be signed in to transcribe audio.");
  }

  const response = await fetch("/api/pitch/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ audioBase64, mimeType }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to transcribe audio.");
  }

  return data;
}

// ================= FOLLOWUPS =================
export async function fetchUserFollowups(userId: string): Promise<Followup[]> {
  if (!userId) return [];
  const colRef = collection(db, "users", userId, "followups");
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Followup, "id">),
  }));
}

export async function createUserFollowup(
  userId: string,
  followup: Omit<Followup, "id">,
): Promise<string> {
  if (!userId) throw new Error("User ID is required");
  const colRef = collection(db, "users", userId, "followups");
  const docRef = await addDoc(colRef, {
    ...followup,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}
