import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserConnection, fetchUserConnections } from "@/services/dataServices";
import { Connection } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/connection-options")({
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
      { title: "Connection Options — ColdConnect" },
      {
        name: "description",
        content: "Choose how you want to reach out and open the conversation.",
      },
      { property: "og:title", content: "Connection Options — ColdConnect" },
      {
        property: "og:description",
        content: "Choose how you want to reach out and open the conversation.",
      },
    ],
  }),
  component: ConnectionOptionsPage,
});

function ConnectionOptionsPage() {
  const searchParams = Route.useSearch();
  const targetId = searchParams.id || searchParams.connectionId;
  const { user, profile } = useAuth();

  const fallbackDestination = targetId
    ? { to: "/connection-profile", search: { id: targetId } }
    : "/person";

  const goBack = useAppBack(fallbackDestination);

  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user?.uid) return;
      try {
        if (isMounted) setLoading(true);
        if (targetId) {
          const direct = await fetchUserConnection(user.uid, targetId);
          if (isMounted) setConnection(direct || null);
        } else if (isMounted) {
          setConnection(null);
        }
      } catch (err) {
        console.error("Error loading connection:", err);
        if (isMounted) setConnection(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, targetId]);

  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
  const personName = connection?.name || "your connection";
  const connId = connection?.id || "";

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col relative pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors group"
          >
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[24px]">
              arrow_back
            </span>
          </button>
          <h1 className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed">
            ColdConnect
          </h1>
          <Link
            to="/profile"
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-surface-container hover:opacity-80 transition-opacity cursor-pointer block"
          >
            <img alt="User profile photo" className="w-full h-full object-cover" src={avatarUrl} />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-container-padding pt-32 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-label-md text-on-surface-variant">Loading options...</p>
          </div>
        ) : !connection ? (
          <div className="text-center py-16">
            <h2 className="font-headline-lg text-on-surface mb-2">No connection selected</h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              Please add or select a connection to choose outreach options.
            </p>
            <Link
              to="/add-person"
              className="bg-primary-container text-on-primary px-6 py-3 rounded-xl font-label-md"
            >
              Add Connection
            </Link>
          </div>
        ) : (
          <>
            <section className="mb-section-gap text-center md:text-left">
              <h2 className="font-headline-lg-mobile md:font-headline-lg text-on-surface mb-unit">
                Make the first move.
              </h2>
              <p className="font-body-lg text-on-surface-variant">
                Choose how you'd like to connect with {personName}.
              </p>
            </section>

            <section className="mb-section-gap animate-fade-in-up">
              <div className="bg-surface-container-low rounded-xl p-6 border border-surface-variant relative overflow-hidden group hover:border-primary-fixed transition-colors duration-300">
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                <div className="flex items-start gap-4 relative z-10">
                  <div className="mt-1 w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined filled text-on-secondary-container text-[18px]">
                      auto_awesome
                    </span>
                  </div>
                  <div>
                    <h3 className="font-label-md text-label-md text-on-surface mb-1">
                      ColdConnect recommends: LinkedIn
                    </h3>
                    <p className="font-body-md text-on-surface-variant leading-relaxed">
                      Best fit for your relationship because you're connecting for{" "}
                      {connection.meetingPurpose
                        ? connection.meetingPurpose.replace("_", " ")
                        : "career exploration"}
                      .
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-stack-gap">
              <Link
                to="/connection-request"
                search={{ id: connId, channel: "linkedin" }}
                className="interactive-card block bg-surface-container-lowest rounded-[24px] p-6 shadow-soft-float border-2 border-primary/10 relative overflow-hidden active:scale-[0.99] transition-transform"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-[#F3F6F8] flex items-center justify-center shrink-0">
                      <svg
                        fill="#0A66C2"
                        height={24}
                        viewBox="0 0 24 24"
                        width={24}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-headline-md text-headline-md text-on-surface mb-0.5">
                        LinkedIn
                      </h4>
                      <p className="font-caption text-caption text-on-surface-variant">
                        Professional connection
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-primary group">
                    <span className="font-label-md text-label-md mr-2 hidden sm:inline-block">
                      Connect on LinkedIn
                    </span>
                    <span className="material-symbols-outlined transform group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </Link>

              <Link
                to="/connection-request"
                search={{ id: connId, channel: "instagram" }}
                className="interactive-card block bg-surface-container-lowest rounded-[24px] p-6 shadow-soft-float border border-surface-variant relative overflow-hidden active:scale-[0.99] transition-transform"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center shrink-0 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#FFDC80] via-[#F56040] to-[#C13584] opacity-20"></div>
                      <svg
                        className="relative z-10"
                        fill="none"
                        height={24}
                        stroke="#C13584"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        width={24}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect height={20} rx="5" ry="5" width={20} x="2" y="2"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-headline-md text-headline-md text-on-surface mb-0.5">
                        Instagram
                      </h4>
                      <p className="font-caption text-caption text-on-surface-variant">
                        Social connection
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-on-surface group hover:text-primary transition-colors">
                    <span className="font-label-md text-label-md mr-2 hidden sm:inline-block">
                      Connect on Instagram
                    </span>
                    <span className="material-symbols-outlined transform group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </Link>

              <Link
                to="/connection-request"
                search={{ id: connId, channel: "email" }}
                className="interactive-card block bg-surface-container-lowest rounded-[24px] p-6 shadow-soft-float border border-surface-variant active:scale-[0.99] transition-transform"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant">
                      <span className="material-symbols-outlined filled text-[24px]">mail</span>
                    </div>
                    <div>
                      <h4 className="font-headline-md text-headline-md text-on-surface mb-0.5">
                        Email
                      </h4>
                      <p className="font-caption text-caption text-on-surface-variant">
                        Direct connection
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-on-surface group hover:text-primary transition-colors">
                    <span className="font-label-md text-label-md mr-2 hidden sm:inline-block">
                      Send Email
                    </span>
                    <span className="material-symbols-outlined transform group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </div>
              </Link>
            </section>

            <div className="mt-12 text-center">
              <Link
                to="/person"
                search={{ id: connId }}
                className="font-label-md text-label-md text-outline hover:text-on-surface transition-colors py-2 px-4 rounded-full"
              >
                Skip for now
              </Link>
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe bg-surface/80 dark:bg-surface/80 backdrop-blur-xl md:hidden">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mb-1 text-[24px]">home</span>
          <span className="font-label-md text-[10px] uppercase tracking-widest">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 active:scale-90 duration-200"
        >
          <span
            className="material-symbols-outlined filled mb-1 text-[24px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            hub
          </span>
          <span className="font-label-md text-[10px] uppercase tracking-widest">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mb-1 text-[24px]">calendar_today</span>
          <span className="font-label-md text-[10px] uppercase tracking-widest">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mb-1 text-[24px]">person</span>
          <span className="font-label-md text-[10px] uppercase tracking-widest">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
