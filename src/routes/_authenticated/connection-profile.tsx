import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, onSnapshot, db } from "@/lib/firebase";
import {
  fetchUserConnection,
  fetchUserConnections,
  updateUserConnection,
  deleteUserConnection,
  fetchUserMeetings,
  triggerResearchPerson,
  generateConnectionIntelligence,
  generateConnectionMentorshipMatch,
  generateConnectionConversationStrategy,
} from "@/services/dataServices";
import { Connection, Meeting, NormalizedLinkedInProfile, UserProfile } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";
import { AddMeetingModal } from "@/components/AddMeetingModal";
import { EditMeetingModal } from "@/components/EditMeetingModal";
import { PostMeetingModal } from "@/components/PostMeetingModal";

export const Route = createFileRoute("/_authenticated/connection-profile")({
  validateSearch: (search: Record<string, unknown>) => ({
    id:
      typeof search.id === "string"
        ? search.id
        : typeof search.connectionId === "string"
          ? search.connectionId
          : typeof search.connection_id === "string"
            ? search.connection_id
            : undefined,
    connectionId:
      typeof search.connectionId === "string"
        ? search.connectionId
        : typeof search.id === "string"
          ? search.id
          : typeof search.connection_id === "string"
            ? search.connection_id
            : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connection Profile — ColdConnect" },
      {
        name: "description",
        content: "Focused networking intelligence, entry points, and conversation prep.",
      },
      { property: "og:title", content: "Connection Profile — ColdConnect" },
      {
        property: "og:description",
        content: "Focused networking intelligence, entry points, and conversation prep.",
      },
    ],
  }),
  component: ConnectionProfilePage,
});

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "requested", label: "Requested" },
  { value: "connected", label: "Connected" },
  { value: "met", label: "Met" },
  { value: "warm", label: "Warm" },
  { value: "strong", label: "Strong" },
];

function normalizeStatus(status?: string): string {
  if (!status) return "new";
  const s = status.toLowerCase();
  if (s.includes("warm")) return "warm";
  if (s.includes("strong")) return "strong";
  if (s.includes("req")) return "requested";
  if (s.includes("connect")) return "connected";
  if (s.includes("met")) return "met";
  if (s.includes("new") || s.includes("cold")) return "new";
  return s;
}

// ================= NETWORKING DATA EXTRACTORS =================

function getSnapshotSummary(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): string {
  if (connection.intelligenceData?.careerSnapshot?.summary) {
    return connection.intelligenceData.careerSnapshot.summary;
  }
  if (connection.careerSnapshot) {
    return connection.careerSnapshot;
  }
  if (norm?.about) {
    const firstSentences = (norm.about || "").split(". ").slice(0, 2).join(". ");
    if (firstSentences.length > 20) {
      return firstSentences.endsWith(".") ? firstSentences : `${firstSentences}.`;
    }
  }

  const role = norm?.currentRole?.title || connection.role;
  const company = norm?.currentRole?.company || connection.company;
  const headline = norm?.identity?.headline || connection.headline;

  if (role && company) {
    const past = norm?.experience && norm.experience.length > 1 ? norm.experience[1].company : null;
    if (past && past !== company) {
      return `${role} at ${company}, transitioning with background from ${past}.`;
    }
    return `Professional operating as ${role} at ${company} driving strategic and functional initiatives.`;
  }

  if (headline) {
    return headline;
  }

  return "Professional profile ready for networking preparation and conversation planning.";
}

function getCurrentFocusText(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): string {
  if (connection.intelligenceData?.currentFocus?.summary) {
    return connection.intelligenceData.currentFocus.summary;
  }
  if (connection.currentFocus) {
    return connection.currentFocus;
  }
  if (norm?.currentRole?.description) {
    return (norm.currentRole.description || "").split("\n")[0];
  }
  const role = norm?.currentRole?.title || connection.role;
  const company = norm?.currentRole?.company || connection.company;
  if (role && company) {
    return `Scaling initiatives and operations as ${role} at ${company}`;
  }
  return "Driving key strategic and professional initiatives";
}

function getBackgroundText(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): string {
  if (
    connection.intelligenceData?.careerSnapshot?.keyPoints &&
    connection.intelligenceData.careerSnapshot.keyPoints.length > 1
  ) {
    return connection.intelligenceData.careerSnapshot.keyPoints[1];
  }

  const pastExps =
    norm?.experience && norm.experience.length > 1 ? norm.experience.slice(1, 3) : [];
  if (pastExps.length > 0) {
    return pastExps.map((e) => [e.company, e.title].filter(Boolean).join(" · ")).join(" | ");
  }

  if (norm?.education && norm.education.length > 0) {
    const edu = norm.education[0];
    const deg = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(" in ");
    return [edu.institution, deg].filter(Boolean).join(" · ");
  }

  return "Strategy & Professional Execution";
}

function getInterestsTags(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): Array<{ label: string; confidence?: "high" | "medium" | "low"; category?: string }> {
  if (
    connection.intelligenceData?.relevantInterests &&
    connection.intelligenceData.relevantInterests.length > 0
  ) {
    return connection.intelligenceData.relevantInterests.map((i) => ({
      label: i.label || i.interest || "",
      confidence: i.confidence,
      category: i.category,
    }));
  }

  if (connection.interests && connection.interests.length > 0) {
    return connection.interests.map((s) => ({ label: s, confidence: "medium" as const }));
  }

  const tags: Array<{ label: string; confidence?: "high" | "medium" | "low" }> = [];
  if (norm?.skills) {
    for (const s of norm.skills) {
      if (tags.length < 6 && !tags.some((t) => t.label === s.name)) {
        tags.push({ label: s.name, confidence: "high" });
      }
    }
  }
  if (tags.length < 6 && norm?.interests?.companies) {
    for (const c of norm.interests.companies) {
      if (tags.length < 6 && !tags.some((t) => t.label === c.name)) {
        tags.push({ label: c.name, confidence: "medium" });
      }
    }
  }
  return tags.length > 0
    ? tags
    : [
        { label: "Strategy", confidence: "medium" },
        { label: "Industry Innovation", confidence: "medium" },
        { label: "Leadership", confidence: "medium" },
      ];
}

function getMentorshipFitData(
  connection: Connection,
  userProfile?: UserProfile | null,
  norm?: NormalizedLinkedInProfile | null,
) {
  if (connection.mentorshipMatch) {
    return {
      whyThisPerson: connection.mentorshipMatch.whyThisPerson,
      whatYouCanLearn: connection.mentorshipMatch.whatCandidateCanLearn.map(
        (l) => `${l.area}: ${l.reason}`,
      ),
      whyTheyWouldHelp: connection.mentorshipMatch.mentorshipFit?.reason || "",
      mostRelevantExperience:
        connection.mentorshipMatch.bestEntryPoint?.topic || "Verified domain trajectory",
      uniquelyQualifiedAsk:
        connection.mentorshipMatch.bestEntryPoint?.suggestedApproach ||
        "How they approach high-stakes operational and strategic decisions.",
    };
  }

  if (connection.intelligenceData?.mentorshipFit) {
    return connection.intelligenceData.mentorshipFit;
  }

  const name = (connection.name || "").split(" ")[0];
  const role = norm?.currentRole?.title || connection.role || "Professional";
  const company = norm?.currentRole?.company || connection.company || "their company";

  return {
    whyThisPerson: `${name} brings verified operating experience as ${role} at ${company}, offering concrete perspective on real-world execution.`,
    whatYouCanLearn: [
      `How to navigate strategic trade-offs and team priorities in ${company}'s domain`,
      `The operational skills that translate between different organizational stages`,
      `How to position yourself for meaningful career growth in this field`,
    ],
    whyTheyWouldHelp:
      "You are asking specific, prepared questions about their domain experience rather than asking for general favors.",
    mostRelevantExperience: `Their current hands-on leadership as ${role} at ${company}`,
    uniquelyQualifiedAsk: `How they balance speed vs. quality in their current operating cadence.`,
  };
}

function getCareerTransitions(connection: Connection, norm?: NormalizedLinkedInProfile | null) {
  if (
    connection.intelligenceData?.careerTransitions &&
    connection.intelligenceData.careerTransitions.length > 0
  ) {
    return connection.intelligenceData.careerTransitions;
  }

  const exp = norm?.experience || [];
  if (exp.length > 1) {
    const cur = exp[0];
    const prev = exp[1];
    return [
      {
        from: `${prev.title} at ${prev.company}`,
        to: `${cur.title} at ${cur.company}`,
        transitionType: prev.company !== cur.company ? "Cross-Company Move" : "Internal Promotion",
        context: `Transitioned from ${prev.company} into ${cur.company}.`,
        mentorshipOpportunity:
          "Understand how mindset and operating cadence changed when stepping into this new environment.",
        suggestedQuestion: `When you moved from ${prev.company} to ${cur.company}, what was the steepest learning curve you faced?`,
      },
    ];
  }

  return [];
}

function getMentorshipQuestionLadder(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
) {
  if (
    connection.conversationStrategy?.questionLadder &&
    connection.conversationStrategy.questionLadder.length > 0
  ) {
    const ql = connection.conversationStrategy.questionLadder;
    const l1 = ql.find((q) => q.level === 1) || ql[0];
    const l2 = ql.find((q) => q.level === 2) || ql[1] || ql[0];
    const l3 = ql.find((q) => q.level === 3) || ql[2] || ql[0];
    const l4 = ql.find((q) => q.level === 4) || ql[3] || ql[0];
    const l5 = ql.find((q) => q.level === 5) || ql[4] || ql[0];

    return {
      level1Warmup: {
        question: l1.question,
        reason: l1.intent || "Easy entry point focusing on active work that is top of mind.",
        objective: "Establish comfortable rapport.",
      },
      level2Experience: {
        question: l2.question,
        reason: l2.intent || "Prompts personal storytelling rooted in concrete experience.",
        objective: "Surface tacit experience.",
      },
      level3Decision: {
        question: l3.question,
        reason: l3.intent || "Explores the reasoning behind high-stakes decisions.",
        objective: "Understand how they evaluate trade-offs.",
      },
      level4Insight: {
        question: l4.question,
        reason: l4.intent || "Surfaces counter-intuitive lessons learned over time.",
        objective: "Unpack hard-won industry truths.",
      },
      level5Advice: {
        question: l5.question,
        reason: l5.intent || "Connects their wisdom directly to your growth.",
        objective: "Gain personalized, actionable advice.",
      },
    };
  }

  if (connection.intelligenceData?.questionLadder) {
    return connection.intelligenceData.questionLadder;
  }

  const role = norm?.currentRole?.title || connection.role || "your role";
  const company = norm?.currentRole?.company || connection.company || "your team";

  return {
    level1Warmup: {
      question: `What is the most interesting project or priority your team at ${company} is currently tackling?`,
      reason: "Easy entry point focusing on active work that is top of mind.",
      objective: "Establish comfortable rapport.",
    },
    level2Experience: {
      question: `Looking across your time as ${role}, what foundational skill proved to be the highest leverage?`,
      reason: "Prompts personal storytelling rooted in concrete experience.",
      objective: "Surface tacit experience.",
    },
    level3Decision: {
      question: `When facing competing strategic directions at ${company}, what mental model helps you make the call?`,
      reason: "Explores the reasoning behind high-stakes decisions.",
      objective: "Understand how they evaluate trade-offs.",
    },
    level4Insight: {
      question: `What is one assumption about this industry you held early on that turned out to be mistaken?`,
      reason: "Surfaces counter-intuitive lessons learned over time.",
      objective: "Unpack hard-won industry truths.",
    },
    level5Advice: {
      question: `For someone looking to build strong capabilities in this space, what should I prioritize investing time in right now?`,
      reason: "Connects their wisdom directly to your growth.",
      objective: "Gain personalized, actionable advice.",
    },
  };
}

function getCandidateIntroduction(
  connection: Connection,
  userProfile?: UserProfile | null,
  norm?: NormalizedLinkedInProfile | null,
) {
  if (connection.conversationStrategy?.candidateIntroduction?.text) {
    const firstName = (connection.name || "").split(" ")[0];
    const myName = userProfile?.fullName || "I";
    const myHeadline = userProfile?.headline || "a professional in this space";
    const targetComp = norm?.currentRole?.company || connection.company || "your team";

    return {
      spokenPitch: connection.conversationStrategy.candidateIntroduction.text,
      structure: {
        whoIAm: `${myName}, ${myHeadline}`,
        currentFocus: "Building foundational domain capabilities and exploring career transitions",
        whyThisExpert: `Following their leadership and trajectory at ${targetComp}`,
        learningGoal: "Understanding decision-making and practical career lessons",
      },
    };
  }

  if (connection.intelligenceData?.candidateIntroduction) {
    return connection.intelligenceData.candidateIntroduction;
  }

  const firstName = (connection.name || "").split(" ")[0];
  const myName = userProfile?.fullName || "I";
  const myHeadline = userProfile?.headline || "a professional in this space";
  const targetComp = norm?.currentRole?.company || connection.company || "your team";

  return {
    spokenPitch: `Hi ${firstName}, thanks so much for taking the time to speak. I'm ${myName}, currently working as ${myHeadline}. I've been following your work at ${targetComp}, and because I'm currently navigating my own growth in this domain, I was eager to learn from your career transitions and operating approach.`,
    structure: {
      whoIAm: `${myName}, ${myHeadline}`,
      currentFocus: "Building foundational domain capabilities and exploring career transitions",
      whyThisExpert: `Following their leadership and trajectory at ${targetComp}`,
      learningGoal: "Understanding decision-making and practical career lessons",
    },
  };
}

function getOutreachMessage(
  connection: Connection,
  userProfile?: UserProfile | null,
  norm?: NormalizedLinkedInProfile | null,
) {
  if (connection.intelligenceData?.outreachMessage?.text) {
    return connection.intelligenceData.outreachMessage;
  }

  const firstName = (connection.name || "").split(" ")[0];
  const targetComp = norm?.currentRole?.company || connection.company || "your team";

  const text = `Hi ${firstName}, I came across your work at ${targetComp} and really respect the trajectory you've built. I'm currently navigating my own growth in this space and would love to ask 2-3 brief questions about your operating mindset. Would you be open to a 15-minute coffee chat?`;

  return {
    text,
    wordCount: (text || "").split(/\s+/).filter(Boolean).length,
  };
}

function getEntryPointData(
  connection: Connection,
  userProfile?: UserProfile | null,
  norm?: NormalizedLinkedInProfile | null,
): { category: string; recommendation: string } {
  // 1. Check AI intelligence entry point / common ground
  if (
    connection.intelligenceData?.commonGround &&
    connection.intelligenceData.commonGround.length > 0
  ) {
    const first = connection.intelligenceData.commonGround[0];
    return {
      category: first.connection || "Professional peer",
      recommendation:
        first.sharedContext ||
        first.point ||
        `Try opening with their transition and focus on ${(getCurrentFocusText(connection, norm) || "").split(".")[0]}.`,
    };
  }

  if (connection.intelligenceData?.whyConnect) {
    return {
      category: "Strategic connection",
      recommendation: connection.intelligenceData.whyConnect,
    };
  }

  // 2. Overlap comparison
  const role = norm?.currentRole?.title || connection.role;
  const company = norm?.currentRole?.company || connection.company;
  const past = norm?.experience && norm.experience.length > 1 ? norm.experience[1].company : null;

  if (past && company) {
    return {
      category: "Professional peer",
      recommendation: `Try opening with their career shift from ${past} into ${company}.`,
    };
  }

  if (role && company) {
    return {
      category: "Industry peer",
      recommendation: `Anchor your conversation around current scaling and challenges at ${company}.`,
    };
  }

  return {
    category: "Professional peer",
    recommendation:
      "Open with domain exploration and curious questions regarding their trajectory.",
  };
}

function getAvailableOpenings(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): Array<{ opening: string; why: string }> {
  const openings: Array<{ opening: string; why: string }> = [];

  // 1. Stage 4 Personalized Best Opening
  if (connection.conversationStrategy?.bestOpening?.text) {
    openings.push({
      opening: connection.conversationStrategy.bestOpening.text,
      why:
        connection.conversationStrategy.bestOpening.whyItWorks ||
        "Connects directly to verified trajectory with authentic curiosity without flattery.",
    });
  }

  // 2. Intelligence Best Opening
  if (connection.intelligenceData?.bestOpening?.opening) {
    const txt = connection.intelligenceData.bestOpening.opening;
    if (!openings.some((o) => o.opening === txt)) {
      openings.push({
        opening: txt,
        why:
          connection.intelligenceData.bestOpening.why ||
          "Connects directly to their current role and career transition.",
      });
    }
  }

  if (
    connection.intelligenceData?.conversationHooks &&
    connection.intelligenceData.conversationHooks.length > 0
  ) {
    for (const h of connection.intelligenceData.conversationHooks) {
      const text = h.suggestedApproach || h.hook || h.topic;
      if (text && !openings.some((o) => o.opening === text)) {
        openings.push({
          opening: text.startsWith('"') ? text.slice(1, -1) : text,
          why: h.why || h.whyItWorks || "Grounds the start of your talk in their recent focus.",
        });
      }
    }
  }

  if (connection.conversationHooks && connection.conversationHooks.length > 0) {
    for (const h of connection.conversationHooks) {
      if (!openings.some((o) => o.opening === h)) {
        openings.push({
          opening: h,
          why: "Highlights specific background details rather than asking generic questions.",
        });
      }
    }
  }

  const role = norm?.currentRole?.title || connection.role;
  const company = norm?.currentRole?.company || connection.company;
  if (role && company && openings.length === 0) {
    openings.push({
      opening: `Hi ${(connection.name || "").split(" ")[0]}, I've been following your work as ${role} at ${company} and was impressed by the trajectory you've built. Would love to learn more about how your team is approaching current market challenges.`,
      why: "Connects directly to their current role and domain leadership.",
    });
  }

  if (openings.length === 0) {
    openings.push({
      opening: `Hi ${(connection.name || "").split(" ")[0]}, I came across your background and would love to connect to exchange perspectives on recent trends in our space.`,
      why: "Sets an authentic, peer-level tone aligned with mutual learning.",
    });
  }

  return openings;
}

function getConversationHooksList(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): Array<{ topic: string; approach: string; why?: string }> {
  // 1. Stage 4 Hooks
  if (
    connection.conversationStrategy?.conversationHooks &&
    connection.conversationStrategy.conversationHooks.length > 0
  ) {
    return connection.conversationStrategy.conversationHooks.map((h) => ({
      topic: h.topic,
      approach: h.question,
      why: h.whyItMatters || h.observation,
    }));
  }

  if (
    connection.intelligenceData?.conversationHooks &&
    connection.intelligenceData.conversationHooks.length > 0
  ) {
    return connection.intelligenceData.conversationHooks.slice(0, 4).map((h, i) => ({
      topic: h.topic || `Focus Area ${i + 1}`,
      approach: h.suggestedApproach || h.hook || h.topic,
      why: h.why || h.whyItWorks,
    }));
  }

  const hooks: Array<{ topic: string; approach: string; why?: string }> = [];
  const curRole = norm?.currentRole?.title || connection.role;
  const curComp = norm?.currentRole?.company || connection.company;

  if (curRole && curComp) {
    hooks.push({
      topic: `${curRole} at ${curComp}`,
      approach: `How ${curComp}'s team is navigating key market shifts and scaling operational priorities.`,
      why: "Directly relates to their current day-to-day responsibilities.",
    });
  }

  const past = norm?.experience && norm.experience.length > 1 ? norm.experience[1] : null;
  if (past && past.company && curComp && past.company !== curComp) {
    hooks.push({
      topic: `Career Shift: ${past.company} → ${curComp}`,
      approach: `Transitioning from ${past.title || "prior role"} at ${past.company} into ${curRole || "current focus"}.`,
      why: "Unpacks the decision-making behind their career progression.",
    });
  }

  if (norm?.skills && norm.skills.length > 0) {
    const topSkill = norm.skills[0].name;
    hooks.push({
      topic: topSkill,
      approach: `Emerging best practices and tools in ${topSkill}.`,
      why: "Engages their domain expertise.",
    });
  }

  return hooks.slice(0, 3);
}

function getRecommendedQuestionsList(
  connection: Connection,
  norm?: NormalizedLinkedInProfile | null,
): Array<{ question: string; reason?: string; category?: string }> {
  // Stage 4 Mentorship Questions
  if (
    connection.conversationStrategy?.mentorshipQuestions &&
    connection.conversationStrategy.mentorshipQuestions.length > 0
  ) {
    return connection.conversationStrategy.mentorshipQuestions.map((mq, idx) => {
      if (typeof mq === "string") {
        return {
          question: mq,
          reason: "Direct mentorship inquiry focused on lessons and actionable advice.",
          category: idx === 0 ? "Experience" : idx === 1 ? "Lesson" : "Advice",
        };
      }
      return {
        question: mq.question,
        reason: mq.intent || "High-leverage mentorship question.",
        category: "Mentorship",
      };
    });
  }

  if (
    connection.intelligenceData?.recommendedQuestions &&
    connection.intelligenceData.recommendedQuestions.length > 0
  ) {
    return connection.intelligenceData.recommendedQuestions.map((q) => ({
      question: q.question,
      reason: q.reason,
      category: q.category,
    }));
  }

  const role = norm?.currentRole?.title || connection.role || "your role";
  const company = norm?.currentRole?.company || connection.company || "your team";

  return [
    {
      question: `What has been the most rewarding strategic challenge you've tackled recently as ${role} at ${company}?`,
      reason: "Open-ended question that prompts positive reflection on their work.",
      category: "Role & Focus",
    },
    {
      question: `How did your previous experiences shape the way you approach decision-making at ${company}?`,
      reason: "Bridges their career history with current execution.",
      category: "Trajectory",
    },
    {
      question: `What is one trend or shift in your space that you think is currently under-discussed?`,
      reason: "Surfaces insider perspective and thought leadership.",
      category: "Industry Perspective",
    },
    {
      question: `What advice would you give to someone looking to navigate a similar transition in this industry?`,
      reason: "Invites actionable mentoring insights.",
      category: "Career Guidance",
    },
  ];
}

function getYourAngleData(
  connection: Connection,
  userProfile?: UserProfile | null,
  norm?: NormalizedLinkedInProfile | null,
): { positioning: string; value: string } {
  if (connection.conversationStrategy?.candidateAngle) {
    return {
      positioning: "Authentic Peer & Mentee",
      value: connection.conversationStrategy.candidateAngle,
    };
  }

  const intelAngle = connection.intelligenceData?.yourAngle;
  if (intelAngle) {
    return {
      positioning: intelAngle.positioning || "Professional peer",
      value:
        intelAngle.value ||
        intelAngle.valueYouCanOffer ||
        "You provide a sounding board for their career transition and bring your own strategic business perspective into the conversation.",
    };
  }

  const role = norm?.currentRole?.title || connection.role || "their domain";

  return {
    positioning: "Professional peer",
    value: `You bring shared business curiosity, fresh cross-functional perspective, and thoughtful discussion on scaling challenges in ${role}.`,
  };
}

function ConnectionProfilePage() {
  const searchParams = Route.useSearch();
  const targetId = searchParams.id || searchParams.connectionId;
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const goBack = useAppBack("/person");

  const [connection, setConnection] = useState<Connection | null>(null);
  const [connMeetings, setConnMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Progressive Disclosure states
  const [conversationPrepOpen, setConversationPrepOpen] = useState(true);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);
  const [openerIndex, setOpenerIndex] = useState(0);

  // Meeting Modals State
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);
  const [isEditMeetingOpen, setIsEditMeetingOpen] = useState(false);
  const [isPostMeetingOpen, setIsPostMeetingOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    company: "",
    role: "",
    linkedinURL: "",
    instagramHandle: "",
    email: "",
    meetingPurpose: "",
    relationshipStatus: "new",
    interestsText: "",
    nextFollowupAt: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Research and Intelligence states
  const [researching, setResearching] = useState(false);
  const [generatingIntelligence, setGeneratingIntelligence] = useState(false);
  const [intelligenceActionError, setIntelligenceActionError] = useState<string | null>(null);

  const upcomingMeeting = useMemo(() => {
    return connMeetings.find((m) => m.status === "upcoming" || m.status === "in_progress") || null;
  }, [connMeetings]);

  const pastMeetings = useMemo(() => {
    return connMeetings.filter((m) => m.status === "completed" || m.status === "cancelled");
  }, [connMeetings]);

  async function load(isMounted = true) {
    if (!user?.uid) return;
    try {
      if (isMounted) setLoading(true);
      let currentConn: Connection | null = null;
      if (targetId) {
        currentConn = await fetchUserConnection(user.uid, targetId);
      } else {
        const list = await fetchUserConnections(user.uid);
        if (list.length > 0) {
          currentConn = list[0];
        }
      }
      if (!isMounted) return;
      setConnection(currentConn);

      if (currentConn?.id) {
        const allMeetings = await fetchUserMeetings(user.uid);
        if (!isMounted) return;
        const filtered = allMeetings.filter((m) => m.connectionId === currentConn!.id);
        setConnMeetings(filtered);
      }

      if (currentConn && isMounted) {
        setEditForm({
          name: currentConn.name || "",
          company: currentConn.company || "",
          role: currentConn.role || "",
          linkedinURL: currentConn.linkedinURL || currentConn.linkedinUrl || "",
          instagramHandle: currentConn.instagramHandle || "",
          email: currentConn.email || "",
          meetingPurpose: currentConn.meetingPurpose || "career_advice",
          relationshipStatus: normalizeStatus(currentConn.relationshipStatus),
          interestsText: (currentConn.interests || []).join(", "),
          nextFollowupAt: currentConn.nextFollowupAt || "",
        });
      }
    } catch (err) {
      console.error("Error loading connection profile:", err);
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;
    load(isMounted);
    return () => {
      isMounted = false;
    };
  }, [user?.uid, targetId]);

  // Real-time Firestore document listener to automatically receive updates when background research completes
  useEffect(() => {
    if (!user?.uid || !connection?.id) return;
    const docRef = doc(db, "users", user.uid, "connections", connection.id);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const freshData = {
            id: snapshot.id,
            ...(snapshot.data() as Omit<Connection, "id">),
          };
          setConnection((prev) => {
            if (!prev) return freshData;
            // Only update if relevant fields have changed to avoid unnecessary re-renders
            if (
              prev.researchStatus !== freshData.researchStatus ||
              prev.intelligenceStatus !== freshData.intelligenceStatus ||
              prev.conversationStatus !== freshData.conversationStatus ||
              prev.mentorshipStatus !== freshData.mentorshipStatus ||
              prev.updatedAt !== freshData.updatedAt ||
              prev.researchCompletedAt !== freshData.researchCompletedAt ||
              prev.company !== freshData.company ||
              prev.role !== freshData.role ||
              prev.headline !== freshData.headline ||
              prev.about !== freshData.about ||
              Boolean(prev.conversationStrategy) !== Boolean(freshData.conversationStrategy) ||
              Boolean(prev.mentorshipMatch) !== Boolean(freshData.mentorshipMatch) ||
              Boolean(prev.intelligenceData) !== Boolean(freshData.intelligenceData) ||
              JSON.stringify(prev.researchData) !== JSON.stringify(freshData.researchData)
            ) {
              return { ...prev, ...freshData };
            }
            return prev;
          });
        }
      },
      (err) => {
        console.warn("[ColdConnect] Snapshot listener notice:", err);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, connection?.id]);

  // Auto-backfill intelligence / conversation strategy when researched but strategy or mentorship match is missing
  useEffect(() => {
    if (!user?.uid || !connection?.id) return;
    if (connection.researchStatus !== "completed") return;

    if (
      !connection.conversationStrategy &&
      connection.conversationStatus !== "generating" &&
      connection.conversationStatus !== "failed" &&
      !generatingIntelligence
    ) {
      generateConnectionConversationStrategy(connection.id)
        .then((res) => {
          if (res.success && res.conversationStrategy) {
            setConnection((prev) =>
              prev && prev.id === connection.id
                ? {
                    ...prev,
                    conversationStrategy: res.conversationStrategy,
                    conversationStatus: "completed",
                  }
                : prev,
            );
          }
        })
        .catch((err) => {
          console.warn("[connection-profile] Auto-strategy trigger notice:", err);
        });
    }
  }, [
    user?.uid,
    connection?.id,
    connection?.researchStatus,
    connection?.conversationStatus,
    connection?.conversationStrategy,
  ]);

  // If connection is in "researching" status upon landing, ensure background research request is in-flight
  useEffect(() => {
    if (!user?.uid || !connection?.id) return;
    const hasUrl = Boolean(connection.linkedinURL || connection.linkedinUrl);
    if (connection.researchStatus === "researching" && hasUrl && !researching) {
      triggerResearchPerson(connection.id, false).catch((err) => {
        console.warn("[ColdConnect] Auto-research trigger notice:", err);
      });
    }
  }, [user?.uid, connection?.id, connection?.researchStatus]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!user?.uid || !connection?.id) return;
    try {
      await updateUserConnection(user.uid, connection.id, {
        relationshipStatus: newStatus,
      });
      setConnection((prev) => (prev ? { ...prev, relationshipStatus: newStatus } : null));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleTriggerResearch = async (forceRefresh: boolean = false) => {
    if (!user?.uid || !connection?.id) return;

    const hasUrl = Boolean(connection.linkedinURL || connection.linkedinUrl);
    if (!hasUrl) {
      setConnection((prev) =>
        prev
          ? {
              ...prev,
              researchStatus: "failed",
              researchError: "LinkedIn URL is required to research this person.",
            }
          : null,
      );
      return;
    }

    try {
      setResearching(true);
      setConnection((prev) =>
        prev
          ? {
              ...prev,
              researchStatus: "researching",
              researchStartedAt: new Date().toISOString(),
              researchError: undefined,
            }
          : null,
      );

      const res = await triggerResearchPerson(connection.id, forceRefresh);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      // Re-fetch connection from database as the source of truth
      const fresh = await fetchUserConnection(user.uid, connection.id);
      if (fresh) {
        setConnection(fresh);
      } else if (res && res.connection) {
        setConnection(res.connection);
      } else {
        await load();
      }
    } catch (err: unknown) {
      console.error("Failed to run research:", err);
      const safeMsg =
        err instanceof Error ? err.message : "LinkedIn profile data could not be retrieved.";
      setConnection((prev) =>
        prev
          ? {
              ...prev,
              researchStatus: "failed",
              researchError: safeMsg,
            }
          : null,
      );
    } finally {
      setResearching(false);
    }
  };

  const handleTriggerIntelligence = async (forceRefresh: boolean = false) => {
    if (!user?.uid || !connection?.id) return;
    if (connection.researchStatus !== "completed") {
      setIntelligenceActionError("Research this profile first before generating intelligence.");
      setTimeout(() => setIntelligenceActionError(null), 4000);
      return;
    }

    try {
      setGeneratingIntelligence(true);
      setIntelligenceActionError(null);
      setConnection((prev) =>
        prev
          ? {
              ...prev,
              intelligenceStatus: "generating",
              intelligenceError: undefined,
            }
          : null,
      );

      const res = await generateConnectionIntelligence(connection.id, forceRefresh);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }

      const fresh = await fetchUserConnection(user.uid, connection.id);
      if (fresh) {
        setConnection(fresh);
      } else if (res && res.intelligenceData) {
        setConnection((prev) =>
          prev
            ? {
                ...prev,
                intelligenceStatus: "completed",
                intelligenceData: res.intelligenceData,
                careerSnapshot: res.intelligenceData?.careerSnapshot?.summary,
                currentFocus: res.intelligenceData?.currentFocus?.summary,
                conversationHooks: res.intelligenceData?.conversationHooks?.map((h) => h.hook),
                recommendedQuestions: res.intelligenceData?.recommendedQuestions?.map(
                  (q) => q.question,
                ),
                commonGround: res.intelligenceData?.commonGround?.map((g) => g.connection),
                thingsToAvoid: res.intelligenceData?.thingsToAvoid,
              }
            : null,
        );
      }
    } catch (err: unknown) {
      console.error("Failed to generate intelligence:", err);
      const safeMsg =
        err instanceof Error ? err.message : "Networking intelligence could not be generated.";
      setIntelligenceActionError(safeMsg);
      setConnection((prev) =>
        prev
          ? {
              ...prev,
              intelligenceStatus: "failed",
              intelligenceError: safeMsg,
            }
          : null,
      );
    } finally {
      setGeneratingIntelligence(false);
    }
  };

  const handleAddNote = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && "key" in e && e.key !== "Enter") return;
    if (e) e.preventDefault();
    if (!newNote.trim() || !user?.uid || !connection?.id) return;

    try {
      setSavingNote(true);
      const existingNotes = Array.isArray(connection.notes)
        ? connection.notes
        : typeof connection.notes === "string" && connection.notes
          ? [connection.notes]
          : [];
      const updatedNotes = [...existingNotes, newNote.trim()];
      await updateUserConnection(user.uid, connection.id, { notes: updatedNotes });
      setConnection({ ...connection, notes: updatedNotes });
      setNewNote("");
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (indexToDelete: number) => {
    if (!user?.uid || !connection?.id) return;
    const existingNotes = Array.isArray(connection.notes)
      ? connection.notes
      : typeof connection.notes === "string" && connection.notes
        ? [connection.notes]
        : [];
    const updatedNotes = existingNotes.filter((_, i) => i !== indexToDelete);
    try {
      await updateUserConnection(user.uid, connection.id, { notes: updatedNotes });
      setConnection({ ...connection, notes: updatedNotes });
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !connection?.id || !editForm.name.trim()) return;

    try {
      setSavingEdit(true);
      const parsedInterests = (editForm.interestsText || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const updatePayload: Partial<Connection> = {
        name: editForm.name.trim(),
        company: editForm.company.trim() || "Independent",
        role: editForm.role.trim() || "Professional",
        linkedinURL: editForm.linkedinURL.trim() || undefined,
        instagramHandle: editForm.instagramHandle.trim() || undefined,
        email: editForm.email.trim() || undefined,
        meetingPurpose: editForm.meetingPurpose || undefined,
        relationshipStatus: editForm.relationshipStatus,
        interests: parsedInterests.length > 0 ? parsedInterests : undefined,
        nextFollowupAt: editForm.nextFollowupAt.trim() || undefined,
      };

      await updateUserConnection(user.uid, connection.id, updatePayload);
      setConnection({
        ...connection,
        ...updatePayload,
      });
      setIsEditing(false);

      // If meeting purpose was updated and intelligence is completed, refresh mentorship match
      const purposeChanged =
        editForm.meetingPurpose && editForm.meetingPurpose !== connection.meetingPurpose;
      if (purposeChanged && connection.researchStatus === "completed") {
        generateConnectionMentorshipMatch(connection.id, {
          meetingPurpose: editForm.meetingPurpose,
          forceRefresh: true,
        }).catch((err) => {
          console.warn("[connection-profile] Background mentorship recalculation notice:", err);
        });
      }
    } catch (err) {
      console.error("Failed to save connection edits:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!user?.uid || !connection?.id) return;
    try {
      setDeleting(true);
      await deleteUserConnection(user.uid, connection.id);
      setShowDeleteModal(false);
      navigate({ to: "/person" });
    } catch (err) {
      console.error("Failed to delete connection:", err);
    } finally {
      setDeleting(false);
    }
  };

  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  return (
    <div className="bg-surface text-on-surface font-body-md antialiased min-h-screen flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* COMPACT STICKY HEADER */}
      <header className="sticky top-0 w-full z-50 bg-surface/95 backdrop-blur-md border-b border-surface-container/40 h-14 transition-all">
        <div className="flex items-center justify-between px-4 sm:px-6 h-full w-full max-w-2xl mx-auto">
          {/* Back button */}
          <button
            onClick={goBack}
            aria-label="Go back"
            className="flex items-center justify-center p-2 -ml-2 text-primary hover:opacity-80 transition-opacity active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>

          {/* Title */}
          <h1 className="font-display text-sm sm:text-base font-bold text-primary truncate max-w-[180px] sm:max-w-xs text-center">
            Connection Profile
          </h1>

          {/* Actions: Edit, Delete, Avatar */}
          <div className="flex items-center gap-1">
            {connection && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit connection"
                  className="p-1.5 text-on-surface-variant hover:text-primary rounded-full hover:bg-surface-container transition-colors active:scale-95"
                  title="Edit Connection"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  aria-label="Delete connection"
                  className="p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container/20 transition-colors active:scale-95"
                  title="Delete Connection"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </>
            )}
            <Link
              to="/profile"
              aria-label="Your profile"
              className="w-7 h-7 rounded-full overflow-hidden hover:opacity-80 transition-opacity active:scale-95 block ml-1 shrink-0 border border-outline-variant/30"
            >
              <img alt="User profile" className="w-full h-full object-cover" src={avatarUrl} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto pt-4 pb-36 px-4 sm:px-6 flex flex-col gap-5 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-9 h-9 border-3 border-primary-container border-t-transparent rounded-full animate-spin mb-3" />
            <p className="font-label-md text-xs text-on-surface-variant">Loading profile...</p>
          </div>
        ) : !connection ? (
          <div className="text-center py-14 bg-surface-container-lowest p-6 rounded-2xl border border-surface-variant/40 shadow-xs">
            <h2 className="font-headline-md text-on-surface mb-2 font-bold">No connection found</h2>
            <p className="font-body-md text-on-surface-variant mb-5 text-xs">
              Please select or add a connection to view their profile.
            </p>
            <Link
              to="/add-person"
              className="bg-primary-container text-on-primary px-5 py-2.5 rounded-xl font-label-md text-xs inline-flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Connection
            </Link>
          </div>
        ) : (
          <>
            {/* ================= 1. COMPACT CONNECTION HERO ================= */}
            <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                {/* Compact Profile Photo */}
                <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container flex items-center justify-center shadow-xs">
                  {connection.profileImage ? (
                    <img
                      alt={connection.name}
                      className="w-full h-full object-cover"
                      src={connection.profileImage}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-3xl">person</span>
                  )}
                </div>

                {/* Identity & Role */}
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-lg sm:text-xl font-bold text-on-surface tracking-tight truncate leading-snug">
                    {connection.name}
                  </h2>
                  {(connection.role || connection.company) && (
                    <p className="font-body-md text-xs text-on-surface-variant font-medium mt-0.5 truncate leading-tight">
                      {[connection.role, connection.company].filter(Boolean).join(" · ")}
                    </p>
                  )}

                  {/* Compact Status Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {/* Status Pill */}
                    <div className="relative inline-flex items-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant border border-outline-variant/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <select
                          value={normalizeStatus(connection.relationshipStatus)}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          aria-label="Connection relationship status"
                          className="bg-transparent text-[10px] font-bold cursor-pointer appearance-none pr-3 outline-none capitalize text-on-surface"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined text-[11px] absolute right-0.5 pointer-events-none opacity-60">
                          expand_more
                        </span>
                      </span>
                    </div>

                    {/* Purpose Badge */}
                    {connection.meetingPurpose && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 capitalize">
                        {connection.meetingPurpose.replace(/_/g, " ")}
                      </span>
                    )}

                    {/* Next Followup Pill */}
                    {connection.nextFollowupAt && (
                      <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5 font-medium">
                        <span className="material-symbols-outlined text-[12px] text-primary">
                          schedule
                        </span>
                        {new Date(connection.nextFollowupAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Compact Social & Contact Row */}
              {(() => {
                const hasLinkedin = Boolean(connection.linkedinURL || connection.linkedinUrl);
                const hasEmail = Boolean(connection.email);
                const hasInstagram = Boolean(connection.instagramHandle);

                if (!hasLinkedin && !hasEmail && !hasInstagram) return null;

                const linkedinLink = connection.linkedinURL || connection.linkedinUrl;

                return (
                  <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-surface-variant/30 text-xs">
                    {hasLinkedin && linkedinLink && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded-lg border border-outline-variant/30 text-xs text-primary max-w-full">
                        <span className="material-symbols-outlined text-[14px]">link</span>
                        <a
                          href={linkedinLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline truncate max-w-[130px] sm:max-w-[180px]"
                        >
                          LinkedIn
                        </a>
                        <button
                          onClick={() => handleCopy(linkedinLink, "linkedin")}
                          className="p-0.5 text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Copy LinkedIn URL"
                          aria-label="Copy LinkedIn URL"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copiedField === "linkedin" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    )}

                    {hasEmail && connection.email && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded-lg border border-outline-variant/30 text-xs text-primary max-w-full">
                        <span className="material-symbols-outlined text-[14px]">mail</span>
                        <a
                          href={`mailto:${connection.email}`}
                          className="font-medium hover:underline truncate max-w-[130px] sm:max-w-[180px]"
                        >
                          {connection.email}
                        </a>
                        <button
                          onClick={() => handleCopy(connection.email!, "email")}
                          className="p-0.5 text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Copy Email"
                          aria-label="Copy Email"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copiedField === "email" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    )}

                    {hasInstagram && connection.instagramHandle && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded-lg border border-outline-variant/30 text-xs text-on-surface max-w-full">
                        <span className="material-symbols-outlined text-[14px] text-primary">
                          photo_camera
                        </span>
                        <span className="font-medium truncate max-w-[110px]">
                          {connection.instagramHandle.startsWith("@")
                            ? connection.instagramHandle
                            : `@${connection.instagramHandle}`}
                        </span>
                        <button
                          onClick={() => handleCopy(connection.instagramHandle!, "instagram")}
                          className="p-0.5 text-on-surface-variant hover:text-on-surface transition-colors"
                          title="Copy handle"
                          aria-label="Copy Instagram Handle"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copiedField === "instagram" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>

            {/* EXTRACTED RESEARCH / INTELLIGENCE DATA */}
            {(() => {
              const norm = connection.researchData?.normalizedProfile;
              const snapshotSummary = getSnapshotSummary(connection, norm);
              const focusText = getCurrentFocusText(connection, norm);
              const backgroundText = getBackgroundText(connection, norm);
              const interestsTags = getInterestsTags(connection, norm);
              const mentorshipFit = getMentorshipFitData(connection, profile, norm);
              const careerTransitions = getCareerTransitions(connection, norm);
              const questionLadder = getMentorshipQuestionLadder(connection, norm);
              const candidateIntro = getCandidateIntroduction(connection, profile, norm);
              const outreachMessage = getOutreachMessage(connection, profile, norm);
              const entryPoint = getEntryPointData(connection, profile, norm);
              const availableOpenings = getAvailableOpenings(connection, norm);
              const currentOpening = availableOpenings[openerIndex % availableOpenings.length];
              const hooksList = getConversationHooksList(connection, norm);
              const questionsList = getRecommendedQuestionsList(connection, norm);
              const yourAngle = getYourAngleData(connection, profile, norm);
              const whatTheyCareAbout = connection.intelligenceData?.whatTheyCareAbout;
              const rawAvoid =
                connection.conversationStrategy?.questionsToAvoid ||
                connection.intelligenceData?.thingsToAvoid ||
                connection.thingsToAvoid ||
                [];
              const thingsToAvoidList: Array<{
                avoid: string;
                reason?: string;
                betterAlternative?: string;
              }> = rawAvoid.map((item) =>
                typeof item === "string"
                  ? { avoid: item }
                  : {
                      avoid:
                        item.avoid ||
                        ("question" in item && typeof item.question === "string"
                          ? item.question
                          : ""),
                      reason: item.reason,
                      betterAlternative: item.betterAlternative,
                    },
              );

              const followUpQuestions = connection.conversationStrategy?.followUpQuestions || [];
              const mentorshipAsk = connection.conversationStrategy?.mentorshipAsk;
              const closingStrategy = connection.conversationStrategy?.closingStrategy;
              const coreObjective = connection.conversationStrategy?.coreObjective;

              const isResearched = connection.researchStatus === "completed";
              const isResearching =
                connection.researchStatus === "researching" ||
                connection.researchStatus === "queued" ||
                researching;
              const isIntelGenerating =
                connection.intelligenceStatus === "generating" || generatingIntelligence;
              const hasIntel = connection.intelligenceStatus === "completed";
              const isFailed = connection.researchStatus === "failed";
              const hasLinkedinUrl = Boolean(connection.linkedinURL || connection.linkedinUrl);

              // Full profile details
              const headline = norm?.identity?.headline || connection.headline;
              const about = norm?.about || connection.about;
              const experienceList =
                norm?.experience && norm.experience.length > 0
                  ? norm.experience
                  : connection.experience || [];
              const educationList =
                norm?.education && norm.education.length > 0
                  ? norm.education
                  : connection.education || [];
              const skillsList =
                norm?.skills && norm.skills.length > 0
                  ? norm.skills
                  : (connection.skills || []).map((s) => ({ name: s }));
              const certsList = norm?.certifications || [];
              const projectsList = norm?.projects || [];
              const pubsList =
                norm?.publications && norm.publications.length > 0
                  ? norm.publications
                  : (connection.publications || []).map((p) => ({ title: p }));
              const awardsList =
                norm?.awards && norm.awards.length > 0
                  ? norm.awards
                  : (connection.achievements || []).map((a) => ({ title: a }));
              const languagesList = norm?.languages || [];
              const orgsList = norm?.organizations || [];
              const interests = norm?.interests;
              const sourcesList = norm?.sources || connection.researchSources || [];

              return (
                <>
                  {/* Feedback Errors */}
                  {intelligenceActionError && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-amber-600">
                        info
                      </span>
                      <span>{intelligenceActionError}</span>
                    </div>
                  )}
                  {connection.researchError && (
                    <div className="p-3 bg-error-container/20 border border-error/30 rounded-xl flex items-center justify-between gap-2 text-xs text-error">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">error</span>
                        <span>Research couldn't be completed</span>
                      </div>
                      <button
                        onClick={() => handleTriggerResearch(true)}
                        className="font-semibold underline hover:opacity-80"
                      >
                        Retry Research
                      </button>
                    </div>
                  )}

                  {/* ================= 2. PERSON SNAPSHOT & WHAT THEY CARE ABOUT ================= */}
                  <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3.5">
                    <div className="flex items-center justify-between border-b border-surface-variant/20 pb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          psychology
                        </span>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                          Person Snapshot & Care Signals
                        </h3>
                      </div>

                      {/* Header Badge Status */}
                      {isResearching ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold">
                          <div className="w-2.5 h-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>RESEARCHING...</span>
                        </div>
                      ) : isResearched ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 rounded-full text-[10px] font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">verified</span>
                            MENTORSHIP READY
                          </span>
                          <button
                            onClick={() => handleTriggerResearch(true)}
                            disabled={researching}
                            title="Re-research profile"
                            aria-label="Re-research profile"
                            className="p-1 text-on-surface-variant hover:text-primary rounded-md transition-colors disabled:opacity-40"
                          >
                            <span className="material-symbols-outlined text-[15px]">refresh</span>
                          </button>
                        </div>
                      ) : !hasLinkedinUrl ? (
                        <span className="text-[10px] font-medium text-on-surface-variant italic">
                          LinkedIn profile not provided
                        </span>
                      ) : null}
                    </div>

                    {/* Research Active In-Card Loading State */}
                    {isResearching && (
                      <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 flex flex-col gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                          <div>
                            <h4 className="text-xs font-bold text-primary">
                              Synthesizing Mentorship Intelligence...
                            </h4>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              Analyzing public professional trajectory, transitions, and
                              high-leverage learning opportunities.
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-surface-container-low h-1 rounded-full overflow-hidden">
                          <div className="bg-primary h-full w-3/4 animate-pulse rounded-full" />
                        </div>
                      </div>
                    )}

                    {/* Concise 1-2 sentence summary */}
                    <p className="text-xs sm:text-sm text-on-surface font-medium leading-relaxed">
                      "{snapshotSummary}"
                    </p>

                    {/* Compact Rows */}
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-surface-variant/20 text-xs">
                      {/* Current Focus */}
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant shrink-0 w-24">
                          Current Focus
                        </span>
                        <span className="text-on-surface font-medium leading-relaxed">
                          {focusText}
                        </span>
                      </div>

                      {/* Background */}
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant shrink-0 w-24">
                          Background
                        </span>
                        <span className="text-on-surface font-medium leading-relaxed">
                          {backgroundText}
                        </span>
                      </div>

                      {/* What They Care About (Tags with Confidence) */}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant shrink-0 w-24 mt-1">
                          Core Signals
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {interestsTags.map((tag, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 text-[11px] font-medium rounded-md border flex items-center gap-1 ${
                                tag.confidence === "high"
                                  ? "bg-primary/5 text-primary border-primary/20"
                                  : "bg-surface-container text-on-surface border-outline-variant/20"
                              }`}
                            >
                              <span>{tag.label}</span>
                              {tag.confidence && (
                                <span
                                  className={`text-[9px] uppercase font-bold tracking-tight opacity-75 ${
                                    tag.confidence === "high"
                                      ? "text-primary"
                                      : "text-on-surface-variant"
                                  }`}
                                >
                                  · {tag.confidence}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Current Priorities if present */}
                      {whatTheyCareAbout?.currentPriorities &&
                        whatTheyCareAbout.currentPriorities.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0 w-24">
                              Priorities
                            </span>
                            <div className="text-on-surface text-xs leading-relaxed space-y-0.5">
                              {whatTheyCareAbout.currentPriorities.map((p, i) => (
                                <p key={i} className="flex items-start gap-1">
                                  <span className="text-primary font-bold">›</span>
                                  <span>{p}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </section>

                  {/* ================= 3. MENTORSHIP FIT (MATCH ANALYSIS) ================= */}
                  <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-surface-variant/20 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          school
                        </span>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                          Mentorship Fit & What You Can Learn
                        </h3>
                      </div>
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        Why This Person
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
                      {mentorshipFit.whyThisPerson}
                    </p>

                    {/* What Candidate Can Learn */}
                    {mentorshipFit.whatYouCanLearn && mentorshipFit.whatYouCanLearn.length > 0 && (
                      <div className="p-3 bg-surface-container-low/50 rounded-xl border border-surface-variant/30 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                          What You Can Realistically Learn:
                        </span>
                        <ul className="space-y-1 text-xs text-on-surface">
                          {mentorshipFit.whatYouCanLearn.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="material-symbols-outlined text-primary text-[14px] mt-0.5 shrink-0">
                                check_circle
                              </span>
                              <span className="leading-snug">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Uniquely Qualified Ask */}
                    {mentorshipFit.uniquelyQualifiedAsk && (
                      <div className="p-2.5 bg-primary/5 rounded-xl border border-primary/15 text-xs flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                          help
                        </span>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                            Uniquely Qualified Question
                          </span>
                          <p className="text-on-surface font-medium mt-0.5">
                            "{mentorshipFit.uniquelyQualifiedAsk}"
                          </p>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ================= 4. CAREER TRANSITIONS & MENTORSHIP OPPORTUNITIES ================= */}
                  {careerTransitions.length > 0 && (
                    <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-surface-variant/20 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-[18px]">
                            alt_route
                          </span>
                          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                            Career Transitions & Learning Moments
                          </h3>
                        </div>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {careerTransitions.length}{" "}
                          {careerTransitions.length === 1 ? "transition" : "transitions"} identified
                        </span>
                      </div>

                      <div className="space-y-3">
                        {careerTransitions.map((ct, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-surface-container-low/50 rounded-xl border border-surface-variant/30 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-bold text-on-surface text-xs">
                                <span>{ct.from}</span>
                                <span className="text-primary font-bold">→</span>
                                <span>{ct.to}</span>
                              </div>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                                {ct.transitionType}
                              </span>
                            </div>

                            {ct.context && (
                              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                {ct.context}
                              </p>
                            )}

                            <div className="pt-1.5 border-t border-surface-variant/20 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                                Mentorship Learning Opportunity:
                              </span>
                              <p className="text-on-surface text-xs leading-relaxed">
                                {ct.mentorshipOpportunity}
                              </p>
                            </div>

                            {ct.suggestedQuestion && (
                              <div className="p-2 bg-primary/5 rounded-lg border border-primary/15 flex items-start justify-between gap-2">
                                <div className="text-[11px] text-on-surface font-medium italic">
                                  "{ct.suggestedQuestion}"
                                </div>
                                <button
                                  onClick={() =>
                                    handleCopy(ct.suggestedQuestion, `transition_q_${idx}`)
                                  }
                                  className="p-1 text-primary hover:opacity-80 shrink-0"
                                  title="Copy suggested question"
                                  aria-label="Copy suggested question"
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {copiedField === `transition_q_${idx}`
                                      ? "check"
                                      : "content_copy"}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ================= 5. CANDIDATE INTRODUCTION & OUTREACH ================= */}
                  <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-surface-variant/20 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          record_voice_over
                        </span>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                          Candidate Introduction (Spoken Pitch)
                        </h3>
                      </div>
                      <button
                        onClick={() => handleCopy(candidateIntro.spokenPitch, "candidate_intro")}
                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {copiedField === "candidate_intro" ? "check" : "content_copy"}
                        </span>
                        <span>
                          {copiedField === "candidate_intro" ? "Copied" : "Copy 30s Pitch"}
                        </span>
                      </button>
                    </div>

                    {/* Spoken Pitch Box */}
                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs sm:text-sm text-on-surface italic leading-relaxed">
                      "{candidateIntro.spokenPitch}"
                    </div>

                    {/* 4-Part Structure */}
                    {candidateIntro.structure && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="p-2 bg-surface-container-low/40 rounded-lg border border-surface-variant/20">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                            1. Who I Am
                          </span>
                          <p className="text-on-surface font-medium mt-0.5">
                            {candidateIntro.structure.whoIAm}
                          </p>
                        </div>
                        <div className="p-2 bg-surface-container-low/40 rounded-lg border border-surface-variant/20">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                            2. Current Focus
                          </span>
                          <p className="text-on-surface font-medium mt-0.5">
                            {candidateIntro.structure.currentFocus}
                          </p>
                        </div>
                        <div className="p-2 bg-surface-container-low/40 rounded-lg border border-surface-variant/20">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                            3. Why This Expert
                          </span>
                          <p className="text-on-surface font-medium mt-0.5">
                            {candidateIntro.structure.whyThisExpert}
                          </p>
                        </div>
                        <div className="p-2 bg-surface-container-low/40 rounded-lg border border-surface-variant/20">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                            4. Learning Goal
                          </span>
                          <p className="text-on-surface font-medium mt-0.5">
                            {candidateIntro.structure.learningGoal}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Natural Outreach Message if requested */}
                    {outreachMessage?.text && (
                      <div className="pt-2 border-t border-surface-variant/20 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Natural Cold Outreach (Email / Note)
                          </span>
                          <button
                            onClick={() => handleCopy(outreachMessage.text, "outreach_msg")}
                            className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {copiedField === "outreach_msg" ? "check" : "content_copy"}
                            </span>
                            <span>{copiedField === "outreach_msg" ? "Copied" : "Copy Note"}</span>
                          </button>
                        </div>
                        <p className="p-2.5 bg-surface-container-low/50 rounded-xl border border-surface-variant/20 text-xs text-on-surface leading-relaxed italic">
                          "{outreachMessage.text}"
                        </p>
                      </div>
                    )}
                  </section>

                  {/* ================= 6. BEST OPENING ================= */}
                  <section className="bg-primary/5 p-4 sm:p-5 rounded-2xl border border-primary/20 shadow-xs flex flex-col gap-2.5 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          chat_bubble
                        </span>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                          Best Opening
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(currentOpening.opening, "best_opening")}
                          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copiedField === "best_opening" ? "check" : "content_copy"}
                          </span>
                          <span>{copiedField === "best_opening" ? "Copied" : "Copy"}</span>
                        </button>
                        {availableOpenings.length > 1 && (
                          <button
                            onClick={() => setOpenerIndex((prev) => prev + 1)}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-0.5 active:scale-95 transition-transform"
                          >
                            <span className="material-symbols-outlined text-[13px]">refresh</span>
                            Next
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Opener quote */}
                    <p className="text-xs sm:text-sm font-semibold text-on-surface italic leading-relaxed">
                      "{currentOpening.opening}"
                    </p>

                    {/* Subtle reason */}
                    <div className="text-[11px] text-on-surface-variant flex items-start gap-1 pt-1 border-t border-primary/10">
                      <span className="font-semibold text-primary shrink-0">Why this works:</span>
                      <span className="leading-snug">{currentOpening.why}</span>
                    </div>
                  </section>

                  {/* ================= 7. MENTORSHIP QUESTION LADDER ================= */}
                  <section className="bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-xs overflow-hidden">
                    <button
                      onClick={() => setConversationPrepOpen(!conversationPrepOpen)}
                      aria-expanded={conversationPrepOpen}
                      className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-surface-container-low/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          stairs
                        </span>
                        <div>
                          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                            Mentorship Question Ladder
                          </h3>
                          <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                            5 progressive depth levels · Warm-up to Actionable Advice
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform">
                        {conversationPrepOpen ? "expand_less" : "expand_more"}
                      </span>
                    </button>

                    {conversationPrepOpen && (
                      <div className="p-4 sm:p-5 pt-0 border-t border-surface-variant/20 flex flex-col gap-3.5">
                        <div className="space-y-2.5 pt-3">
                          {/* Level 1: Warm-up */}
                          <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/25 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                                Level 1: Warm-Up
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Active Focus
                              </span>
                            </div>
                            <p className="font-semibold text-on-surface leading-relaxed">
                              "{questionLadder.level1Warmup.question}"
                            </p>
                            <p className="text-[10px] text-on-surface-variant">
                              Intent: {questionLadder.level1Warmup.reason}
                            </p>
                          </div>

                          {/* Level 2: Experience */}
                          <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/25 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300">
                                Level 2: Experience
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Past Milestones
                              </span>
                            </div>
                            <p className="font-semibold text-on-surface leading-relaxed">
                              "{questionLadder.level2Experience.question}"
                            </p>
                            <p className="text-[10px] text-on-surface-variant">
                              Intent: {questionLadder.level2Experience.reason}
                            </p>
                          </div>

                          {/* Level 3: Decision */}
                          <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/25 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                Level 3: Decision & Pivot
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Mental Models
                              </span>
                            </div>
                            <p className="font-semibold text-on-surface leading-relaxed">
                              "{questionLadder.level3Decision.question}"
                            </p>
                            <p className="text-[10px] text-on-surface-variant">
                              Intent: {questionLadder.level3Decision.reason}
                            </p>
                          </div>

                          {/* Level 4: Insight */}
                          <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/25 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">
                                Level 4: Counter-Intuitive Insight
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Hard-won Lessons
                              </span>
                            </div>
                            <p className="font-semibold text-on-surface leading-relaxed">
                              "{questionLadder.level4Insight.question}"
                            </p>
                            <p className="text-[10px] text-on-surface-variant">
                              Intent: {questionLadder.level4Insight.reason}
                            </p>
                          </div>

                          {/* Level 5: Advice */}
                          <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/25 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                Level 5: Direct Advice
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Your Next Step
                              </span>
                            </div>
                            <p className="font-semibold text-on-surface leading-relaxed">
                              "{questionLadder.level5Advice.question}"
                            </p>
                            <p className="text-[10px] text-on-surface-variant">
                              Intent: {questionLadder.level5Advice.reason}
                            </p>
                          </div>
                        </div>

                        {/* Active Listening Follow-up Triggers */}
                        {followUpQuestions.length > 0 && (
                          <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant/20">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[15px]">hearing</span>
                              Active Listening Follow-Ups
                            </h4>
                            <div className="flex flex-col gap-2">
                              {followUpQuestions.map((fItem, idx) => {
                                const f = fItem as {
                                  trigger?: string;
                                  ifTheyMention?: string;
                                  followUps?: string[];
                                  askThis?: string;
                                };
                                const trigger = f.trigger || f.ifTheyMention || "Specific topic";
                                const questions: string[] = Array.isArray(f.followUps)
                                  ? f.followUps
                                  : f.askThis
                                    ? [f.askThis]
                                    : [];
                                return (
                                  <div
                                    key={idx}
                                    className="text-xs bg-surface-container-low/50 p-2.5 rounded-xl border border-surface-variant/20 flex flex-col gap-1.5"
                                  >
                                    <div className="flex items-start gap-1 text-[11px] text-on-surface-variant font-medium">
                                      <span className="text-primary font-bold shrink-0">
                                        If they mention:
                                      </span>
                                      <span className="italic">"{trigger}"</span>
                                    </div>
                                    {questions.map((qText, qIdx) => (
                                      <div
                                        key={qIdx}
                                        className="p-2 bg-primary/5 rounded-lg border border-primary/10 flex items-start justify-between gap-2"
                                      >
                                        <p className="text-on-surface font-semibold text-xs leading-relaxed">
                                          "{qText}"
                                        </p>
                                        <button
                                          onClick={() =>
                                            handleCopy(qText, `followup_${idx}_${qIdx}`)
                                          }
                                          className="p-0.5 text-primary hover:opacity-80 shrink-0"
                                          title="Copy follow-up question"
                                          aria-label="Copy follow-up question"
                                        >
                                          <span className="material-symbols-outlined text-[13px]">
                                            {copiedField === `followup_${idx}_${qIdx}`
                                              ? "check"
                                              : "content_copy"}
                                          </span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Additional Conversation Hooks */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant/20">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                            Conversation Hooks & Deep Dives
                          </h4>
                          <div className="flex flex-col gap-2">
                            {hooksList.map((h, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-surface-container-low/40 p-2.5 rounded-xl border border-surface-variant/20 flex flex-col gap-0.5"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-primary">{idx + 1}.</span>
                                  <span className="font-bold text-on-surface">{h.topic}</span>
                                </div>
                                <p className="text-on-surface-variant leading-relaxed pl-3.5">
                                  {h.approach}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ================= 8. THINGS TO AVOID ASKING ================= */}
                  {thingsToAvoidList.length > 0 && (
                    <section className="bg-amber-500/5 p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-xs flex flex-col gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-600 text-[18px]">
                          do_not_disturb_on
                        </span>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-300">
                          Things to Avoid Asking
                        </h3>
                      </div>
                      <div className="space-y-2.5 text-xs text-on-surface">
                        {thingsToAvoidList.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-surface-container-lowest/70 rounded-xl border border-amber-500/15 flex flex-col gap-1"
                          >
                            <div className="flex items-start gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                              <span className="text-amber-600 font-bold text-xs mt-0.5 shrink-0">
                                ✕
                              </span>
                              <span className="leading-snug">{item.avoid}</span>
                            </div>
                            {item.reason && (
                              <p className="text-[11px] text-on-surface-variant pl-4 leading-relaxed">
                                <span className="font-semibold text-on-surface">Why avoid:</span>{" "}
                                {item.reason}
                              </p>
                            )}
                            {item.betterAlternative && (
                              <div className="mt-1 p-2 bg-primary/5 rounded-lg border border-primary/10 flex items-start justify-between gap-2 ml-4">
                                <div className="text-[11px] text-primary leading-relaxed">
                                  <span className="font-bold">Ask instead:</span> "
                                  {item.betterAlternative}"
                                </div>
                                <button
                                  onClick={() =>
                                    handleCopy(item.betterAlternative!, `avoid_alt_${idx}`)
                                  }
                                  className="p-0.5 text-primary hover:opacity-80 shrink-0"
                                  title="Copy alternative question"
                                  aria-label="Copy alternative question"
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    {copiedField === `avoid_alt_${idx}` ? "check" : "content_copy"}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* ================= 9. YOUR ANGLE & MENTORSHIP CLOSING ================= */}
                  <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">
                          compass_calibration
                        </span>
                        <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                          Your Angle & Strategic Closing
                        </h3>
                      </div>
                      <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                        {yourAngle.positioning}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-on-surface leading-relaxed">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-0.5">
                        Value to Bridge
                      </span>
                      <p className="text-on-surface-variant">{yourAngle.value}</p>
                    </div>

                    {/* Mentorship Asks (Direct / Soft / Follow-up) */}
                    {mentorshipAsk && (
                      <div className="pt-2 border-t border-surface-variant/20 flex flex-col gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Mentorship Asks
                        </span>

                        {typeof mentorshipAsk === "string" ? (
                          <div className="p-2.5 bg-surface-container-low/50 rounded-xl border border-surface-variant/25 flex flex-col justify-between gap-1.5 text-xs">
                            <p className="text-on-surface font-medium italic leading-relaxed">
                              "{mentorshipAsk}"
                            </p>
                            <button
                              onClick={() => handleCopy(mentorshipAsk, "ask_direct")}
                              className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 self-end mt-1"
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {copiedField === "ask_direct" ? "check" : "content_copy"}
                              </span>
                              <span>{copiedField === "ask_direct" ? "Copied" : "Copy Ask"}</span>
                            </button>
                          </div>
                        ) : (
                          (() => {
                            const askObj = mentorshipAsk as {
                              directAsk?: string;
                              softAsk?: string;
                              followUpCommitment?: string;
                            };
                            return (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  {askObj.directAsk && (
                                    <div className="p-2.5 bg-surface-container-low/50 rounded-xl border border-surface-variant/25 flex flex-col justify-between gap-1.5">
                                      <div>
                                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                                          Direct Ask
                                        </span>
                                        <p className="text-on-surface font-medium mt-0.5 italic">
                                          "{askObj.directAsk}"
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleCopy(askObj.directAsk!, "ask_direct")}
                                        className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 self-end mt-1"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">
                                          {copiedField === "ask_direct" ? "check" : "content_copy"}
                                        </span>
                                        <span>
                                          {copiedField === "ask_direct" ? "Copied" : "Copy"}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                  {askObj.softAsk && (
                                    <div className="p-2.5 bg-surface-container-low/50 rounded-xl border border-surface-variant/25 flex flex-col justify-between gap-1.5">
                                      <div>
                                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                                          Soft Ask
                                        </span>
                                        <p className="text-on-surface font-medium mt-0.5 italic">
                                          "{askObj.softAsk}"
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => handleCopy(askObj.softAsk!, "ask_soft")}
                                        className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5 self-end mt-1"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">
                                          {copiedField === "ask_soft" ? "check" : "content_copy"}
                                        </span>
                                        <span>
                                          {copiedField === "ask_soft" ? "Copied" : "Copy"}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {askObj.followUpCommitment && (
                                  <div className="p-2.5 bg-primary/5 rounded-xl border border-primary/15 text-xs flex items-start gap-2">
                                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0 mt-0.5">
                                      event_repeat
                                    </span>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                                        Follow-up Commitment
                                      </span>
                                      <p className="text-on-surface font-medium mt-0.5">
                                        {askObj.followUpCommitment}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()
                        )}
                      </div>
                    )}

                    {/* Closing Strategy */}
                    {closingStrategy && (
                      <div className="pt-2 border-t border-surface-variant/20 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-0.5">
                          Closing Recommendation
                        </span>
                        <p className="text-on-surface leading-relaxed font-medium">
                          {closingStrategy}
                        </p>
                      </div>
                    )}
                  </section>

                  {/* ================= 10. FULL PROFILE (COLLAPSIBLE) ================= */}
                  {isResearched && (
                    <section className="bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-xs overflow-hidden">
                      <button
                        onClick={() => setShowFullProfile(!showFullProfile)}
                        aria-expanded={showFullProfile}
                        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-surface-container-low/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">
                            badge
                          </span>
                          <div>
                            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                              Full Profile
                            </h3>
                            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
                              Experience · Education · Public research verification
                            </p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant transition-transform">
                          {showFullProfile ? "expand_less" : "expand_more"}
                        </span>
                      </button>

                      {showFullProfile && (
                        <div className="p-4 sm:p-5 pt-0 border-t border-surface-variant/20 space-y-4">
                          {/* Headline & About */}
                          {(headline || about) && (
                            <div className="p-3.5 bg-surface-container-low/40 rounded-xl border border-surface-variant/30 space-y-1 mt-3">
                              {headline && (
                                <p className="text-xs font-semibold text-primary">{headline}</p>
                              )}
                              {about && (
                                <p className="text-xs text-on-surface leading-relaxed whitespace-pre-line">
                                  {about}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Experience */}
                          {experienceList.length > 0 && (
                            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/30 space-y-2">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block">
                                Experience
                              </span>
                              <div className="space-y-2">
                                {experienceList.map((exp, idx) => {
                                  const title = "title" in exp ? exp.title : exp.role;
                                  const company = exp.company;
                                  const duration =
                                    exp.duration ||
                                    ("startDate" in exp &&
                                      [exp.startDate, exp.endDate].filter(Boolean).join(" - ")) ||
                                    undefined;
                                  const desc = exp.description;

                                  return (
                                    <div
                                      key={idx}
                                      className="text-xs border-b border-surface-variant/20 last:border-0 pb-2 last:pb-0"
                                    >
                                      <p className="font-semibold text-on-surface">
                                        {title} {company ? `· ${company}` : ""}
                                      </p>
                                      {duration && (
                                        <p className="text-[10px] text-on-surface-variant">
                                          {duration}
                                        </p>
                                      )}
                                      {desc && (
                                        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed line-clamp-3">
                                          {desc}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Education */}
                          {educationList.length > 0 && (
                            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/30 space-y-2">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block">
                                Education
                              </span>
                              <div className="space-y-1.5">
                                {educationList.map((edu, idx) => {
                                  const inst = "institution" in edu ? edu.institution : edu.school;
                                  const degree = edu.degree;
                                  const field = edu.fieldOfStudy;
                                  const dates =
                                    "startDate" in edu
                                      ? [edu.startDate, edu.endDate].filter(Boolean).join(" - ")
                                      : edu.year;

                                  return (
                                    <div
                                      key={idx}
                                      className="text-xs border-b border-surface-variant/20 last:border-0 pb-1.5 last:pb-0"
                                    >
                                      <p className="font-semibold text-on-surface">{inst}</p>
                                      {(degree || field || dates) && (
                                        <p className="text-[10px] text-on-surface-variant">
                                          {[degree, field, dates].filter(Boolean).join(" · ")}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Skills */}
                          {skillsList.length > 0 && (
                            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/30">
                              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block mb-1.5">
                                Skills & Expertise
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {skillsList.map((skill, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-surface-container text-on-surface text-[10px] rounded-md border border-outline-variant/20"
                                  >
                                    {skill.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Certifications & Awards */}
                          {(certsList.length > 0 || awardsList.length > 0) && (
                            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/30 space-y-2">
                              {certsList.length > 0 && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block mb-1">
                                    Certifications
                                  </span>
                                  <ul className="space-y-1">
                                    {certsList.map((c, idx) => (
                                      <li key={idx} className="text-xs text-on-surface">
                                        <span className="font-medium">{c.name}</span>
                                        {c.issuingOrganization && (
                                          <span className="text-on-surface-variant text-[10px]">
                                            {" "}
                                            · {c.issuingOrganization}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {awardsList.length > 0 && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block mb-1">
                                    Honors & Awards
                                  </span>
                                  <ul className="space-y-1">
                                    {awardsList.map((a, idx) => (
                                      <li key={idx} className="text-xs text-on-surface">
                                        <span className="font-medium">{a.title}</span>
                                        {a.issuer && (
                                          <span className="text-on-surface-variant text-[10px]">
                                            {" "}
                                            · {a.issuer}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Projects, Pubs, Languages */}
                          {(projectsList.length > 0 ||
                            pubsList.length > 0 ||
                            languagesList.length > 0 ||
                            orgsList.length > 0) && (
                            <div className="p-3 bg-surface-container-low/40 rounded-xl border border-surface-variant/30 space-y-2">
                              {projectsList.length > 0 && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block mb-1">
                                    Projects
                                  </span>
                                  <ul className="space-y-1">
                                    {projectsList.map((proj, idx) => (
                                      <li key={idx} className="text-xs text-on-surface">
                                        <span className="font-medium">{proj.title}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {languagesList.length > 0 && (
                                <div>
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant block mb-1">
                                    Languages
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {languagesList.map((lang, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] px-2 py-0.5 bg-surface-container rounded border border-outline-variant/20"
                                      >
                                        {lang.language}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sources Attribution */}
                          {sourcesList.length > 0 && (
                            <div className="pt-2 border-t border-surface-variant/30 flex items-center justify-between text-[10px] text-on-surface-variant">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">
                                  verified
                                </span>
                                Verified Source: {sourcesList[0].source || "LinkedIn / Public Web"}
                              </span>
                              {connection.lastResearchUpdatedAt && (
                                <span>
                                  Updated:{" "}
                                  {new Date(connection.lastResearchUpdatedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </>
              );
            })()}

            {/* ================= 8. RELATIONSHIP MANAGEMENT (MEETINGS & NOTES) ================= */}
            <div className="flex flex-col gap-4 mt-1">
              {/* MEETINGS SECTION */}
              <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-surface-variant/20 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      calendar_month
                    </span>
                    <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                      Meetings
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAddMeetingOpen(true)}
                    className="text-xs text-primary hover:bg-primary/5 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Schedule
                  </button>
                </div>

                {upcomingMeeting ? (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                        <span className="bg-primary/20 text-primary text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                          Upcoming
                        </span>
                        <span className="truncate">{upcomingMeeting.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedMeeting(upcomingMeeting);
                            setIsPostMeetingOpen(true);
                          }}
                          className="px-2 py-0.5 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded text-[11px] font-semibold"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMeeting(upcomingMeeting);
                            setIsEditMeetingOpen(true);
                          }}
                          className="p-1 text-on-surface-variant hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
                      <span className="font-medium text-on-surface">
                        {new Date(upcomingMeeting.scheduledAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {new Date(upcomingMeeting.scheduledAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>{upcomingMeeting.location || "Coffee chat"}</span>
                    </div>

                    <Link
                      to="/pitch-prep"
                      search={{ meetingId: upcomingMeeting.id, id: connection.id }}
                      className="w-full bg-primary-container text-white rounded-lg py-2 font-label-md text-xs hover:opacity-90 transition-opacity active:scale-[0.98] text-center flex items-center justify-center gap-1 mt-1 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                      Prepare for Meeting
                    </Link>
                  </div>
                ) : (
                  <div className="p-3 bg-surface-container-low/40 rounded-xl text-center border border-dashed border-surface-variant/50 flex flex-col items-center justify-center gap-1.5">
                    <p className="font-body-md text-on-surface-variant text-xs">
                      No upcoming meetings
                    </p>
                    <button
                      onClick={() => setIsAddMeetingOpen(true)}
                      className="text-primary font-semibold text-xs hover:underline inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">calendar_add_on</span>
                      + Schedule
                    </button>
                  </div>
                )}

                {/* Past Meetings if any */}
                {pastMeetings.length > 0 && (
                  <div className="pt-2 border-t border-surface-variant/20 space-y-1.5">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                      Past Meetings ({pastMeetings.length})
                    </span>
                    {pastMeetings.map((m) => (
                      <div
                        key={m.id}
                        className="p-2 bg-surface-container-low/50 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="truncate">
                          <span className="font-medium text-on-surface">{m.title}</span>
                          <span className="text-on-surface-variant text-[10px] ml-1.5">
                            {new Date(m.scheduledAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <Link
                          to="/pitch-prep"
                          search={{ meetingId: m.id, id: connection.id }}
                          className="text-primary hover:underline text-[11px] font-medium shrink-0"
                        >
                          Details
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* NOTES SECTION */}
              <section className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-variant/40 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-surface-variant/20 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      edit_note
                    </span>
                    <h3 className="font-display font-bold text-xs uppercase tracking-wider text-primary">
                      Notes
                    </h3>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    {Array.isArray(connection.notes)
                      ? connection.notes.length
                      : connection.notes
                        ? 1
                        : 0}{" "}
                    notes
                  </span>
                </div>

                {connection.notes &&
                (Array.isArray(connection.notes)
                  ? connection.notes.length > 0
                  : Boolean(connection.notes)) ? (
                  <ul className="space-y-1.5">
                    {(Array.isArray(connection.notes) ? connection.notes : [connection.notes]).map(
                      (note, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 bg-surface-container-low/60 rounded-xl flex items-start justify-between gap-2 text-xs text-on-surface"
                        >
                          <p className="flex-1 leading-relaxed">{note}</p>
                          <button
                            onClick={() => handleDeleteNote(idx)}
                            className="text-on-surface-variant hover:text-error p-0.5 rounded transition-colors"
                            title="Delete note"
                            aria-label="Delete note"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="font-body-md text-on-surface-variant italic text-xs">
                    0 notes recorded yet.
                  </p>
                )}

                <div className="flex gap-2 items-center mt-0.5">
                  <div className="flex-1 bg-surface-container-low rounded-xl px-3 py-2 border border-surface-variant focus-within:border-primary transition-colors">
                    <input
                      type="text"
                      className="w-full bg-transparent border-none focus:ring-0 font-body-md text-xs text-on-surface placeholder:text-on-surface-variant/50 p-0 m-0 outline-none"
                      placeholder="Add a new note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={handleAddNote}
                      disabled={savingNote}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddNote()}
                    disabled={savingNote || !newNote.trim()}
                    className="px-3.5 py-2 bg-primary-container text-on-primary rounded-xl font-label-md text-xs hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0 active:scale-95 shadow-xs"
                  >
                    {savingNote ? "Adding..." : "Add"}
                  </button>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {/* ================= STICKY BOTTOM ACTION BAR ================= */}
      {connection && (
        <div className="fixed bottom-0 left-0 w-full z-40 bg-surface/95 backdrop-blur-md border-t border-surface-container/40 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Secondary CTA: Reach Out */}
            <Link
              to="/connection-options"
              search={{ id: connection.id }}
              className="flex-1 h-11 bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded-xl font-label-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-xs"
            >
              <span>Reach Out</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </Link>

            {/* Primary CTA: Practice Pitch */}
            <Link
              to="/record"
              search={{ id: connection.id, connectionId: connection.id }}
              onClick={() => {
                console.log("[ColdConnect] Practice Pitch clicked");
                console.log(`[ColdConnect] Current connection ID: ${connection.id}`);
                console.log(`[ColdConnect] Current connection name: ${connection.name}`);
                console.log("[ColdConnect] Navigating to Practice Pitch");
              }}
              className="flex-1 h-11 bg-primary-container text-on-primary hover:opacity-95 rounded-xl font-label-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all shadow-tactile active:scale-[0.98]"
            >
              <span>Practice Pitch</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* Edit Connection Modal */}
      {isEditing && connection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-lg w-full border border-surface-variant/50 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-variant pb-3 mb-4">
              <h3 className="font-headline-md font-bold text-on-surface">Edit Connection</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-label-md text-on-surface-variant">Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label-md text-on-surface-variant">Company</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label-md text-on-surface-variant">Role</label>
                  <input
                    type="text"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-label-md text-on-surface-variant">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={editForm.linkedinURL}
                  onChange={(e) => setEditForm({ ...editForm, linkedinURL: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label-md text-on-surface-variant">Instagram</label>
                  <input
                    type="text"
                    value={editForm.instagramHandle}
                    onChange={(e) => setEditForm({ ...editForm, instagramHandle: e.target.value })}
                    placeholder="@username"
                    className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label-md text-on-surface-variant">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="name@company.com"
                    className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label-md text-on-surface-variant">Status</label>
                  <select
                    value={editForm.relationshipStatus}
                    onChange={(e) =>
                      setEditForm({ ...editForm, relationshipStatus: e.target.value })
                    }
                    className="px-3 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary capitalize"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-label-md text-on-surface-variant">
                    Next Follow-up
                  </label>
                  <input
                    type="date"
                    value={editForm.nextFollowupAt}
                    onChange={(e) => setEditForm({ ...editForm, nextFollowupAt: e.target.value })}
                    className="px-3 py-2 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-label-md text-on-surface-variant">
                  Interests (comma separated)
                </label>
                <input
                  type="text"
                  value={editForm.interestsText}
                  onChange={(e) => setEditForm({ ...editForm, interestsText: e.target.value })}
                  placeholder="Strategy, Product, AI"
                  className="px-3.5 py-2.5 bg-surface-container-low text-on-surface rounded-xl border border-outline-variant/40 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-surface-variant">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm rounded-xl font-label-md bg-surface-container text-on-surface hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-sm rounded-xl font-label-md bg-primary-container text-on-primary hover:opacity-90 flex items-center gap-2"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && connection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full border border-surface-variant/50 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
                Delete Connection?
              </h3>
            </div>
            <p className="font-body-md text-on-surface-variant">
              Are you sure you want to remove{" "}
              <strong className="text-on-surface">{connection.name}</strong> from your network? This
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl font-label-md text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConnection}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl font-label-md text-white bg-error hover:bg-error/90 flex items-center gap-2 transition-colors shadow-sm"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Connection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Modals */}
      <AddMeetingModal
        isOpen={isAddMeetingOpen}
        initialConnectionId={connection?.id}
        onClose={() => setIsAddMeetingOpen(false)}
        onSuccess={() => {
          load();
        }}
      />

      <EditMeetingModal
        isOpen={isEditMeetingOpen}
        meeting={selectedMeeting}
        onClose={() => setIsEditMeetingOpen(false)}
        onUpdated={() => {
          load();
        }}
        onCancelled={() => {
          load();
        }}
      />

      <PostMeetingModal
        isOpen={isPostMeetingOpen}
        meeting={selectedMeeting}
        onClose={() => setIsPostMeetingOpen(false)}
        onCompleted={() => {
          load();
        }}
        onScheduleFollowup={(cid) => {
          navigate({
            to: "/connection-options",
            search: { id: cid },
          });
        }}
      />
    </div>
  );
}
