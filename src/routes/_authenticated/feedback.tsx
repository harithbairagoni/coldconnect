import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUserConnection,
  fetchUserConnections,
  fetchUserMeeting,
  updateUserMeeting,
} from "@/services/dataServices";
import { Connection } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/feedback")({
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
      { title: "Pitch Feedback — ColdConnect" },
      { name: "description", content: "See how your pitch scored and what to improve next." },
      { property: "og:title", content: "Pitch Feedback — ColdConnect" },
      {
        property: "og:description",
        content: "See how your pitch scored and what to improve next.",
      },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const searchParams = Route.useSearch();
  const targetId = searchParams.id || searchParams.connectionId;
  const meetingId = searchParams.meetingId;
  const { user } = useAuth();

  const fallbackDestination = meetingId
    ? { to: "/pitch-prep", search: { meetingId, id: targetId } }
    : targetId
      ? { to: "/connection-profile", search: { id: targetId } }
      : "/person";

  const goBack = useAppBack(fallbackDestination);

  const [connection, setConnection] = useState<Connection | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user?.uid) return;
      try {
        if (targetId) {
          const currentConn = await fetchUserConnection(user.uid, targetId);
          if (isMounted) setConnection(currentConn);
        } else if (isMounted) {
          setConnection(null);
        }

        // If this pitch prep was for a specific meeting, update the meeting's prep status
        if (meetingId) {
          const m = await fetchUserMeeting(user.uid, meetingId);
          if (m) {
            const prepItems = {
              ...(m.preparationItems || {}),
              pitchPracticed: true,
            };
            const count = [
              prepItems.personResearched ?? prepItems.backgroundResearched,
              prepItems.questionsPrepared ?? prepItems.questionsReady,
              prepItems.pitchPracticed,
              prepItems.conversationPlanPrepared ?? prepItems.actionPlanReady,
            ].filter(Boolean).length;
            const newScore = count * 25;

            await updateUserMeeting(user.uid, meetingId, {
              preparationItems: prepItems,
              preparationScore: newScore,
            });
          }
        }
      } catch (err) {
        console.error("Error loading feedback connection:", err);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, targetId, meetingId]);

  const firstName = connection ? connection.name.split(" ")[0] : "your contact";
  const company = connection?.company || "their company";

  return (
    <div className="bg-background text-on-background font-body-md antialiased selection:bg-primary-fixed selection:text-on-primary-fixed min-h-screen relative">
      <header className="flex items-center justify-between px-container-padding h-16 w-full sticky top-0 bg-background/80 backdrop-blur-md z-40">
        <button
          onClick={goBack}
          aria-label="Close feedback"
          className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors active:scale-95 text-on-surface"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>
        <span className="font-label-md text-on-surface-variant">Review</span>
        <div className="w-10"></div>
      </header>

      <main className="max-w-3xl mx-auto px-container-padding pt-unit pb-[140px]">
        <section
          className="flex flex-col items-center animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="relative w-40 h-40 flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-primary-fixed/30 rounded-full blur-2xl"></div>
            <svg
              className="absolute inset-0 w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
            >
              <circle
                className="text-surface-variant/50"
                cx="50"
                cy="50"
                fill="none"
                r="46"
                stroke="currentColor"
                strokeWidth="2"
              ></circle>
              <circle
                className="text-primary animate-circle"
                cx="50"
                cy="50"
                fill="none"
                r="46"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="4"
              ></circle>
            </svg>
            <div className="flex flex-col items-center z-10">
              <div className="flex items-baseline">
                <span className="font-display text-display text-primary">78</span>
              </div>
              <span className="font-label-md text-on-surface-variant uppercase tracking-widest text-[10px] mt-1">
                Score
              </span>
            </div>
          </div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-on-surface text-center max-w-sm leading-tight">
            Strong pitch. Make it more relevant.
          </h1>
        </section>

        <section
          className="mt-section-gap grid grid-cols-2 md:grid-cols-3 gap-gutter animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="col-span-2 md:col-span-1 bg-surface-container-lowest rounded-xl p-5 shadow-level-1 border-2 border-primary relative overflow-hidden flex flex-col justify-between transition-transform duration-300 hover:scale-[1.02]">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
            <div className="flex flex-col mb-4">
              <div className="flex justify-between items-start mb-1">
                <span className="font-label-md text-on-surface font-bold">Relevance</span>
                <span className="font-headline-md text-primary">68</span>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <span className="material-symbols-outlined text-[14px]">my_location</span>
                <span className="font-caption font-semibold">Focus Area</span>
              </div>
            </div>
            <div className="h-[2px] w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "68%" }}></div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level-1 border border-surface-variant/30 flex flex-col justify-between hover:shadow-level-1-hover transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <span className="font-label-md text-on-surface-variant">Clarity</span>
              <span className="font-headline-md text-on-surface">82</span>
            </div>
            <div className="h-[2px] w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "82%" }}></div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level-1 border border-surface-variant/30 flex flex-col justify-between hover:shadow-level-1-hover transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <span className="font-label-md text-on-surface-variant">Confidence</span>
              <span className="font-headline-md text-on-surface">81</span>
            </div>
            <div className="h-[2px] w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "81%" }}></div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level-1 border border-surface-variant/30 flex flex-col justify-between hover:shadow-level-1-hover transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <span className="font-label-md text-on-surface-variant">Storytelling</span>
              <span className="font-headline-md text-on-surface">76</span>
            </div>
            <div className="h-[2px] w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "76%" }}></div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level-1 border border-surface-variant/30 flex flex-col justify-between hover:shadow-level-1-hover transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <span className="font-label-md text-on-surface-variant">Conciseness</span>
              <span className="font-headline-md text-on-surface">74</span>
            </div>
            <div className="h-[2px] w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "74%" }}></div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-level-1 border border-surface-variant/30 flex flex-col justify-between hover:shadow-level-1-hover transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <span className="font-label-md text-on-surface-variant">Memorability</span>
              <span className="font-headline-md text-on-surface">84</span>
            </div>
            <div className="h-[2px] w-full bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: "84%" }}></div>
            </div>
          </div>
        </section>

        <section
          className="mt-section-gap flex flex-col gap-stack-gap animate-fade-up"
          style={{ animationDelay: "0.3s" }}
        >
          <article className="bg-surface-container-lowest rounded-xl p-6 shadow-level-1 border border-surface-variant/30 relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-secondary-container/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-on-secondary-container">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lightbulb
                </span>
              </div>
              <h2 className="font-label-md text-on-surface">Your biggest opportunity</h2>
            </div>
            <p className="font-body-lg text-on-surface-variant leading-relaxed relative z-10">
              You explained your background, but make sure to give {firstName} a clear, specific
              reason to partner or collaborate.
            </p>
          </article>

          <article className="bg-surface-container-lowest rounded-xl p-6 shadow-level-1 border border-surface-variant/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  edit_note
                </span>
              </div>
              <h2 className="font-label-md text-on-surface">Improve this</h2>
            </div>
            <div className="flex flex-col gap-3 relative pl-4 border-l-2 border-surface-variant/30 md:border-none md:pl-0 md:gap-4">
              <div className="bg-surface-container/50 p-4 rounded-xl border border-surface-variant/40 md:w-[90%]">
                <span className="font-caption text-on-surface-variant uppercase tracking-wider block mb-2 font-semibold">
                  You said
                </span>
                <p className="font-body-md text-on-surface line-through decoration-on-surface-variant/50 decoration-2">
                  "I've worked on multiple projects..."
                </p>
              </div>

              <div className="hidden md:block absolute left-[90%] top-1/2 -translate-y-1/2 w-[10%] h-[2px] bg-surface-variant/30"></div>
              <div className="hidden md:flex absolute left-[90%] top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-surface-container-lowest rounded-full border border-surface-variant/40 items-center justify-center z-10 shadow-sm text-primary">
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>

              <div className="md:hidden absolute -left-[1px] top-12 bottom-12 w-[2px] bg-primary/30"></div>

              <div className="bg-primary-fixed/20 p-5 rounded-xl border border-primary-fixed-dim/40 md:w-[90%] md:ml-auto md:mt-2 relative">
                <span className="font-caption text-primary uppercase tracking-wider block mb-2 font-bold">
                  Try
                </span>
                <p className="font-body-md text-on-surface">
                  "I specialize in identifying high-impact levers and solving difficult strategic
                  problems..."
                </p>
              </div>
            </div>
          </article>

          <article className="bg-surface-container-lowest rounded-xl p-6 shadow-level-1 border border-surface-variant/30 bg-gradient-to-br from-surface-container-lowest to-surface-container/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  forum
                </span>
              </div>
              <h2 className="font-label-md text-on-surface">Conversation Bridge</h2>
            </div>
            <div className="relative px-6 py-8">
              <span className="absolute top-0 left-0 text-6xl text-surface-variant/30 font-display leading-none select-none">
                "
              </span>
              <span className="absolute bottom-0 right-0 text-6xl text-surface-variant/30 font-display leading-none select-none rotate-180">
                "
              </span>
              <p className="font-body-lg text-on-surface italic text-center relative z-10 px-2">
                I’d love to hear how your experience at {company} shaped your perspective on these
                industry trends.
              </p>
            </div>
          </article>
        </section>
      </main>

      <div
        className="fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-xl border-t border-surface-variant/20 px-container-padding py-4 pb-safe z-50 animate-fade-up"
        style={{ animationDelay: "0.4s" }}
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-4">
          <Link
            to="/"
            className="flex-1 border border-primary-container text-primary-container bg-transparent rounded-xl py-3.5 px-6 font-label-md hover:bg-primary-container/5 transition-colors active:scale-[0.98] text-center order-2 sm:order-1"
          >
            Finish & Return Home
          </Link>
          <Link
            to="/pitch-prep"
            search={{ id: connection?.id, connectionId: connection?.id, meetingId }}
            className="flex-1 bg-primary-container text-white rounded-xl py-3.5 px-6 font-label-md hover:opacity-90 transition-opacity active:scale-[0.98] text-center shadow-md shadow-primary-container/20 order-1 sm:order-2"
          >
            Practice Again
          </Link>
        </div>
      </div>
    </div>
  );
}
