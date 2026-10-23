import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUserConnections,
  fetchUserConnection,
  deleteUserConnection,
  updateUserConnection,
  researchConnection,
  generateConnectionIntelligence,
  generateConnectionConversationStrategy,
} from "@/services/dataServices";
import { db, collection, onSnapshot } from "@/lib/firebase";
import { Connection } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/person")({
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
      { title: "Network & Intelligence — ColdConnect" },
      {
        name: "description",
        content: "Explore your network, prepare conversation intelligence and track connections.",
      },
      { property: "og:title", content: "Network & Intelligence — ColdConnect" },
      {
        property: "og:description",
        content: "Explore your network, prepare conversation intelligence and track connections.",
      },
    ],
  }),
  component: PersonPage,
});

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "requested", label: "Requested" },
  { id: "connected", label: "Connected" },
  { id: "met", label: "Met" },
  { id: "warm", label: "Warm" },
  { id: "strong", label: "Strong" },
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

function getStatusBadgeStyle(status?: string) {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "strong":
      return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800";
    case "warm":
      return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800";
    case "connected":
      return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800";
    case "met":
      return "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800";
    case "requested":
      return "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800";
    case "new":
    default:
      return "bg-surface-container-high text-on-surface-variant border border-outline-variant/40";
  }
}

interface HookItem {
  title?: string;
  text: string;
  why?: string;
}

interface QuestionItem {
  question: string;
  category?: string;
  reason?: string;
}

function getPersonConversationHooks(conn: Connection): HookItem[] {
  // 1. Stage 4 Conversation Strategy Hooks
  if (
    conn.conversationStrategy?.conversationHooks &&
    conn.conversationStrategy.conversationHooks.length > 0
  ) {
    return conn.conversationStrategy.conversationHooks.map((h) => ({
      title: h.topic,
      text: h.question || h.observation || h.topic,
      why: h.whyItMatters || h.observation,
    }));
  }

  // 2. Stage 2 Intelligence Data Hooks
  if (
    conn.intelligenceData?.conversationHooks &&
    conn.intelligenceData.conversationHooks.length > 0
  ) {
    return conn.intelligenceData.conversationHooks.map((h) => ({
      title: h.topic,
      text: h.suggestedApproach || h.hook || h.topic,
      why: h.why || h.whyItWorks,
    }));
  }

  // 3. Structured Intelligence Starters
  const sInt =
    conn.structuredIntelligence ||
    (conn.intelligence && "conversationStarters" in conn.intelligence
      ? (conn.intelligence as unknown as {
          conversationStarters?: Array<{ topic?: string; starter?: string; context?: string }>;
        })
      : null);
  if (sInt?.conversationStarters && sInt.conversationStarters.length > 0) {
    return sInt.conversationStarters.map((cs) => ({
      title: cs.topic || cs.context,
      text: cs.starter || cs.topic || "",
    }));
  }

  // 4. Flat array
  if (conn.conversationHooks && conn.conversationHooks.length > 0) {
    return conn.conversationHooks.map((h) =>
      typeof h === "string"
        ? { text: h }
        : {
            title: (h as { topic?: string }).topic,
            text:
              (h as { hook?: string; text?: string }).hook ||
              (h as { text?: string }).text ||
              String(h),
          },
    );
  }

  // 5. If researched, derive personalized contextual hooks from researched profile
  if (conn.researchStatus === "completed") {
    const norm = conn.researchData?.normalizedProfile;
    const curRole = norm?.currentRole?.title || conn.role;
    const curComp = norm?.currentRole?.company || conn.company;
    if (curRole && curComp) {
      const hooks: HookItem[] = [
        {
          title: `${curRole} at ${curComp}`,
          text: `How your team at ${curComp} is currently approaching strategic priorities and navigating current industry shifts.`,
          why: "Engages directly with their current day-to-day focus.",
        },
      ];
      const past = norm?.experience && norm.experience.length > 1 ? norm.experience[1] : null;
      if (past && past.company && past.company !== curComp) {
        hooks.push({
          title: `Career Shift: ${past.company} → ${curComp}`,
          text: `What the learning curve looked like transitioning from ${past.title || "prior role"} at ${past.company} into ${curComp}.`,
          why: "Surfaces decision-making behind their career progression.",
        });
      }
      if (norm?.skills && norm.skills.length > 0) {
        hooks.push({
          title: norm.skills[0].name,
          text: `Tactical approaches and emerging tools you're finding most effective in ${norm.skills[0].name}.`,
          why: "Taps into their core domain depth.",
        });
      }
      return hooks;
    }
  }

  return [];
}

function getPersonRecommendedQuestions(conn: Connection): QuestionItem[] {
  // 1. Stage 4 Mentorship Questions
  if (
    conn.conversationStrategy?.mentorshipQuestions &&
    conn.conversationStrategy.mentorshipQuestions.length > 0
  ) {
    return conn.conversationStrategy.mentorshipQuestions.map((mq, idx) => {
      if (typeof mq === "string") {
        return {
          question: mq,
          category: idx === 0 ? "Experience" : idx === 1 ? "Lesson" : "Advice",
        };
      }
      return {
        question: mq.question,
        category: mq.category || "Mentorship",
        reason: mq.intent,
      };
    });
  }

  // 2. Stage 4 Question Ladder
  if (
    conn.conversationStrategy?.questionLadder &&
    conn.conversationStrategy.questionLadder.length > 0
  ) {
    return conn.conversationStrategy.questionLadder.map((l) => ({
      question: l.question,
      category: `Level ${l.level}: ${l.intent || "Depth"}`,
      reason: l.intent,
    }));
  }

  // 3. Stage 2 Intelligence Questions
  if (
    conn.intelligenceData?.recommendedQuestions &&
    conn.intelligenceData.recommendedQuestions.length > 0
  ) {
    return conn.intelligenceData.recommendedQuestions.map((q) => ({
      question: q.question,
      category: q.category,
      reason: q.reason,
    }));
  }

  // 4. Flat array
  if (conn.recommendedQuestions && conn.recommendedQuestions.length > 0) {
    return conn.recommendedQuestions.map((q) =>
      typeof q === "string"
        ? { question: q }
        : { question: (q as { question?: string }).question || String(q) },
    );
  }

  // 5. If researched, derive personalized contextual questions
  if (conn.researchStatus === "completed") {
    const norm = conn.researchData?.normalizedProfile;
    const curRole = norm?.currentRole?.title || conn.role || "your role";
    const curComp = norm?.currentRole?.company || conn.company || "your team";

    return [
      {
        question: `What has been the most interesting strategic challenge you've tackled recently as ${curRole} at ${curComp}?`,
        category: "Role & Focus",
        reason: "Prompts positive reflection on active work.",
      },
      {
        question: `Looking across your trajectory, what foundational skill or mindset proved to be highest leverage?`,
        category: "Career Strategy",
        reason: "Surfaces tacit experience and operating principles.",
      },
      {
        question: `For someone looking to build strong capabilities in this space, what should I prioritize investing time in right now?`,
        category: "Actionable Advice",
        reason: "Connects their wisdom directly to your growth.",
      },
    ];
  }

  return [];
}

function PersonPage() {
  const { id } = Route.useSearch();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const goBack = useAppBack("/");

  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [generatingIntelId, setGeneratingIntelId] = useState<string | null>(null);
  const [intelActionError, setIntelActionError] = useState<string | null>(null);

  // Initial load and real-time Firestore sync
  useEffect(() => {
    if (!user?.uid) return;

    // Listen in real-time to the connections collection
    const colRef = collection(db, "users", user.uid, "connections");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Connection, "id">),
        }));
        items.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        setConnections(items);
        setLoading(false);

        // Keep selection stable
        setSelectedId((currSelectedId) => {
          if (currSelectedId && items.some((c) => c.id === currSelectedId)) {
            return currSelectedId;
          }
          if (id && items.some((c) => c.id === id)) {
            return id;
          }
          return items.length > 0 ? items[0].id : undefined;
        });
      },
      (err) => {
        console.warn("[person] Firestore onSnapshot notice:", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, id]);

  const handleResearchConnection = async (connId: string, forceRefresh = false) => {
    const targetConn = connections.find((c) => c.id === connId) || selectedConnection;
    if (!targetConn || !user?.uid) return;

    const hasUrl = Boolean(targetConn.linkedinURL || targetConn.linkedinUrl);

    console.log("[ColdConnect] Research button clicked");
    console.log(`[ColdConnect] connectionId: ${connId}`);
    console.log(`[ColdConnect] authenticated user present: ${Boolean(user?.uid)}`);
    console.log(`[ColdConnect] connection found: ${Boolean(targetConn)}`);
    console.log(`[ColdConnect] linkedinUrl present: ${hasUrl}`);

    if (!hasUrl) {
      setResearchError("LinkedIn URL is required to research this person.");
      setTimeout(() => setResearchError(null), 5000);
      return;
    }

    console.log("[ColdConnect] research request started");
    setResearchingId(connId);
    setResearchError(null);

    // Immediately update local state to "researching"
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connId
          ? {
              ...c,
              researchStatus: "researching",
              researchStartedAt: new Date().toISOString(),
              researchError: undefined,
            }
          : c,
      ),
    );

    try {
      const res = await researchConnection(connId, forceRefresh);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }
      // Re-fetch fresh connection from database as source of truth
      const freshConn = await fetchUserConnection(user.uid, connId);
      if (freshConn) {
        setConnections((prev) => prev.map((c) => (c.id === connId ? freshConn : c)));
      } else if (res.connection) {
        setConnections((prev) => prev.map((c) => (c.id === connId ? res.connection! : c)));
      }
    } catch (err: unknown) {
      console.error("Failed to run research:", err);
      const msg =
        err instanceof Error ? err.message : "LinkedIn profile data could not be retrieved.";
      setResearchError(msg);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connId
            ? {
                ...c,
                researchStatus: "failed",
                researchError: msg,
              }
            : c,
        ),
      );
    } finally {
      setResearchingId(null);
    }
  };

  const handleGenerateIntelligence = async (connId: string, forceRefresh = false) => {
    const targetConn = connections.find((c) => c.id === connId) || selectedConnection;
    if (!targetConn || !user?.uid) return;

    if (targetConn.researchStatus !== "completed") {
      setIntelActionError("Research profile with LinkedIn first.");
      setTimeout(() => setIntelActionError(null), 4000);
      return;
    }

    setGeneratingIntelId(connId);
    setIntelActionError(null);

    setConnections((prev) =>
      prev.map((c) =>
        c.id === connId
          ? {
              ...c,
              intelligenceStatus: "generating",
              intelligenceError: undefined,
            }
          : c,
      ),
    );

    try {
      const res = await generateConnectionIntelligence(connId, forceRefresh);
      if (!res.success && res.error) {
        throw new Error(res.error);
      }
      const freshConn = await fetchUserConnection(user.uid, connId);
      if (freshConn) {
        setConnections((prev) => prev.map((c) => (c.id === connId ? freshConn : c)));
      }
    } catch (err: unknown) {
      console.error("Failed to generate intelligence:", err);
      const msg = err instanceof Error ? err.message : "Intelligence could not be generated.";
      setIntelActionError(msg);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connId
            ? {
                ...c,
                intelligenceStatus: "failed",
                intelligenceError: msg,
              }
            : c,
        ),
      );
    } finally {
      setGeneratingIntelId(null);
    }
  };

  const filteredConnections = useMemo(() => {
    return connections.filter((conn) => {
      // Filter by relationship status
      if (selectedFilter !== "all") {
        const normStatus = normalizeStatus(conn.relationshipStatus);
        if (normStatus !== selectedFilter) return false;
      }

      // Search query across name, company, role, interests, notes
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = conn.name?.toLowerCase().includes(query);
        const compMatch = conn.company?.toLowerCase().includes(query);
        const roleMatch = conn.role?.toLowerCase().includes(query);
        const interestsMatch = conn.interests?.some((i) => i.toLowerCase().includes(query));
        const notesMatch = Array.isArray(conn.notes)
          ? conn.notes.some((n) => n.toLowerCase().includes(query))
          : typeof conn.notes === "string"
            ? conn.notes.toLowerCase().includes(query)
            : false;

        if (!nameMatch && !compMatch && !roleMatch && !interestsMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [connections, selectedFilter, searchQuery]);

  const selectedConnection = useMemo(() => {
    if (!selectedId) return filteredConnections[0] || connections[0] || null;
    const direct = connections.find((c) => c.id === selectedId);
    if (direct) return direct;
    return filteredConnections[0] || connections[0] || null;
  }, [connections, filteredConnections, selectedId]);

  // Automatically backfill conversation strategy or intelligence when connection is researched
  useEffect(() => {
    if (!user?.uid || !selectedConnection) return;
    if (selectedConnection.researchStatus !== "completed") return;

    const needsIntelligence =
      !selectedConnection.intelligenceData &&
      !selectedConnection.intelligence &&
      !selectedConnection.structuredIntelligence &&
      selectedConnection.intelligenceStatus !== "generating" &&
      selectedConnection.intelligenceStatus !== "completed" &&
      generatingIntelId !== selectedConnection.id;

    const needsStrategy =
      !selectedConnection.conversationStrategy &&
      selectedConnection.conversationStatus !== "generating" &&
      selectedConnection.conversationStatus !== "completed";

    if (needsIntelligence) {
      handleGenerateIntelligence(selectedConnection.id, false).catch((err) => {
        console.warn("[person] Auto-intelligence trigger notice:", err);
      });
    } else if (needsStrategy) {
      generateConnectionConversationStrategy(selectedConnection.id)
        .then((res) => {
          if (res.success && res.conversationStrategy) {
            setConnections((prev) =>
              prev.map((c) =>
                c.id === selectedConnection.id
                  ? {
                      ...c,
                      conversationStrategy: res.conversationStrategy,
                      conversationStatus: "completed",
                    }
                  : c,
              ),
            );
          }
        })
        .catch((err) => {
          console.warn("[person] Auto-strategy trigger notice:", err);
        });
    }
  }, [
    user?.uid,
    selectedConnection?.id,
    selectedConnection?.researchStatus,
    selectedConnection?.intelligenceStatus,
    selectedConnection?.conversationStatus,
  ]);

  const conversationHooksList = useMemo(() => {
    if (!selectedConnection) return [];
    return getPersonConversationHooks(selectedConnection);
  }, [selectedConnection]);

  const recommendedQuestionsList = useMemo(() => {
    if (!selectedConnection) return [];
    return getPersonRecommendedQuestions(selectedConnection);
  }, [selectedConnection]);

  const handleSelectConnection = (conn: Connection) => {
    if (conn.id) {
      setSelectedId(conn.id);
      navigate({ to: "/person", search: { id: conn.id }, replace: true });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!user?.uid || !selectedConnection?.id) return;
    try {
      setStatusUpdating(true);
      await updateUserConnection(user.uid, selectedConnection.id, {
        relationshipStatus: newStatus,
      });
      setConnections((prev) =>
        prev.map((c) =>
          c.id === selectedConnection.id ? { ...c, relationshipStatus: newStatus } : c,
        ),
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!user?.uid || !selectedConnection?.id) return;
    try {
      setDeleting(true);
      await deleteUserConnection(user.uid, selectedConnection.id);
      const remaining = connections.filter((c) => c.id !== selectedConnection.id);
      setConnections(remaining);
      setShowDeleteModal(false);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
        navigate({ to: "/person", search: { id: remaining[0].id }, replace: true });
      } else {
        setSelectedId(undefined);
        navigate({ to: "/person", search: {}, replace: true });
      }
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
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl flex items-center justify-between px-container-padding h-16 max-w-7xl mx-auto left-0 right-0 border-b border-surface-container/30">
        <button
          onClick={goBack}
          aria-label="Go back"
          className="text-on-surface-variant dark:text-outline-variant hover:opacity-80 transition-opacity active:scale-95 duration-200 p-2 -ml-2 rounded-full outline-none focus:ring-2 focus:ring-primary"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed">
          ColdConnect
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to="/add-person"
            className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-sm"
            title="Add Person"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </Link>
          <Link
            to="/profile"
            className="hover:opacity-80 transition-opacity active:scale-95 duration-200 outline-none focus:ring-2 focus:ring-primary rounded-full block"
          >
            <img
              className="w-8 h-8 rounded-full object-cover border border-outline-variant/30"
              alt="User avatar"
              src={avatarUrl}
            />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-container-padding pt-20 pb-36 flex flex-col gap-6 max-w-3xl mx-auto w-full">
        {/* Search & Filter Bar */}
        <section className="flex flex-col gap-3 mt-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, company, role, interests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-surface-container-low text-on-surface rounded-xl font-body-md text-sm outline-none border border-outline-variant/30 focus:border-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {FILTER_OPTIONS.map((f) => {
              const active = selectedFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-full font-label-md text-xs whitespace-nowrap transition-all capitalize ${
                    active
                      ? "bg-primary-container text-on-primary shadow-sm"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-outline-variant/30"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-label-md text-on-surface-variant">Loading network connections...</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-surface-container-lowest rounded-2xl border border-surface-variant/40 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-6 shadow-sm">
              <span className="material-symbols-outlined text-4xl">hub</span>
            </div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-2 font-bold">
              Your Network is Empty
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-8">
              You haven't added any connections yet. Add someone you're preparing to meet or reach
              out to.
            </p>
            <Link
              to="/add-person"
              className="bg-primary-container text-on-primary h-14 px-8 rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 shadow-tactile active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add Connection
            </Link>
          </div>
        ) : filteredConnections.length === 0 ? (
          <div className="text-center py-16 px-4 bg-surface-container-lowest rounded-2xl border border-surface-variant/40">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3">
              person_search
            </span>
            <h3 className="font-headline-md text-on-surface mb-1">No matching connections</h3>
            <p className="font-body-md text-on-surface-variant text-sm mb-4">
              Try adjusting your search query or status filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedFilter("all");
              }}
              className="text-primary font-label-md text-sm hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : selectedConnection ? (
          <>
            {/* Horizontal Connection Carousel / Selector */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar">
              {filteredConnections.map((c) => {
                const isSelected = selectedConnection.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectConnection(c)}
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl transition-all whitespace-nowrap border text-left ${
                      isSelected
                        ? "bg-primary-container text-on-primary border-primary shadow-sm"
                        : "bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-surface-container overflow-hidden shrink-0 flex items-center justify-center">
                      {c.profileImage ? (
                        <img
                          src={c.profileImage}
                          alt={c.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-xs">person</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-xs font-semibold leading-tight truncate whitespace-nowrap max-w-[120px]">
                        {c.name}
                      </span>
                      <span
                        className={`text-[10px] truncate whitespace-nowrap max-w-[120px] ${
                          isSelected ? "text-on-primary/80" : "text-on-surface-variant"
                        }`}
                      >
                        {[c.role, c.company].filter(Boolean).join(" · ") || "Connection"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Connection Intelligence Header */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-tactile border border-surface-variant/40 flex flex-col items-center text-center gap-4 relative">
              {/* Quick Actions (View Full Profile / Delete) */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5">
                <Link
                  to="/connection-profile"
                  search={{ id: selectedConnection.id }}
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors"
                  title="View Full Profile & Notes"
                >
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </Link>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-full transition-colors"
                  title="Delete Connection"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>

              <div className="relative mt-2">
                <div className="w-24 h-24 rounded-full shadow-tactile border-4 border-surface-container-lowest bg-surface-container flex items-center justify-center overflow-hidden">
                  {selectedConnection.profileImage ? (
                    <img
                      className="w-full h-full object-cover"
                      alt={selectedConnection.name}
                      src={selectedConnection.profileImage}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-5xl">person</span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full border-2 border-surface-container-lowest flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[14px]">
                    verified
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 items-center max-w-full px-2">
                <h2 className="font-display text-xl sm:text-headline-lg font-bold text-on-surface truncate whitespace-nowrap max-w-full">
                  {selectedConnection.name}
                </h2>
                {selectedConnection.role || selectedConnection.company ? (
                  <p className="font-body-md text-xs sm:text-sm text-on-surface-variant truncate whitespace-nowrap max-w-full">
                    {[selectedConnection.role, selectedConnection.company]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}

                {/* Relationship Status Selector */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative inline-block">
                    <select
                      value={normalizeStatus(selectedConnection.relationshipStatus)}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={statusUpdating}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer appearance-none pr-7 outline-none capitalize ${getStatusBadgeStyle(
                        selectedConnection.relationshipStatus,
                      )}`}
                    >
                      <option value="new">New</option>
                      <option value="requested">Requested</option>
                      <option value="connected">Connected</option>
                      <option value="met">Met</option>
                      <option value="warm">Warm</option>
                      <option value="strong">Strong</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] pointer-events-none opacity-60">
                      expand_more
                    </span>
                  </div>

                  {selectedConnection.meetingPurpose && (
                    <span className="text-xs px-2.5 py-1 bg-surface-container text-on-surface-variant rounded-full capitalize">
                      {selectedConnection.meetingPurpose.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Direct links (LinkedIn, Email, Instagram) */}
              <div className="flex items-center gap-4 mt-1">
                {selectedConnection.linkedinURL && (
                  <a
                    href={selectedConnection.linkedinURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    LinkedIn
                  </a>
                )}
                {selectedConnection.email && (
                  <a
                    href={`mailto:${selectedConnection.email}`}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">mail</span>
                    {selectedConnection.email}
                  </a>
                )}
                {selectedConnection.instagramHandle && (
                  <span className="text-xs text-on-surface-variant">
                    IG: {selectedConnection.instagramHandle}
                  </span>
                )}
              </div>
            </div>

            {/* Intelligence: Know Them */}
            <section className="flex flex-col gap-gutter">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    person_search
                  </span>
                  <h3 className="font-headline-md text-headline-md">Know Them</h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConnection.researchStatus === "researching" ||
                  researchingId === selectedConnection.id ? (
                    <button
                      disabled
                      className="px-3.5 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Researching...
                    </button>
                  ) : selectedConnection.researchStatus === "completed" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleGenerateIntelligence(
                            selectedConnection.id,
                            selectedConnection.intelligenceStatus === "completed",
                          )
                        }
                        disabled={generatingIntelId !== null}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all ${
                          selectedConnection.intelligenceStatus === "completed"
                            ? "bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/30"
                            : "bg-primary-container text-on-primary hover:opacity-90"
                        }`}
                      >
                        {generatingIntelId === selectedConnection.id ? (
                          <>
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Analyzing...
                          </>
                        ) : selectedConnection.intelligenceStatus === "completed" ? (
                          <>
                            <span className="material-symbols-outlined text-[14px]">
                              psychology
                            </span>
                            Refresh Intel
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[14px]">
                              auto_awesome
                            </span>
                            Generate Intelligence
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleResearchConnection(selectedConnection.id, true)}
                        disabled={researchingId !== null}
                        className="p-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold transition-colors flex items-center justify-center border border-outline-variant/30 active:scale-95"
                        title="Re-run LinkedIn research"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          refresh
                        </span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleResearchConnection(selectedConnection.id, false)}
                      disabled={researchingId !== null}
                      className="px-3.5 py-1.5 bg-primary-container hover:opacity-90 text-on-primary rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[16px]">search</span>
                      Research LinkedIn
                    </button>
                  )}
                  <Link
                    to="/connection-profile"
                    search={{ id: selectedConnection.id }}
                    className="text-xs text-primary font-label-md hover:underline flex items-center gap-1 pl-1"
                  >
                    Full Profile
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>

              {intelActionError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <span className="material-symbols-outlined text-[16px] text-amber-600">info</span>
                  <span>{intelActionError}</span>
                </div>
              )}

              {researchError && (
                <div className="p-3 bg-error-container/20 border border-error/30 rounded-xl flex items-center gap-2 text-xs text-error">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{researchError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-tactile border border-surface-variant/40 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">work</span>
                    <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
                      Career Snapshot
                    </h4>
                  </div>
                  <ul className="flex flex-col gap-2 font-body-md text-body-md text-on-surface-variant list-disc pl-5 marker:text-primary">
                    {(() => {
                      const norm = selectedConnection.researchData?.normalizedProfile;
                      if (norm) {
                        const cur = norm.currentRole;
                        const roleComp =
                          cur?.title && cur?.company
                            ? `${cur.title} at ${cur.company}`
                            : norm.identity.headline ||
                              selectedConnection.role ||
                              selectedConnection.company;
                        const firstPastExp =
                          norm.experience && norm.experience.length > 1 ? norm.experience[1] : null;
                        const firstEdu =
                          norm.education && norm.education.length > 0 ? norm.education[0] : null;

                        return (
                          <>
                            {roleComp && <li>{roleComp}</li>}
                            {firstPastExp && (
                              <li>
                                Previously: {firstPastExp.title} at {firstPastExp.company}
                              </li>
                            )}
                            {firstEdu && (
                              <li>
                                Education:{" "}
                                {[firstEdu.degree, firstEdu.institution]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </li>
                            )}
                            {norm.identity.location && <li>Location: {norm.identity.location}</li>}
                            <li>
                              Connected for{" "}
                              {selectedConnection.meetingPurpose
                                ? selectedConnection.meetingPurpose.replace("_", " ")
                                : "Networking"}
                            </li>
                          </>
                        );
                      }

                      return (
                        <>
                          <li>
                            {selectedConnection.role || selectedConnection.company
                              ? `${selectedConnection.role || "Professional"} at ${selectedConnection.company || "Company"}`
                              : "Profile not researched yet"}
                          </li>
                          <li>
                            Connected for{" "}
                            {selectedConnection.meetingPurpose
                              ? selectedConnection.meetingPurpose.replace("_", " ")
                              : "Networking"}
                          </li>
                          {selectedConnection.linkedinURL && (
                            <li className="truncate">
                              LinkedIn:{" "}
                              <a
                                href={selectedConnection.linkedinURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {selectedConnection.linkedinURL}
                              </a>
                            </li>
                          )}
                        </>
                      );
                    })()}
                  </ul>
                </div>

                <div className="flex flex-col gap-gutter">
                  <div className="bg-surface-container-lowest p-5 rounded-xl shadow-tactile border border-surface-variant/40 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline text-[20px]">
                        track_changes
                      </span>
                      <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
                        Current Focus
                      </h4>
                    </div>
                    {(() => {
                      const norm = selectedConnection.researchData?.normalizedProfile;
                      const focus =
                        selectedConnection.currentFocus || norm?.currentRole?.description;

                      if (focus) {
                        return (
                          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                            {focus}
                          </p>
                        );
                      }

                      if (selectedConnection.researchStatus === "completed") {
                        return (
                          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                            LinkedIn research completed. AI analysis will appear after intelligence
                            generation.
                          </p>
                        );
                      }

                      if (
                        selectedConnection.researchStatus === "researching" ||
                        researchingId === selectedConnection.id
                      ) {
                        return (
                          <p className="font-body-md text-body-md text-primary italic">
                            Researching LinkedIn profile...
                          </p>
                        );
                      }

                      return (
                        <p className="font-body-md text-body-md text-on-surface-variant italic">
                          Run LinkedIn research on full profile to uncover current focus.
                        </p>
                      );
                    })()}
                  </div>

                  <div className="bg-surface-container-lowest p-5 rounded-xl shadow-tactile border border-surface-variant/40 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline text-[20px]">
                        favorite
                      </span>
                      <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
                        Relevant Interests
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const norm = selectedConnection.researchData?.normalizedProfile;
                        const userInterests = selectedConnection.interests || [];
                        const researchSignals: { type?: string; name: string }[] = [];

                        if (norm?.interests) {
                          for (const c of norm.interests.companies || []) {
                            researchSignals.push({ type: "Company", name: c.name });
                          }
                          for (const g of norm.interests.groups || []) {
                            researchSignals.push({ type: "Group", name: g.name });
                          }
                          for (const n of norm.interests.newsletters || []) {
                            researchSignals.push({ type: "Newsletter", name: n.name });
                          }
                          for (const v of norm.interests.topVoices || []) {
                            researchSignals.push({ type: "Voice", name: v.name });
                          }
                        }

                        if (userInterests.length > 0 || researchSignals.length > 0) {
                          return (
                            <>
                              {userInterests.map((interest, i) => (
                                <span
                                  key={`user-${i}`}
                                  className="px-3 py-1 bg-surface-container-high rounded-full font-caption text-caption text-on-surface flex items-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    check
                                  </span>
                                  {interest}
                                </span>
                              ))}
                              {researchSignals.slice(0, 8).map((signal, i) => (
                                <span
                                  key={`signal-${i}`}
                                  className="px-2.5 py-1 bg-surface-container rounded-md font-caption text-caption text-on-surface flex items-center gap-1 border border-outline-variant/30"
                                >
                                  {signal.type && (
                                    <span className="text-[10px] text-primary font-semibold uppercase">
                                      {signal.type}:
                                    </span>
                                  )}
                                  {signal.name}
                                </span>
                              ))}
                            </>
                          );
                        }

                        if (selectedConnection.researchStatus === "completed") {
                          return (
                            <span className="font-caption text-caption text-on-surface-variant italic">
                              No LinkedIn interest signals found.
                            </span>
                          );
                        }

                        return (
                          <span className="font-caption text-caption text-on-surface-variant italic">
                            No interests added yet.
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Conversation Hooks */}
            <section className="flex flex-col gap-gutter">
              <div className="flex items-center justify-between text-primary">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    chat_bubble
                  </span>
                  <h3 className="font-headline-md text-headline-md">Conversation Hooks</h3>
                </div>
                {conversationHooksList.length > 0 && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {conversationHooksList.length} AI hooks
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {conversationHooksList.length > 0 ? (
                  conversationHooksList.map((hookItem, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-container-lowest p-5 rounded-xl shadow-tactile border border-surface-variant/40 flex gap-4 items-start active:scale-[0.98] transition-transform group"
                    >
                      <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          auto_awesome
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {hookItem.title && (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary block mb-0.5">
                            {hookItem.title}
                          </span>
                        )}
                        <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                          "{hookItem.text}"
                        </p>
                        {hookItem.why && (
                          <p className="text-[11px] text-on-surface-variant mt-1 italic">
                            Why: {hookItem.why}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-surface-container-lowest p-5 rounded-xl shadow-tactile border border-surface-variant/40 flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-secondary-container/40 text-on-secondary-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">psychology</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-body-md text-body-md text-on-surface-variant italic">
                        {selectedConnection.researchStatus === "completed"
                          ? "Generating conversation intelligence..."
                          : "Research this connection to unlock personalized conversation hooks."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Ask These */}
            <section className="flex flex-col gap-gutter">
              <div className="flex items-center justify-between text-primary">
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    contact_support
                  </span>
                  <h3 className="font-headline-md text-headline-md">Ask These</h3>
                </div>
                {recommendedQuestionsList.length > 0 && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {recommendedQuestionsList.length} recommended
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-3 bg-surface-container-lowest p-5 rounded-xl border border-surface-variant/40 shadow-tactile">
                {recommendedQuestionsList.length > 0 ? (
                  recommendedQuestionsList.map((qItem, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start justify-between gap-3 ${
                        idx > 0 ? "pt-3 border-t border-surface-container-highest" : "pb-1"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="material-symbols-outlined text-primary mt-0.5 text-[18px] shrink-0">
                          help
                        </span>
                        <div className="flex-1">
                          {qItem.category && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-0.5">
                              {qItem.category}
                            </span>
                          )}
                          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                            "{qItem.question}"
                          </p>
                          {qItem.reason && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              Intent: {qItem.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-3 py-1">
                    <span className="material-symbols-outlined text-outline-variant text-[20px]">
                      lightbulb
                    </span>
                    <p className="font-body-md text-body-md text-on-surface-variant italic">
                      {selectedConnection.researchStatus === "completed"
                        ? "Generating recommended questions..."
                        : "Research this connection to generate context-specific questions."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      {/* Action Footer */}
      {selectedConnection && (
        <div className="fixed bottom-0 left-0 w-full px-container-padding pt-6 pb-safe bg-gradient-to-t from-background via-background to-transparent z-40">
          <div className="max-w-3xl mx-auto pb-6 flex gap-3">
            <Link
              to="/connection-options"
              search={{ id: selectedConnection.id }}
              className="flex-1 bg-surface-container-low border border-outline-variant/40 text-on-surface h-14 rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 shadow-tactile active:scale-95 transition-all"
            >
              Reach Out
              <span className="material-symbols-outlined text-[20px]">send</span>
            </Link>
            <Link
              to="/record"
              search={{ id: selectedConnection.id, connectionId: selectedConnection.id }}
              onClick={() => {
                console.log("[ColdConnect] Practice Pitch clicked");
                console.log(`[ColdConnect] Current connection ID: ${selectedConnection.id}`);
                console.log(`[ColdConnect] Current connection name: ${selectedConnection.name}`);
                console.log("[ColdConnect] Navigating to Practice Pitch");
              }}
              className="flex-1 bg-primary-container text-on-primary h-14 rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 shadow-tactile active:scale-95 transition-all"
            >
              Practice Pitch
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedConnection && (
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
              <strong className="text-on-surface">{selectedConnection.name}</strong> from your
              network? This will permanently delete this connection and its associated history.
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
    </div>
  );
}
