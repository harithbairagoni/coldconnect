import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserMeetings, fetchUserConnections, removeMeeting } from "@/services/dataServices";
import { Connection, Meeting } from "@/types/models";
import { AddMeetingModal } from "@/components/AddMeetingModal";
import { RemoveMeetingDialog } from "@/components/RemoveMeetingDialog";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "ColdConnect — Make every introduction count" },
      {
        name: "description",
        content:
          "Prepare for every cold connection: research people, practice your pitch, and get feedback.",
      },
      { property: "og:title", content: "ColdConnect — Make every introduction count" },
      {
        property: "og:description",
        content:
          "Prepare for every cold connection: research people, practice your pitch, and get feedback.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, profile } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false);

  const [removeMeetingData, setRemoveMeetingData] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const handleRemoveMeeting = async () => {
    if (!removeMeetingData || !user?.uid) return;
    setIsRemoving(true);
    setRemoveError("");
    try {
      await removeMeeting(removeMeetingData.id);
      setMeetings((prev) => prev.filter((m) => m.id !== removeMeetingData.id));
      setRemoveMeetingData(null);
      // Optional: add a toast here if a toast system is in place
      console.log("Meeting removed.");
    } catch (error) {
      setRemoveError("Couldn't remove the meeting. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        console.log(`[ColdConnect] Loading connections for user: ${user.uid}`);
        const [mList, cList] = await Promise.all([
          fetchUserMeetings(user.uid),
          fetchUserConnections(user.uid),
        ]);
        if (!isMounted) return;
        console.log(`[ColdConnect] Connections returned: ${cList.length}`);
        const upcomingMeetingsList = mList.filter(
          (m) => m.status === "upcoming" || m.status === "in_progress",
        );
        console.log(`[ColdConnect] Network connections: ${cList.length}`);
        console.log(`[ColdConnect] Upcoming connections: ${upcomingMeetingsList.length}`);

        setMeetings(mList);
        setConnections(cList);
      } catch (err) {
        console.error("Error loading home data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Find the first upcoming or in_progress meeting strictly from scheduled meetings
  const upNextMeeting =
    meetings.find((m) => m.status === "upcoming" || m.status === "in_progress") || null;

  const upNextConnection = upNextMeeting?.connectionId
    ? connections.find((c) => c.id === upNextMeeting.connectionId) || null
    : null;

  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  const prepScore = upNextMeeting?.preparationScore ?? 25;

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col pb-[90px]">
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl transition-all duration-300 border-b border-surface-variant/30">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <Link
            to="/person"
            className="text-on-surface-variant hover:opacity-80 transition-opacity"
            title="My Network"
          >
            <span className="material-symbols-outlined" data-icon="menu">
              menu
            </span>
          </Link>
          <h1 className="font-display text-headline-md font-bold text-primary">ColdConnect</h1>
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant border border-outline-variant/30 block"
            title="Profile"
          >
            <img className="object-cover w-full h-full" alt="User avatar" src={avatarUrl} />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full pt-24 px-container-padding pb-section-gap flex flex-col gap-section-gap">
        <section className="flex flex-col items-center justify-center text-center gap-stack-gap mt-4">
          <h2 className="font-display text-display text-primary max-w-lg mx-auto">
            Make every introduction count.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
            <Link
              to="/add-person"
              className="bg-primary-container text-white px-6 py-3.5 rounded-[16px] font-label-md text-label-md hover:opacity-90 transition-opacity active:scale-95 shadow-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="add">
                person_add
              </span>
              Add Connection
            </Link>
            <button
              onClick={() => setIsAddMeetingOpen(true)}
              className="bg-surface-container-low border border-surface-variant/60 text-primary font-label-md px-6 py-3.5 rounded-[16px] hover:bg-surface-variant/40 transition-colors active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
              Schedule Meeting
            </button>
          </div>
        </section>

        <nav className="flex gap-4 border-b border-surface-variant pb-2 overflow-x-auto hide-scrollbar">
          <Link
            to="/person"
            className="font-label-md text-label-md text-primary border-b-2 border-primary pb-2 whitespace-nowrap font-bold hover:text-primary transition-colors"
          >
            My Network ({connections.length})
          </Link>
          <Link
            to="/pitch-prep"
            className="font-label-md text-label-md text-on-surface-variant pb-2 whitespace-nowrap hover:text-primary transition-colors"
          >
            Upcoming Meetings ({meetings.filter((m) => m.status === "upcoming").length})
          </Link>
        </nav>

        {/* Up Next / Upcoming Meeting Section */}
        <section className="flex flex-col gap-gutter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">
                calendar_clock
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                Upcoming Meeting
              </h3>
            </div>
            <Link
              to="/pitch-prep"
              className="font-label-md text-caption text-primary hover:underline flex items-center gap-1"
            >
              View all upcoming ({meetings.filter((m) => m.status === "upcoming").length})
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          {loading ? (
            <div className="bg-surface-container-lowest rounded-xl p-[20px] card-shadow border border-surface-variant/50 flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-primary-container border-t-transparent rounded-full animate-spin" />
            </div>
          ) : upNextMeeting ? (
            <div className="bg-surface-container-lowest rounded-2xl p-6 card-shadow border border-surface-variant/50">
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container flex items-center justify-center">
                    {upNextConnection?.profileImage || upNextMeeting?.connectionImage ? (
                      <img
                        className="w-full h-full object-cover"
                        alt={upNextMeeting?.connectionName || upNextConnection?.name || "Person"}
                        src={upNextConnection?.profileImage || upNextMeeting?.connectionImage || ""}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-2xl sm:text-3xl">
                        person
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    <h4 className="font-display text-base sm:text-lg md:text-xl font-bold text-primary truncate whitespace-nowrap leading-tight tracking-tight">
                      {upNextMeeting?.connectionName ||
                        upNextConnection?.name ||
                        "Upcoming Meeting"}
                    </h4>
                    <p className="font-body-md text-xs sm:text-sm text-on-surface-variant truncate whitespace-nowrap mt-0.5">
                      {upNextConnection
                        ? `${upNextConnection.role || "Role"} · ${upNextConnection.company || "Company"}`
                        : upNextMeeting?.connectionRole
                          ? `${upNextMeeting.connectionRole} · ${upNextMeeting.connectionCompany}`
                          : upNextMeeting?.title}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end text-right shrink-0">
                  <span className="font-label-md text-xs sm:text-label-md text-secondary-container bg-secondary-container/10 px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap font-semibold">
                    {upNextMeeting?.scheduledAt
                      ? new Date(upNextMeeting.scheduledAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "Upcoming"}
                  </span>
                  {upNextMeeting?.scheduledAt && (
                    <span className="font-caption text-[11px] sm:text-caption text-on-surface-variant mt-1 whitespace-nowrap">
                      {new Date(upNextMeeting.scheduledAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (upNextMeeting) {
                        setRemoveMeetingData({
                          id: upNextMeeting.id,
                          name:
                            upNextMeeting.connectionName ||
                            upNextConnection?.name ||
                            "this connection",
                        });
                      }
                    }}
                    className="mt-2 text-outline-variant hover:text-error transition-colors p-1"
                    title="Remove Meeting"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-surface-variant pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Preparation Readiness
                  </span>
                  <span className="font-label-md text-caption text-primary font-bold">
                    {prepScore}% ready
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full overflow-hidden bg-surface-variant/40 mb-4">
                  <div
                    className="h-full bg-primary-container transition-all duration-500 rounded-full"
                    style={{ width: `${prepScore}%` }}
                  />
                </div>

                <ul className="flex flex-col gap-2 mt-4">
                  <li className="flex items-center gap-3">
                    <span
                      className="material-symbols-outlined text-[18px] text-primary-container"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {upNextMeeting?.preparationItems?.personResearched !== false
                        ? "check_circle"
                        : "radio_button_unchecked"}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">
                      Research Background
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        upNextMeeting?.preparationItems?.pitchPracticed
                          ? "text-primary-container"
                          : "text-secondary-container"
                      }`}
                      style={{
                        fontVariationSettings: upNextMeeting?.preparationItems?.pitchPracticed
                          ? "'FILL' 1"
                          : "'FILL' 0",
                      }}
                    >
                      {upNextMeeting?.preparationItems?.pitchPracticed
                        ? "check_circle"
                        : "radio_button_checked"}
                    </span>
                    <span className="font-body-md text-body-md text-primary font-semibold">
                      Practice 60-Second Pitch
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        upNextMeeting?.preparationItems?.conversationPlanPrepared
                          ? "text-primary-container"
                          : "text-outline-variant"
                      }`}
                    >
                      {upNextMeeting?.preparationItems?.conversationPlanPrepared
                        ? "check_circle"
                        : "radio_button_unchecked"}
                    </span>
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      Prepare Questions & Hooks
                    </span>
                  </li>
                </ul>

                <div className="flex gap-3 mt-5">
                  <Link
                    to="/pitch-prep"
                    search={{
                      meetingId: upNextMeeting?.id,
                      id: upNextConnection?.id || upNextMeeting?.connectionId,
                    }}
                    className="flex-1 text-center bg-primary-container text-white font-label-md py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    <span>Continue Preparation</span>
                  </Link>

                  {upNextConnection?.id && (
                    <Link
                      to="/connection-profile"
                      search={{ id: upNextConnection.id }}
                      className="px-4 py-3 rounded-xl border border-surface-variant bg-surface-container-low text-on-surface hover:bg-surface-variant/30 font-label-md flex items-center justify-center"
                      title="View Profile"
                    >
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl p-8 card-shadow border border-surface-variant/50 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4">
                <span className="material-symbols-outlined text-2xl">calendar_today</span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-2">
                No upcoming meetings scheduled
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-6 text-sm">
                Schedule a coffee chat or call with anyone in your network, or practice your pitch
                right away.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => setIsAddMeetingOpen(true)}
                  className="bg-primary-container text-white font-label-md px-6 py-3 rounded-xl hover:opacity-90 transition-opacity active:scale-95 flex items-center gap-2 shadow-sm text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
                  Schedule Meeting
                </button>
                <Link
                  to="/add-person"
                  className="bg-surface-container-low border border-surface-variant text-on-surface font-label-md px-6 py-3 rounded-xl hover:bg-surface-variant/40 transition-colors flex items-center gap-2 text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Add Connection
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* My Network Section: Renders ALL user connections cleanly */}
        <section className="flex flex-col gap-gutter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">hub</span>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                My Network ({connections.length})
              </h3>
            </div>
            <Link
              to="/person"
              className="font-label-md text-caption text-primary hover:underline flex items-center gap-1"
            >
              View all ({connections.length})
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          {loading ? (
            <div className="bg-surface-container-lowest rounded-xl p-8 card-shadow border border-surface-variant/50 flex items-center justify-center py-10">
              <div className="w-8 h-8 border-3 border-primary-container border-t-transparent rounded-full animate-spin" />
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl p-8 card-shadow border border-surface-variant/50 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-3">
                <span className="material-symbols-outlined text-3xl">people_outline</span>
              </div>
              <h4 className="font-headline-md text-headline-md text-on-surface mb-1 font-bold">
                No connections added yet
              </h4>
              <p className="font-body-md text-sm text-on-surface-variant max-w-sm mb-4">
                Add your first connection to research their background, generate hooks, and practice
                your pitch.
              </p>
              <Link
                to="/add-person"
                className="bg-primary-container text-white font-label-md px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity active:scale-95 flex items-center gap-2 shadow-sm text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Add First Connection
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((conn) => {
                const connMeeting = meetings.find(
                  (m) =>
                    m.connectionId === conn.id &&
                    (m.status === "upcoming" || m.status === "in_progress"),
                );
                return (
                  <div
                    key={conn.id}
                    className="bg-surface-container-lowest rounded-2xl p-5 card-shadow border border-surface-variant/50 flex flex-col justify-between gap-4 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container flex items-center justify-center shadow-xs">
                        {conn.profileImage ? (
                          <img
                            src={conn.profileImage}
                            alt={conn.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-primary text-2xl">
                            person
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to="/connection-profile"
                            search={{ id: conn.id }}
                            className="font-display text-base font-bold text-on-surface hover:text-primary transition-colors truncate block"
                          >
                            {conn.name}
                          </Link>
                          {connMeeting && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-secondary-container/20 text-secondary-container shrink-0 border border-secondary-container/30">
                              Meeting
                            </span>
                          )}
                        </div>
                        <p className="font-body-md text-xs text-on-surface-variant truncate mt-0.5">
                          {[conn.role, conn.company].filter(Boolean).join(" · ") || "Connection"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/30 capitalize">
                            {conn.relationshipStatus || "new"}
                          </span>
                          {conn.researchStatus === "completed" && (
                            <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[13px]">
                                verified
                              </span>
                              Researched
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-surface-variant/30">
                      <Link
                        to="/connection-profile"
                        search={{ id: conn.id }}
                        className="flex-1 text-center py-2 px-3 bg-surface-container-low hover:bg-surface-variant/50 border border-surface-variant/60 rounded-xl text-xs font-semibold text-on-surface transition-colors"
                      >
                        Profile
                      </Link>
                      <Link
                        to="/record"
                        search={{ id: conn.id, connectionId: conn.id }}
                        onClick={() => {
                          console.log("[ColdConnect] Practice Pitch clicked");
                          console.log(`[ColdConnect] Current connection ID: ${conn.id}`);
                          console.log(`[ColdConnect] Current connection name: ${conn.name}`);
                          console.log("[ColdConnect] Navigating to Practice Pitch");
                        }}
                        className="flex-1 text-center py-2 px-3 bg-primary-container text-white hover:opacity-90 rounded-xl text-xs font-semibold transition-opacity flex items-center justify-center gap-1 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">mic</span>
                        <span>Practice Pitch</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe bg-surface/80 backdrop-blur-xl border-t border-surface-variant/20">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-primary after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 active:scale-90 duration-200 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            home
          </span>
          <span className="font-label-md text-label-md mt-1 font-bold">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant active:scale-90 duration-200 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">hub</span>
          <span className="font-label-md text-label-md mt-1">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant active:scale-90 duration-200 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="font-label-md text-label-md mt-1">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant active:scale-90 duration-200 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md mt-1">Profile</span>
        </Link>
      </nav>

      {/* Add Meeting Modal */}
      <AddMeetingModal
        isOpen={isAddMeetingOpen}
        onClose={() => setIsAddMeetingOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />

      <RemoveMeetingDialog
        isOpen={!!removeMeetingData}
        onClose={() => {
          setRemoveMeetingData(null);
          setRemoveError("");
        }}
        onConfirm={handleRemoveMeeting}
        personName={removeMeetingData?.name || ""}
        isRemoving={isRemoving}
      />
    </div>
  );
}
