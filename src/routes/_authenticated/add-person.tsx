import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createUserConnection, triggerResearchPerson } from "@/services/dataServices";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/add-person")({
  head: () => ({
    meta: [
      { title: "Add Person — ColdConnect" },
      {
        name: "description",
        content: "Add someone new to your network and start preparing for the conversation.",
      },
      { property: "og:title", content: "Add Person — ColdConnect" },
      {
        property: "og:description",
        content: "Add someone new to your network and start preparing for the conversation.",
      },
    ],
  }),
  component: AddPersonPage,
});

const DEFAULT_INTEREST_SUGGESTIONS = [
  "Strategy",
  "Product Leadership",
  "Engineering",
  "AI & ML",
  "Growth",
  "Industry Insights",
  "Design",
  "Fundraising",
];

function validateAndNormalizeLinkedIn(input: string): {
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, normalizedUrl: "", error: "LinkedIn URL is required." };
  }

  // Matches common LinkedIn profile URLs
  // e.g. https://www.linkedin.com/in/username, linkedin.com/in/username, www.linkedin.com/in/username
  const linkedinRegex =
    /^(?:https?:\/\/)?(?:(?:www|[a-zA-Z]{2,3})\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\u0080-\uFFFF%]+)(?:[/?#].*)?$/i;

  const match = trimmed.match(linkedinRegex);
  if (!match) {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Please enter a valid LinkedIn profile URL.",
    };
  }

  const username = match[1];
  if (!username || username.trim() === "") {
    return {
      isValid: false,
      normalizedUrl: "",
      error: "Please enter a valid LinkedIn profile URL.",
    };
  }

  // Normalize to standard https:// format
  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    if (/^(?:www\.)?linkedin\.com/i.test(normalized)) {
      normalized = normalized.replace(/^(?:www\.)?linkedin\.com/i, "https://www.linkedin.com");
    } else {
      normalized = `https://${normalized}`;
    }
  } else if (normalized.startsWith("http://")) {
    normalized = normalized.replace(/^http:\/\//i, "https://");
  }

  if (/^https:\/\/linkedin\.com/i.test(normalized)) {
    normalized = normalized.replace(/^https:\/\/linkedin\.com/i, "https://www.linkedin.com");
  }

  return { isValid: true, normalizedUrl: normalized };
}

function AddPersonPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const goBack = useAppBack("/");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("career_advice");
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState<"idle" | "saving" | "researching" | "done">(
    "idle",
  );

  // Field-level inline validation errors
  const [nameError, setNameError] = useState("");
  const [linkedinError, setLinkedinError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleAddCustomInterest = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const trimmed = customInterest.trim();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setCustomInterest("");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let hasError = false;
    let currentNameError = "";
    let currentLinkedinError = "";

    // 1. Name validation (required)
    if (!name.trim()) {
      currentNameError = "Name is required.";
      hasError = true;
    }

    // 2. LinkedIn URL validation (optional, but normalized & validated if provided)
    let normalizedLinkedinUrl: string | undefined = undefined;
    const trimmedLinkedin = linkedin.trim();
    if (trimmedLinkedin) {
      const linkedinValidation = validateAndNormalizeLinkedIn(trimmedLinkedin);
      if (!linkedinValidation.isValid) {
        currentLinkedinError =
          linkedinValidation.error || "Please enter a valid LinkedIn profile URL.";
        hasError = true;
      } else {
        normalizedLinkedinUrl = linkedinValidation.normalizedUrl;
      }
    }

    setNameError(currentNameError);
    setLinkedinError(currentLinkedinError);
    setGeneralError("");

    if (hasError) {
      return;
    }

    if (!user?.uid) {
      setGeneralError("Please log in to add a connection.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmittingStep("saving");

      const hasValidLinkedin = Boolean(normalizedLinkedinUrl);
      const initialResearchStatus = hasValidLinkedin ? "researching" : "not_researched";
      const startedAt = hasValidLinkedin ? new Date().toISOString() : undefined;

      const connection = await createUserConnection(user.uid, {
        name: name.trim(),
        linkedinURL: normalizedLinkedinUrl,
        linkedinUrl: normalizedLinkedinUrl,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        instagramHandle: instagram.trim() || undefined,
        email: email.trim() || undefined,
        meetingPurpose: purpose || undefined,
        relationshipStatus: "new",
        researchStatus: initialResearchStatus,
        researchStartedAt: startedAt,
        interests: interests.length > 0 ? interests : undefined,
        notes: notes.trim() ? [notes.trim()] : undefined,
      });

      // If a valid LinkedIn URL exists, trigger research immediately and asynchronously
      if (hasValidLinkedin && connection?.id) {
        setSubmittingStep("researching");
        console.log(
          `[ColdConnect] Automatically triggering LinkedIn research for connection: ${connection.id}`,
        );
        // Non-blocking trigger: start research in background
        triggerResearchPerson(connection.id, false).catch((err) => {
          console.warn("[Auto-Research Background Notice]", err);
        });
      } else {
        setSubmittingStep("done");
      }

      // Navigate immediately to the newly created connection profile
      navigate({
        to: "/connection-profile",
        search: { id: connection.id },
      });
    } catch (err: unknown) {
      console.error("Failed to add connection:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to save connection. Please try again.";
      setGeneralError(errorMsg);
      setSubmittingStep("idle");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-xl border-b border-surface-container/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-container-padding h-16">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-highest transition-colors active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined" data-icon="arrow_back">
              arrow_back
            </span>
          </button>
          <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">
            New Connection
          </span>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-container-padding pt-section-gap pb-40">
        <h1 className="font-display text-display text-on-surface mb-section-gap">
          Who are you meeting?
        </h1>

        {generalError && (
          <div className="p-4 mb-6 bg-error-container/20 border border-error/30 text-error rounded-xl font-body-md text-sm">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-section-gap">
          <div className="flex flex-col gap-stack-gap">
            {/* Required Field: Name */}
            <div className="flex flex-col gap-1.5 group">
              <label
                className={`font-label-md text-label-md transition-colors ${
                  nameError
                    ? "text-error font-semibold"
                    : "text-on-surface-variant group-focus-within:text-primary"
                }`}
                htmlFor="name"
              >
                Name *
              </label>
              <input
                className={`w-full bg-surface-container-low text-on-surface font-body-lg text-body-lg px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ${
                  nameError
                    ? "ring-error bg-error-container/10 focus:ring-error"
                    : "ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest"
                } transition-all placeholder:text-outline-variant outline-none`}
                id="name"
                name="name"
                placeholder="First and Last Name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
              />
              {nameError && (
                <p className="text-xs text-error font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {nameError}
                </p>
              )}
            </div>

            {/* Required Field: LinkedIn URL */}
            <div className="flex flex-col gap-1.5 group">
              <label
                className={`font-label-md text-label-md transition-colors ${
                  linkedinError
                    ? "text-error font-semibold"
                    : "text-on-surface-variant group-focus-within:text-primary"
                }`}
                htmlFor="linkedin"
              >
                LinkedIn URL *
              </label>
              <input
                className={`w-full bg-surface-container-low text-on-surface font-body-lg text-body-lg px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ${
                  linkedinError
                    ? "ring-error bg-error-container/10 focus:ring-error"
                    : "ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest"
                } transition-all placeholder:text-outline-variant outline-none`}
                id="linkedin"
                name="linkedin"
                placeholder="https://linkedin.com/in/..."
                type="text"
                value={linkedin}
                onChange={(e) => {
                  setLinkedin(e.target.value);
                  if (linkedinError) setLinkedinError("");
                }}
              />
              {linkedinError && (
                <p className="text-xs text-error font-medium mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {linkedinError}
                </p>
              )}
            </div>

            {/* Optional Fields: Company & Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-gap">
              <div className="flex flex-col gap-2 group">
                <label
                  className="font-label-md text-label-md text-on-surface-variant transition-colors group-focus-within:text-primary"
                  htmlFor="company"
                >
                  Company
                </label>
                <input
                  className="w-full bg-surface-container-low text-on-surface font-body-lg text-body-lg px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant outline-none"
                  id="company"
                  name="company"
                  placeholder="Organization name"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label
                  className="font-label-md text-label-md text-on-surface-variant transition-colors group-focus-within:text-primary"
                  htmlFor="role"
                >
                  Role
                </label>
                <input
                  className="w-full bg-surface-container-low text-on-surface font-body-lg text-body-lg px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant outline-none"
                  id="role"
                  name="role"
                  placeholder="Current title or position"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>

            {/* Optional Fields: Instagram & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-gap">
              <div className="flex flex-col gap-2 group">
                <label
                  className="font-label-md text-label-md text-on-surface-variant transition-colors group-focus-within:text-primary"
                  htmlFor="instagram"
                >
                  Instagram Handle
                </label>
                <input
                  className="w-full bg-surface-container-low text-on-surface font-body-lg text-body-lg px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant outline-none"
                  id="instagram"
                  name="instagram"
                  placeholder="@username"
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label
                  className="font-label-md text-label-md text-on-surface-variant transition-colors group-focus-within:text-primary"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  className="w-full bg-surface-container-low text-on-surface font-body-lg text-body-lg px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant outline-none"
                  id="email"
                  name="email"
                  placeholder="contact@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Optional: Meeting Purpose */}
          <div className="flex flex-col gap-4">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Why are you meeting them?
            </label>
            <div aria-label="Meeting purpose" className="flex flex-wrap gap-3" role="radiogroup">
              {[
                { id: "career_advice", label: "Career advice" },
                { id: "recruiting", label: "Recruiting" },
                { id: "networking", label: "Networking" },
                { id: "industry", label: "Industry learning" },
                { id: "other", label: "Other" },
              ].map((item) => (
                <label key={item.id} className="cursor-pointer">
                  <input
                    className="peer sr-only"
                    name="purpose"
                    type="radio"
                    value={item.id}
                    checked={purpose === item.id}
                    onChange={() => setPurpose(item.id)}
                  />
                  <div
                    className={`px-5 py-2.5 rounded-full font-label-md text-label-md transition-all active:scale-95 select-none ${
                      purpose === item.id
                        ? "border-2 border-primary-container bg-primary-container text-on-primary"
                        : "border border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                    }`}
                  >
                    {item.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Optional: Relevant Interests */}
          <div className="flex flex-col gap-3">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Relevant Interests
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DEFAULT_INTEREST_SUGGESTIONS.map((item) => {
                const selected = interests.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInterest(item)}
                    className={`px-3 py-1.5 rounded-full font-caption text-caption transition-all flex items-center gap-1.5 ${
                      selected
                        ? "bg-primary-container text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-outline-variant/40"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {selected ? "check" : "add"}
                    </span>
                    {item}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 bg-surface-container-low text-on-surface font-body-md text-body-md px-gutter py-2.5 rounded-xl border-0 ring-1 ring-inset ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant outline-none"
                placeholder="Add custom interest tag..."
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={handleAddCustomInterest}
              />
              <button
                type="button"
                onClick={handleAddCustomInterest}
                className="px-4 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Optional: Initial Notes */}
          <div className="flex flex-col gap-2 group">
            <label
              className="font-label-md text-label-md text-on-surface-variant transition-colors group-focus-within:text-primary"
              htmlFor="notes"
            >
              Initial Notes / Context
            </label>
            <textarea
              className="w-full bg-surface-container-low text-on-surface font-body-md text-body-md px-gutter py-3 rounded-xl border-0 ring-1 ring-inset ring-transparent focus:ring-primary-container focus:bg-surface-container-lowest transition-all placeholder:text-outline-variant outline-none resize-none"
              id="notes"
              name="notes"
              rows={3}
              placeholder="Any background context, mutual connections, or key goals..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>
      </main>

      {/* Floating CTA & Helper Text */}
      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-8 pb-6 px-container-padding z-40 pointer-events-none flex justify-center">
        <div className="w-full max-w-3xl pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary py-4 px-6 rounded-xl font-label-md text-label-md hover:opacity-90 transition-all duration-200 active:scale-[0.98] shadow-[0_8px_20px_rgba(6,78,59,0.15)] disabled:opacity-75"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <span>
                  {submittingStep === "researching"
                    ? "Connection added ✓ Researching LinkedIn..."
                    : submittingStep === "saving"
                      ? "Saving connection..."
                      : "Adding Connection..."}
                </span>
              </>
            ) : (
              <>
                <span>Add Connection</span>
                <span className="material-symbols-outlined text-lg" data-icon="arrow_forward">
                  arrow_forward
                </span>
              </>
            )}
          </button>
          <p className="text-xs text-on-surface-variant/70 text-center font-body-md">
            Just add their name and LinkedIn profile. You can add more details later.
          </p>
        </div>
      </div>
    </div>
  );
}
