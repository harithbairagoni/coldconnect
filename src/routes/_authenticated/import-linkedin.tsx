import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/import-linkedin")({
  head: () => ({
    meta: [
      { title: "Import your professional story — ColdConnect" },
      {
        name: "description",
        content: "Connect your LinkedIn to quickly build your ColdConnect profile.",
      },
    ],
  }),
  component: ImportLinkedinPage,
});

function ImportLinkedinPage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/profile");
  const { user, profile, updateProfile } = useAuth();

  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedinURL || "");
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Real-time status reflection
  const researchStatus = profile?.linkedinResearchStatus;
  const isResearching = researchStatus === "researching" || isImporting;
  const isCompleted = researchStatus === "completed";
  const isFailed = researchStatus === "failed";

  const displayName =
    profile?.fullName || user?.displayName || user?.email?.split("@")[0] || "Your Name";
  const displayHeadline = profile?.headline || "Add your headline";
  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  // If the background job finishes while we are waiting
  useEffect(() => {
    if (isImporting && isCompleted) {
      setIsImporting(false);
      navigate({ to: "/review-profile" });
    }
    if (isImporting && isFailed) {
      setIsImporting(false);
      setErrorMsg("Unable to import your LinkedIn profile right now. Please try again.");
    }
  }, [isCompleted, isFailed, isImporting, navigate]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!linkedinUrl.trim()) {
      setErrorMsg("Please enter a valid LinkedIn URL.");
      return;
    }

    setIsImporting(true);

    try {
      const idToken = await user?.getIdToken();

      const response = await fetch("/api/profile/import-linkedin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ linkedinUrl }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response (expected JSON).");
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to start import.");
      }

      // Update local context preemptively to show importing state while Firestore syncs
      await updateProfile({
        linkedinURL: linkedinUrl,
        linkedinResearchStatus: "researching",
      });
    } catch (err: unknown) {
      console.error("[Import] Import failed:", err);
      setIsImporting(false);
      setErrorMsg(
        err.message || "Unable to import your LinkedIn profile right now. Please try again.",
      );
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased pb-[80px]">
      <header className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200 p-2 -ml-2"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="font-display text-headline-md font-bold text-primary">ColdConnect</h1>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
            <img className="w-full h-full object-cover" alt="User avatar" src={avatarUrl} />
          </div>
        </div>
      </header>
      <main className="flex-grow w-full max-w-7xl mx-auto px-container-padding py-section-gap flex flex-col items-center justify-center min-h-[calc(100vh-80px)] pt-20">
        <div className="text-center mb-section-gap max-w-lg w-full">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-unit">
            Import your professional story
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Connect your LinkedIn to quickly build your profile.
          </p>
        </div>

        <div
          className="bg-surface-container-lowest rounded-xl p-container-padding w-full max-w-lg shadow-[0_4px_20px_rgba(0,53,39,0.1)] transition-transform duration-200 border border-surface-container-high"
          id="importCard"
        >
          <div className="flex items-center gap-gutter mb-stack-gap pb-stack-gap border-b border-surface-variant">
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-surface-container">
              <img className="w-full h-full object-cover" alt="User avatar" src={avatarUrl} />
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-background">
                {displayName}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">{displayHeadline}</p>
            </div>
          </div>

          <form onSubmit={handleImport}>
            <div className="mb-stack-gap">
              <label
                className="block font-label-md text-label-md text-on-surface-variant mb-unit"
                htmlFor="linkedinUrl"
              >
                LinkedIn Profile URL
              </label>
              <div className="relative flex items-center">
                <span
                  className="absolute left-0 pl-3 text-on-surface-variant material-symbols-outlined"
                  data-icon="link"
                >
                  link
                </span>
                <input
                  className="w-full bg-surface-container-low border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary pl-10 pr-4 py-3 rounded-lg font-body-md text-body-md text-on-background placeholder-on-surface-variant/50 transition-colors"
                  id="linkedinUrl"
                  placeholder="linkedin.com/in/username"
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={isResearching}
                />
              </div>
              {errorMsg && <p className="mt-2 text-sm text-error font-medium">{errorMsg}</p>}
            </div>

            <button
              type="submit"
              disabled={isResearching}
              className="w-full bg-primary-container text-on-primary rounded-[16px] py-4 px-6 font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-primary transition-colors hover:scale-[0.98] active:scale-[0.95] duration-200 disabled:opacity-50"
              id="importBtn"
            >
              {isResearching
                ? "Researching your professional profile..."
                : isCompleted
                  ? "✓ Profile imported"
                  : "Import Profile"}
              {!isResearching && !isCompleted && (
                <span className="material-symbols-outlined text-[18px]" data-icon="arrow_forward">
                  arrow_forward
                </span>
              )}
            </button>
            <Link
              to="/build-profile"
              className="w-full mt-unit bg-transparent text-primary-container border border-primary-container rounded-[16px] py-3 px-6 font-label-md text-label-md flex items-center justify-center hover:bg-surface-container-low transition-colors"
            >
              Skip for now
            </Link>
          </form>
        </div>

        {isResearching && (
          <div
            className="fixed inset-0 bg-surface/90 backdrop-blur-md z-40 flex flex-col items-center justify-center px-container-padding"
            id="loadingOverlay"
          >
            <div className="bg-surface-container-lowest rounded-xl p-container-padding w-full max-w-sm shadow-[0_8px_30px_rgba(0,53,39,0.15)] border border-surface-variant text-center">
              <div className="w-12 h-12 border-4 border-surface-variant border-t-primary rounded-full animate-spin mx-auto mb-stack-gap"></div>
              <h3 className="font-headline-md text-headline-md text-on-background mb-stack-gap">
                Building your profile...
              </h3>
              <p className="text-body-md text-on-surface-variant mb-4">
                LinkedIn research is running in the background. You can continue using ColdConnect.
              </p>
              <div className="text-left space-y-unit">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span className="font-body-md text-body-md">Experience</span>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span className="font-body-md text-body-md">Education</span>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span className="font-body-md text-body-md">Skills</span>
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span className="font-body-md text-body-md">About</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
