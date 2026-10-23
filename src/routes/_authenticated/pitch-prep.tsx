import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUserMeetings,
  fetchUserMeeting,
  fetchUserConnections,
  fetchUserConnection,
  updateUserMeeting,
  removeMeeting,
} from "@/services/dataServices";
import { Connection, Meeting } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";
import { AddMeetingModal } from "@/components/AddMeetingModal";
import { EditMeetingModal } from "@/components/EditMeetingModal";
import { PostMeetingModal } from "@/components/PostMeetingModal";
import { RemoveMeetingDialog } from "@/components/RemoveMeetingDialog";

export const Route = createFileRoute("/_authenticated/pitch-prep")({
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
    meetingId:
      typeof search.meetingId === "string"
        ? search.meetingId
        : typeof search.meeting_id === "string"
          ? search.meeting_id
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Upcoming Meetings & Preparation — ColdConnect" },
      {
        name: "description",
        content:
          "View scheduled meetings, calculate preparation readiness, practice your pitch, and track outcomes.",
      },
      { property: "og:title", content: "Upcoming Meetings & Preparation — ColdConnect" },
      {
        property: "og:description",
        content:
          "View scheduled meetings, calculate preparation readiness, practice your pitch, and track outcomes.",
      },
    ],
  }),
  component: UpcomingAndPitchPrepPage,
});

type DateGroupKey = "next_up" | "today" | "tomorrow" | "this_week" | "later" | "past";

function categorizeDate(scheduledAtStr: string): DateGroupKey {
  if (!scheduledAtStr) return "later";
  const target = new Date(scheduledAtStr);
  const now = new Date();

  // Normalize to local date midnight
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMidnight = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();

  const oneDayMs = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((targetMidnight - todayMidnight) / oneDayMs);

  if (diffDays < 0) return "past";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return "this_week";
  return "later";
}

function calculateScore(items?: Meeting["preparationItems"]): number {
  let score = 0;
  if (items?.personResearched) score += 25;
  if (items?.questionsPrepared) score += 25;
  if (items?.pitchPracticed) score += 25;
  if (items?.conversationPlanPrepared) score += 25;
  return score;
}

function formatMeetingDateTime(scheduledAtStr: string): { dateStr: string; timeStr: string } {
  try {
    const d = new Date(scheduledAtStr);
    const dateStr = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return { dateStr, timeStr };
  } catch {
    return { dateStr: "Scheduled date", timeStr: "Scheduled time" };
  }
}

function UpcomingAndPitchPrepPage() {
  const { id: queryConnectionId, meetingId: queryMeetingId } = Route.useSearch();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const goBack = useAppBack("/");

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(queryMeetingId || null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"upcoming" | "completed" | "all">("upcoming");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const [removeMeetingData, setRemoveMeetingData] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemoveMeeting = async () => {
    if (!removeMeetingData || !user?.uid) return;
    setIsRemoving(true);
    try {
      await removeMeeting(removeMeetingData.id);
      setMeetings((prev) => prev.filter((m) => m.id !== removeMeetingData.id));
      if (selectedMeetingId === removeMeetingData.id) {
        setSelectedMeetingId(null);
        setSelectedMeeting(null);
        setSelectedConnection(null);
      }
      setRemoveMeetingData(null);
    } catch (error) {
      console.error("Couldn't remove meeting", error);
    } finally {
      setIsRemoving(false);
    }
  };

  const [modalInitialConnId, setModalInitialConnId] = useState<string | undefined>(
    queryConnectionId,
  );

  // Load all user meetings and connections
  async function loadData(targetMeetingId?: string, isMounted = true) {
    if (!user?.uid) return;
    try {
      if (isMounted) setLoading(true);
      const [mList, cList] = await Promise.all([
        fetchUserMeetings(user.uid),
        fetchUserConnections(user.uid),
      ]);

      if (!isMounted) return;
      setMeetings(mList);
      setConnections(cList);

      // Determine selected meeting
      const midToSelect =
        targetMeetingId ||
        queryMeetingId ||
        selectedMeetingId ||
        (queryConnectionId ? mList.find((m) => m.connectionId === queryConnectionId)?.id : null) ||
        (mList.filter((m) => m.status === "upcoming" || m.status === "in_progress")[0]?.id ??
          mList[0]?.id ??
          null);

      if (midToSelect && isMounted) {
        setSelectedMeetingId(midToSelect);
      }
    } catch (err) {
      console.error("Error loading upcoming data:", err);
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;
    loadData(undefined, isMounted);
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // When selectedMeetingId changes, load meeting & its connection
  useEffect(() => {
    let isMounted = true;
    async function loadSelected() {
      if (!user?.uid || !selectedMeetingId) {
        if (isMounted) {
          setSelectedMeeting(null);
          setSelectedConnection(null);
        }
        return;
      }
      try {
        const m = await fetchUserMeeting(user.uid, selectedMeetingId);
        if (!isMounted) return;
        if (m) {
          setSelectedMeeting(m);
          if (m.connectionId) {
            const c = await fetchUserConnection(user.uid, m.connectionId);
            if (isMounted) {
              setSelectedConnection(c);
            }
          } else if (isMounted) {
            setSelectedConnection(null);
          }
        }
      } catch (err) {
        console.error("Error loading selected meeting:", err);
      }
    }
    loadSelected();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, selectedMeetingId]);

  // Filtered meetings list
  const filteredMeetings = useMemo(() => {
    if (activeFilter === "upcoming") {
      return meetings.filter((m) => m.status === "upcoming" || m.status === "in_progress");
    }
    if (activeFilter === "completed") {
      return meetings.filter((m) => m.status === "completed");
    }
    return meetings; // all
  }, [meetings, activeFilter]);

  // Chronological Grouping
  const groupedMeetings = useMemo(() => {
    const nextUpList: Meeting[] = [];
    const todayList: Meeting[] = [];
    const tomorrowList: Meeting[] = [];
    const thisWeekList: Meeting[] = [];
    const laterList: Meeting[] = [];
    const pastList: Meeting[] = [];

    // Filter active meetings for the groups
    const activeList = filteredMeetings;

    activeList.forEach((m, idx) => {
      // If upcoming/in_progress and it's the very first item, flag as next up
      if (idx === 0 && (m.status === "upcoming" || m.status === "in_progress")) {
        nextUpList.push(m);
      }

      const cat = categorizeDate(m.scheduledAt);
      if (cat === "today") todayList.push(m);
      else if (cat === "tomorrow") tomorrowList.push(m);
      else if (cat === "this_week") thisWeekList.push(m);
      else if (cat === "later") laterList.push(m);
      else pastList.push(m);
    });

    return {
      nextUp: nextUpList[0] || null,
      today: todayList,
      tomorrow: tomorrowList,
      thisWeek: thisWeekList,
      later: laterList,
      past: pastList,
    };
  }, [filteredMeetings]);

  // Toggle preparation checklist item and update Firestore
  async function handleTogglePrepItem(
    itemKey:
      "personResearched" | "questionsPrepared" | "pitchPracticed" | "conversationPlanPrepared",
  ) {
    if (!user?.uid || !selectedMeeting?.id) return;
    const currentItems = selectedMeeting.preparationItems || {
      personResearched: false,
      questionsPrepared: false,
      pitchPracticed: false,
      conversationPlanPrepared: false,
    };

    const newItems = {
      ...currentItems,
      [itemKey]: !currentItems[itemKey],
    };

    const newScore = calculateScore(newItems);

    const updated = {
      ...selectedMeeting,
      preparationItems: newItems,
      preparationScore: newScore,
    };

    setSelectedMeeting(updated);
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

    try {
      await updateUserMeeting(user.uid, selectedMeeting.id, {
        preparationItems: newItems,
        preparationScore: newScore,
      });
    } catch (err) {
      console.error("Error updating preparation items:", err);
    }
  }

  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  const firstName = selectedConnection
    ? selectedConnection.name.split(" ")[0]
    : selectedMeeting?.connectionName
      ? selectedMeeting.connectionName.split(" ")[0]
      : "your contact";

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md antialiased pt-16 pb-24 selection:bg-primary-container selection:text-white">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl border-b border-surface-variant/30">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="p-2 -ml-2 text-primary hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed">
            Upcoming & Preparation
          </h1>
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant flex items-center justify-center block border border-surface-variant"
          >
            <img alt="User Profile" className="w-full h-full object-cover" src={avatarUrl} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-container-padding py-stack-gap">
        {/* Action & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-2">
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-primary font-bold">
              Scheduled Meetings
            </h2>
            <p className="font-body-md text-caption text-on-surface-variant">
              Manage your connection meetings, readiness score, and pitch plan.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-surface-variant/40">
              <button
                id="filter-upcoming-btn"
                onClick={() => setActiveFilter("upcoming")}
                className={`px-3 py-1.5 rounded-lg font-label-md text-caption transition-all ${
                  activeFilter === "upcoming"
                    ? "bg-surface-container-lowest text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Active
              </button>
              <button
                id="filter-completed-btn"
                onClick={() => setActiveFilter("completed")}
                className={`px-3 py-1.5 rounded-lg font-label-md text-caption transition-all ${
                  activeFilter === "completed"
                    ? "bg-surface-container-lowest text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Completed
              </button>
              <button
                id="filter-all-btn"
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-1.5 rounded-lg font-label-md text-caption transition-all ${
                  activeFilter === "all"
                    ? "bg-surface-container-lowest text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                All
              </button>
            </div>

            {/* Add Meeting Button */}
            <button
              id="schedule-meeting-main-btn"
              onClick={() => {
                setModalInitialConnId(undefined);
                setIsAddModalOpen(true);
              }}
              className="bg-primary-container text-white px-4 py-2.5 rounded-xl font-label-md text-label-md hover:opacity-90 transition-opacity active:scale-95 shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Schedule Meeting</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-label-md text-on-surface-variant">Loading meetings...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          /* Empty State */
          <div className="bg-surface-container-lowest rounded-2xl p-10 card-shadow border border-surface-variant/50 text-center flex flex-col items-center justify-center my-6">
            <div className="w-16 h-16 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container mb-4">
              <span className="material-symbols-outlined text-3xl">calendar_month</span>
            </div>
            <h3 className="font-headline-lg text-headline-lg text-primary font-bold mb-2">
              {activeFilter === "completed"
                ? "No completed meetings yet"
                : "No upcoming meetings scheduled"}
            </h3>
            <p className="font-body-md text-on-surface-variant max-w-md mb-6 leading-relaxed">
              {activeFilter === "completed"
                ? "When you mark scheduled meetings as completed, they will appear here along with your ratings and takeaways."
                : "Schedule coffee chats, video calls, or networking introductions to prepare conversation hooks and practice your pitch."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                id="empty-schedule-meeting-btn"
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary-container text-white font-label-md px-6 py-3 rounded-xl hover:opacity-90 transition-opacity active:scale-95 flex items-center gap-2 shadow-md"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Schedule First Meeting
              </button>
              <Link
                to="/person"
                className="bg-surface-container-low border border-surface-variant text-on-surface font-label-md px-5 py-3 rounded-xl hover:bg-surface-variant/40 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">hub</span>
                View Network
              </Link>
            </div>
          </div>
        ) : (
          /* Main 2-Column or Stack Layout: Meetings Schedule on Left/Top, Detailed Prep on Right/Bottom */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Chronological Meetings List */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              {/* Today Section */}
              {groupedMeetings.today.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-primary font-bold px-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="font-label-md text-label-md uppercase tracking-wider">Today</h3>
                    <span className="text-caption text-on-surface-variant font-normal">
                      ({groupedMeetings.today.length})
                    </span>
                  </div>
                  {groupedMeetings.today.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      isSelected={selectedMeetingId === m.id}
                      onSelect={() => setSelectedMeetingId(m.id || null)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        setRemoveMeetingData({
                          id: m.id,
                          name: m.connectionName || "this connection",
                        });
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Tomorrow Section */}
              {groupedMeetings.tomorrow.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-primary font-bold px-1">
                    <span className="w-2 h-2 rounded-full bg-primary-container" />
                    <h3 className="font-label-md text-label-md uppercase tracking-wider">
                      Tomorrow
                    </h3>
                    <span className="text-caption text-on-surface-variant font-normal">
                      ({groupedMeetings.tomorrow.length})
                    </span>
                  </div>
                  {groupedMeetings.tomorrow.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      isSelected={selectedMeetingId === m.id}
                      onSelect={() => setSelectedMeetingId(m.id || null)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        setRemoveMeetingData({
                          id: m.id,
                          name: m.connectionName || "this connection",
                        });
                      }}
                    />
                  ))}
                </div>
              )}

              {/* This Week Section */}
              {groupedMeetings.thisWeek.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-primary font-bold px-1">
                    <span className="w-2 h-2 rounded-full bg-secondary-container" />
                    <h3 className="font-label-md text-label-md uppercase tracking-wider">
                      This Week
                    </h3>
                    <span className="text-caption text-on-surface-variant font-normal">
                      ({groupedMeetings.thisWeek.length})
                    </span>
                  </div>
                  {groupedMeetings.thisWeek.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      isSelected={selectedMeetingId === m.id}
                      onSelect={() => setSelectedMeetingId(m.id || null)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        setRemoveMeetingData({
                          id: m.id,
                          name: m.connectionName || "this connection",
                        });
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Later Section */}
              {groupedMeetings.later.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-on-surface-variant font-bold px-1">
                    <span className="w-2 h-2 rounded-full bg-outline-variant" />
                    <h3 className="font-label-md text-label-md uppercase tracking-wider">Later</h3>
                    <span className="text-caption text-on-surface-variant font-normal">
                      ({groupedMeetings.later.length})
                    </span>
                  </div>
                  {groupedMeetings.later.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      isSelected={selectedMeetingId === m.id}
                      onSelect={() => setSelectedMeetingId(m.id || null)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        setRemoveMeetingData({
                          id: m.id,
                          name: m.connectionName || "this connection",
                        });
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Past / Completed Section (if activeFilter is completed or all) */}
              {groupedMeetings.past.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-on-surface-variant font-bold px-1">
                    <span className="w-2 h-2 rounded-full bg-outline-variant" />
                    <h3 className="font-label-md text-label-md uppercase tracking-wider">
                      Past & Completed
                    </h3>
                    <span className="text-caption text-on-surface-variant font-normal">
                      ({groupedMeetings.past.length})
                    </span>
                  </div>
                  {groupedMeetings.past.map((m) => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      isSelected={selectedMeetingId === m.id}
                      onSelect={() => setSelectedMeetingId(m.id || null)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        setRemoveMeetingData({
                          id: m.id,
                          name: m.connectionName || "this connection",
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Selected Meeting Detail & Pitch Preparation Engine */}
            <div className="lg:col-span-7">
              {selectedMeeting ? (
                <div
                  id="selected-meeting-detail-card"
                  className="bg-surface-container-lowest rounded-2xl p-6 shadow-paper border border-surface-variant/50 sticky top-24 space-y-6"
                >
                  {/* Meeting Header */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4 pb-4 border-b border-surface-variant/40">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      {selectedConnection?.id || selectedMeeting.connectionId ? (
                        <Link
                          to="/connection-profile"
                          search={{
                            id: (selectedConnection?.id || selectedMeeting.connectionId) as string,
                          }}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container flex items-center justify-center hover:opacity-90 transition-opacity"
                          title="View Connection Profile"
                        >
                          {selectedConnection?.profileImage || selectedMeeting.connectionImage ? (
                            <img
                              className="w-full h-full object-cover"
                              alt={
                                selectedMeeting.connectionName ||
                                selectedConnection?.name ||
                                "Connection"
                              }
                              src={
                                selectedConnection?.profileImage ||
                                selectedMeeting.connectionImage ||
                                ""
                              }
                            />
                          ) : (
                            <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl">
                              person
                            </span>
                          )}
                        </Link>
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container flex items-center justify-center">
                          {selectedMeeting.connectionImage ? (
                            <img
                              className="w-full h-full object-cover"
                              alt={selectedMeeting.connectionName || "Connection"}
                              src={selectedMeeting.connectionImage}
                            />
                          ) : (
                            <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl">
                              person
                            </span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 justify-center">
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedConnection?.id || selectedMeeting.connectionId ? (
                            <Link
                              to="/connection-profile"
                              search={{
                                id: (selectedConnection?.id ||
                                  selectedMeeting.connectionId) as string,
                              }}
                              className="font-display text-lg sm:text-xl md:text-headline-lg text-primary font-bold hover:underline truncate whitespace-nowrap leading-tight"
                            >
                              {selectedMeeting.connectionName ||
                                selectedConnection?.name ||
                                "Meeting"}
                            </Link>
                          ) : (
                            <h3 className="font-display text-lg sm:text-xl md:text-headline-lg text-primary font-bold truncate whitespace-nowrap leading-tight">
                              {selectedMeeting.connectionName ||
                                selectedConnection?.name ||
                                "Meeting"}
                            </h3>
                          )}
                          {selectedMeeting.status === "completed" && (
                            <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 whitespace-nowrap shrink-0">
                              Completed
                            </span>
                          )}
                          {selectedMeeting.status === "cancelled" && (
                            <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-rose-300 whitespace-nowrap shrink-0">
                              Cancelled
                            </span>
                          )}
                        </div>

                        <p className="font-body-md text-xs sm:text-sm text-on-surface-variant truncate whitespace-nowrap mt-0.5">
                          {selectedConnection?.role || selectedMeeting.connectionRole || "Role"} ·{" "}
                          {selectedConnection?.company ||
                            selectedMeeting.connectionCompany ||
                            "Company"}
                        </p>

                        {selectedConnection?.id && (
                          <Link
                            to="/connection-profile"
                            search={{ id: selectedConnection.id }}
                            className="inline-flex items-center gap-1 text-primary text-caption hover:underline mt-1 font-semibold whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              account_circle
                            </span>
                            View Connection Profile
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Quick Edit/Reschedule icon */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        id="open-edit-meeting-btn"
                        onClick={() => setIsEditModalOpen(true)}
                        className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-variant/40 transition-colors"
                        title="Edit / Reschedule Meeting"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                    </div>
                  </div>

                  {/* Meeting Logistics Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface-container-low rounded-xl border border-surface-variant/30 text-caption">
                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        calendar_today
                      </span>
                      <span>{formatMeetingDateTime(selectedMeeting.scheduledAt).dateStr}</span>
                    </div>

                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        schedule
                      </span>
                      <span>{formatMeetingDateTime(selectedMeeting.scheduledAt).timeStr}</span>
                    </div>

                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="material-symbols-outlined text-secondary-container text-[18px]">
                        location_on
                      </span>
                      <span>{selectedMeeting.location || "Coffee chat"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="material-symbols-outlined text-primary-container text-[18px]">
                        flag
                      </span>
                      <span>{selectedMeeting.purpose || "Career advice"}</span>
                    </div>
                  </div>

                  {/* Meeting Notes */}
                  {selectedMeeting.notes && (
                    <div className="p-4 bg-surface-container-lowest rounded-xl border border-surface-variant/40 text-caption">
                      <div className="font-label-md text-primary font-semibold mb-1 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">notes</span>
                        Meeting Objective & Notes
                      </div>
                      <p className="text-on-surface leading-relaxed whitespace-pre-wrap">
                        {selectedMeeting.notes}
                      </p>
                    </div>
                  )}

                  {/* Preparation Score & Interactive Checklist */}
                  <div className="p-5 bg-white dark:bg-surface-container-low rounded-xl border border-surface-variant/50 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-headline-md text-headline-md text-primary font-bold">
                          Preparation Readiness
                        </h4>
                        <p className="font-caption text-caption text-on-surface-variant">
                          Complete 4 strategic pillars before meeting {firstName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-display text-headline-lg font-bold text-primary">
                          {selectedMeeting.preparationScore ??
                            calculateScore(selectedMeeting.preparationItems)}
                          %
                        </span>
                        <span className="block text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                          Readiness
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-surface-variant/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-container transition-all duration-500 rounded-full"
                        style={{
                          width: `${
                            selectedMeeting.preparationScore ??
                            calculateScore(selectedMeeting.preparationItems)
                          }%`,
                        }}
                      />
                    </div>

                    {/* Checklist Items */}
                    <div className="space-y-2.5 pt-1">
                      {/* Item 1: Person Researched */}
                      <button
                        type="button"
                        onClick={() => handleTogglePrepItem("personResearched")}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-surface-variant/40 hover:border-primary-container/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              selectedMeeting.preparationItems?.personResearched
                                ? "text-primary-container"
                                : "text-outline-variant"
                            }`}
                            style={{
                              fontVariationSettings: selectedMeeting.preparationItems
                                ?.personResearched
                                ? "'FILL' 1"
                                : "'FILL' 0",
                            }}
                          >
                            {selectedMeeting.preparationItems?.personResearched
                              ? "check_circle"
                              : "radio_button_unchecked"}
                          </span>
                          <div>
                            <span className="font-label-md text-on-surface block font-semibold">
                              1. Person Researched (25%)
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              Review {firstName}’s role, company context, and interests
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Item 2: Questions Prepared */}
                      <button
                        type="button"
                        onClick={() => handleTogglePrepItem("questionsPrepared")}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-surface-variant/40 hover:border-primary-container/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              selectedMeeting.preparationItems?.questionsPrepared
                                ? "text-primary-container"
                                : "text-outline-variant"
                            }`}
                            style={{
                              fontVariationSettings: selectedMeeting.preparationItems
                                ?.questionsPrepared
                                ? "'FILL' 1"
                                : "'FILL' 0",
                            }}
                          >
                            {selectedMeeting.preparationItems?.questionsPrepared
                              ? "check_circle"
                              : "radio_button_unchecked"}
                          </span>
                          <div>
                            <span className="font-label-md text-on-surface block font-semibold">
                              2. Questions Prepared (25%)
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              Formulate strategic inquiry topics and conversation hooks
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Item 3: Pitch Practiced */}
                      <button
                        type="button"
                        onClick={() => handleTogglePrepItem("pitchPracticed")}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-surface-variant/40 hover:border-primary-container/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              selectedMeeting.preparationItems?.pitchPracticed
                                ? "text-primary-container"
                                : "text-outline-variant"
                            }`}
                            style={{
                              fontVariationSettings: selectedMeeting.preparationItems
                                ?.pitchPracticed
                                ? "'FILL' 1"
                                : "'FILL' 0",
                            }}
                          >
                            {selectedMeeting.preparationItems?.pitchPracticed
                              ? "check_circle"
                              : "radio_button_unchecked"}
                          </span>
                          <div>
                            <span className="font-label-md text-on-surface block font-semibold">
                              3. Pitch Practiced (25%)
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              Practice 60-second elevator pitch for concise delivery
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Item 4: Conversation Plan Prepared */}
                      <button
                        type="button"
                        onClick={() => handleTogglePrepItem("conversationPlanPrepared")}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container-lowest border border-surface-variant/40 hover:border-primary-container/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined text-[20px] ${
                              selectedMeeting.preparationItems?.conversationPlanPrepared
                                ? "text-primary-container"
                                : "text-outline-variant"
                            }`}
                            style={{
                              fontVariationSettings: selectedMeeting.preparationItems
                                ?.conversationPlanPrepared
                                ? "'FILL' 1"
                                : "'FILL' 0",
                            }}
                          >
                            {selectedMeeting.preparationItems?.conversationPlanPrepared
                              ? "check_circle"
                              : "radio_button_unchecked"}
                          </span>
                          <div>
                            <span className="font-label-md text-on-surface block font-semibold">
                              4. Conversation Plan Prepared (25%)
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              Set core meeting objective and seamless transition bridge
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* 60s Pitch Practice Callout */}
                  <div className="bg-surface-container-low rounded-xl p-5 border border-surface-variant/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-primary font-bold">
                        <span className="material-symbols-outlined text-[20px]">mic</span>
                        <h4 className="font-label-md text-label-md">60-Second Introduction</h4>
                      </div>
                      <span className="text-[11px] text-secondary-container font-semibold">
                        Prompt: "Tell me about yourself"
                      </span>
                    </div>
                    <p className="font-body-md text-caption text-on-surface-variant">
                      Connect your core experience and problem-solving background directly to{" "}
                      {firstName}’s role at{" "}
                      {selectedConnection?.company ||
                        selectedMeeting.connectionCompany ||
                        "their company"}
                      .
                    </p>
                    <Link
                      to="/record"
                      search={{
                        id: (selectedConnection?.id || selectedMeeting.connectionId) as string,
                        connectionId: (selectedConnection?.id ||
                          selectedMeeting.connectionId) as string,
                        meetingId: selectedMeeting.id,
                      }}
                      onClick={() => {
                        const targetId = selectedConnection?.id || selectedMeeting.connectionId;
                        const targetName =
                          selectedConnection?.name ||
                          selectedMeeting.connectionName ||
                          "Connection";
                        console.log("[ColdConnect] Practice Pitch clicked");
                        console.log(`[ColdConnect] Current connection ID: ${targetId}`);
                        console.log(`[ColdConnect] Current connection name: ${targetName}`);
                        console.log("[ColdConnect] Navigating to Practice Pitch");
                      }}
                      className="inline-flex items-center justify-center gap-2 w-full bg-primary-container text-white py-3 rounded-xl font-label-md hover:opacity-90 transition-opacity active:scale-[0.99] shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">mic</span>
                      <span>Start 60 Seconds Pitch Practice</span>
                    </Link>
                  </div>

                  {/* Action Buttons: Mark Completed, Reschedule, Cancel */}
                  <div className="pt-3 border-t border-surface-variant/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        id="reschedule-meeting-btn"
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl border border-surface-variant bg-surface-container-low hover:bg-surface-variant/40 text-on-surface font-label-md text-caption transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                        <span>Reschedule / Edit</span>
                      </button>

                      {selectedMeeting.status !== "cancelled" && (
                        <button
                          id="cancel-meeting-btn"
                          onClick={() => setIsEditModalOpen(true)}
                          className="px-3 py-2.5 rounded-xl text-error hover:bg-error/10 font-label-md text-caption transition-colors"
                        >
                          Cancel Meeting
                        </button>
                      )}
                    </div>

                    {selectedMeeting.status !== "completed" ? (
                      <button
                        id="mark-completed-main-btn"
                        onClick={() => setIsPostModalOpen(true)}
                        className="px-6 py-2.5 rounded-xl font-label-md text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>Mark as Completed</span>
                      </button>
                    ) : (
                      <button
                        id="reopen-post-review-btn"
                        onClick={() => setIsPostModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl font-label-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">rate_review</span>
                        <span>View / Edit Review</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-surface-container-low rounded-2xl border border-surface-variant/40">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">
                    touch_app
                  </span>
                  <h4 className="font-headline-md text-on-surface font-semibold">
                    Select a meeting
                  </h4>
                  <p className="font-body-md text-caption text-on-surface-variant mt-1">
                    Choose any meeting from the list to view preparation readiness and talking
                    points.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe bg-surface/80 dark:bg-surface/80 backdrop-blur-xl border-t border-surface-variant/20 glass-nav">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md"
        >
          <span className="material-symbols-outlined mb-1">home</span>
          <span className="text-[10px]">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md"
        >
          <span className="material-symbols-outlined mb-1">hub</span>
          <span className="text-[10px]">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 font-label-md text-label-md"
        >
          <span
            className="material-symbols-outlined mb-1"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            calendar_today
          </span>
          <span className="text-[10px] font-bold">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md"
        >
          <span className="material-symbols-outlined mb-1">person</span>
          <span className="text-[10px]">Profile</span>
        </Link>
      </nav>

      {/* Modals */}
      <AddMeetingModal
        isOpen={isAddModalOpen}
        initialConnectionId={modalInitialConnId}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newMid) => {
          loadData(newMid);
        }}
      />

      <EditMeetingModal
        isOpen={isEditModalOpen}
        meeting={selectedMeeting}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={() => {
          loadData(selectedMeetingId || undefined);
        }}
        onCancelled={() => {
          loadData();
        }}
      />

      <PostMeetingModal
        isOpen={isPostModalOpen}
        meeting={selectedMeeting}
        onClose={() => setIsPostModalOpen(false)}
        onCompleted={() => {
          loadData(selectedMeetingId || undefined);
        }}
        onScheduleFollowup={(cid) => {
          navigate({
            to: "/connection-options",
            search: { id: cid },
          });
        }}
      />

      <RemoveMeetingDialog
        isOpen={!!removeMeetingData}
        onClose={() => setRemoveMeetingData(null)}
        onConfirm={handleRemoveMeeting}
        personName={removeMeetingData?.name || ""}
        isRemoving={isRemoving}
      />
    </div>
  );
}

// Subcomponent: Individual Meeting Card in the List
function MeetingCard({
  meeting,
  isSelected,
  onSelect,
  onRemove,
}: {
  meeting: Meeting;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const { dateStr, timeStr } = formatMeetingDateTime(meeting.scheduledAt);
  const score = meeting.preparationScore ?? calculateScore(meeting.preparationItems);

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl transition-all cursor-pointer border relative ${
        isSelected
          ? "bg-surface-container-lowest border-primary shadow-level-1 ring-1 ring-primary/30"
          : "bg-surface-container-lowest/80 border-surface-variant/50 hover:bg-surface-container-lowest hover:border-primary-container/40 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-surface-container border border-surface-variant flex items-center justify-center">
            {meeting.connectionImage ? (
              <img
                className="w-full h-full object-cover"
                alt={meeting.connectionName || "Person"}
                src={meeting.connectionImage}
              />
            ) : (
              <span className="material-symbols-outlined text-primary text-xl">person</span>
            )}
          </div>
          <div className="min-w-0 flex-1 justify-center">
            <h4 className="font-display text-sm sm:text-base text-on-surface font-semibold truncate whitespace-nowrap leading-tight">
              {meeting.connectionName || meeting.title}
            </h4>
            <p className="font-body-md text-xs text-on-surface-variant truncate whitespace-nowrap mt-0.5">
              {meeting.connectionRole || "Role"} · {meeting.connectionCompany || "Company"}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end">
          <span className="inline-block bg-primary-container/10 text-primary font-label-md text-[11px] px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
            {dateStr}
          </span>
          <span className="block font-caption text-[11px] text-on-surface-variant mt-0.5 whitespace-nowrap">
            {timeStr}
          </span>
          <button
            onClick={onRemove}
            className="mt-1 text-outline-variant hover:text-error transition-colors p-1 z-10 relative"
            title="Remove Meeting"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        </div>
      </div>

      {/* Card Footer: Location & Readiness */}
      <div className="mt-3 pt-2.5 border-t border-surface-variant/30 flex items-center justify-between text-caption text-on-surface-variant">
        <div className="flex items-center gap-1.5 text-[12px] min-w-0 flex-1 mr-2">
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
            location_on
          </span>
          <span className="truncate whitespace-nowrap">{meeting.location || "Coffee chat"}</span>
        </div>

        <div className="flex items-center gap-1 text-[12px] font-semibold text-primary shrink-0 whitespace-nowrap">
          <span className="material-symbols-outlined text-[15px]">verified</span>
          <span>{score}% ready</span>
        </div>
      </div>
    </div>
  );
}
