import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserConnection, fetchUserConnections } from "@/services/dataServices";
import { Connection } from "@/types/models";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/connection-request")({
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
    channel: typeof search.channel === "string" ? search.channel : "linkedin",
  }),
  head: () => ({
    meta: [
      { title: "Connection Request — ColdConnect" },
      { name: "description", content: "Craft a connection request that earns a reply." },
      { property: "og:title", content: "Connection Request — ColdConnect" },
      { property: "og:description", content: "Craft a connection request that earns a reply." },
    ],
  }),
  component: ConnectionRequestPage,
});

function ConnectionRequestPage() {
  const searchParams = Route.useSearch();
  const targetId = searchParams.id || searchParams.connectionId;
  const channel = searchParams.channel || "linkedin";
  const { user, profile } = useAuth();

  const fallbackDestination = targetId
    ? { to: "/connection-options", search: { id: targetId } }
    : "/person";

  const goBack = useAppBack(fallbackDestination);

  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user?.uid) return;
      try {
        if (isMounted) setLoading(true);
        if (targetId) {
          const currentConn = await fetchUserConnection(user.uid, targetId);
          if (!isMounted) return;
          setConnection(currentConn);
          if (currentConn) {
            const name = currentConn.name.split(" ")[0];
            const role = currentConn.role || "professional";
            const comp = currentConn.company || "your team";
            const msg = `Hi ${name}, I came across your work as ${role} at ${comp} and found it really insightful. I'm exploring new opportunities in this space and would love to connect and learn from your journey.`;
            setMessage(msg);
          }
        } else if (isMounted) {
          setConnection(null);
        }
      } catch (err) {
        console.error("Failed to load connection request data:", err);
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      if (channel === "linkedin" && connection?.linkedinURL) {
        window.open(connection.linkedinURL, "_blank");
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  return (
    <div className="bg-background min-h-screen text-on-background selection:bg-primary-container selection:text-on-primary-container">
      <nav className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl flex items-center justify-between px-container-padding h-16 max-w-7xl mx-auto transition-all duration-300">
        <button
          onClick={goBack}
          aria-label="Close"
          className="text-primary dark:text-primary-fixed hover:opacity-80 transition-opacity active:scale-95 duration-200 flex items-center justify-center p-2 -ml-2 rounded-full"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>

        <div className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed flex-1 text-center">
          ColdConnect
        </div>

        <Link
          to="/profile"
          className="hover:opacity-80 transition-opacity active:scale-95 duration-200 flex-shrink-0 cursor-pointer block"
        >
          <img
            alt="User profile"
            className="w-8 h-8 rounded-full object-cover border border-surface-variant shadow-sm"
            src={avatarUrl}
          />
        </Link>
      </nav>

      <main className="pt-[96px] pb-safe px-container-padding max-w-2xl mx-auto flex flex-col min-h-screen">
        <header className="mb-section-gap flex flex-col gap-2">
          <span className="font-label-md text-label-md text-primary tracking-wider uppercase">
            Connection Request · {channel}
          </span>
          <h1 className="font-display text-display text-on-background leading-tight">
            Let's make this personal.
          </h1>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-label-md text-on-surface-variant">Loading connection details...</p>
          </div>
        ) : !connection ? (
          <div className="text-center py-16">
            <h2 className="font-headline-lg text-on-surface mb-2">No connection found</h2>
            <p className="font-body-md text-on-surface-variant mb-6">
              Please select or add a connection to craft a message.
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
            <section className="bg-surface-container-lowest rounded-xl p-5 shadow-[0_15px_30px_-10px_rgba(6,78,59,0.08)] mb-stack-gap flex items-center gap-4 transition-transform duration-300">
              <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container flex items-center justify-center">
                {connection.profileImage ? (
                  <img
                    className="w-full h-full object-cover"
                    alt={connection.name}
                    src={connection.profileImage}
                  />
                ) : (
                  <span className="material-symbols-outlined text-primary text-3xl">person</span>
                )}
              </div>
              <div className="flex flex-col">
                <h2 className="font-headline-md text-headline-md text-on-background m-0">
                  {connection.name}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1 line-clamp-1">
                  {connection.role || "Professional"} · {connection.company || "Industry Lead"}
                </p>
              </div>
            </section>

            <section className="flex flex-col gap-2 mb-section-gap flex-1">
              <div className="message-trough bg-surface-container-low rounded-xl p-5 border border-surface-variant focus-within:border-primary transition-all relative group">
                <textarea
                  className="w-full h-48 bg-transparent border-none focus:ring-0 resize-none font-body-lg text-body-lg text-on-background placeholder:text-outline-variant p-0 m-0 outline-none"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="font-caption text-caption text-on-surface-variant flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                  {message.length} / 300 characters
                </span>
                <span className="font-caption text-caption text-outline italic">
                  Focus on mutual interests
                </span>
              </div>
            </section>

            <footer className="mt-auto flex flex-col gap-stack-gap pb-8">
              <div className="flex items-center justify-center gap-2 font-caption text-caption text-on-surface-variant bg-surface-container-low py-2 px-4 rounded-full mx-auto w-fit">
                <span className="material-symbols-outlined text-[16px]">info</span>
                We won't send this automatically.
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCopy}
                  className="w-full bg-primary-container text-on-primary-container font-label-md text-label-md py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {copied ? "done" : "content_copy"}
                  </span>
                  {copied
                    ? "Copied to Clipboard!"
                    : `Copy & Open ${channel === "linkedin" ? "LinkedIn" : channel === "instagram" ? "Instagram" : "Email"}`}
                </button>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
