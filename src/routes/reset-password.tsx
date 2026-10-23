import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { auth, confirmPasswordReset } from "@/lib/firebase";
import { updatePassword } from "firebase/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a New Password \u2014 ColdConnect" },
      { name: "description", content: "Choose a new password for your ColdConnect account." },
      { property: "og:title", content: "Set a New Password \u2014 ColdConnect" },
      {
        property: "og:description",
        content: "Choose a new password for your ColdConnect account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      // Check if oobCode query param exists in url for email link reset
      const searchParams = new URLSearchParams(window.location.search);
      const oobCode = searchParams.get("oobCode");

      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, password);
      } else if (auth.currentUser) {
        await updatePassword(auth.currentUser, password);
      } else {
        throw new Error("No password reset code found and no active user session.");
      }

      setDone(true);
      setTimeout(() => navigate({ to: "/auth", replace: true }), 1500);
    } catch (err: unknown) {
      console.error("Reset password error:", err);
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full h-12 rounded-[16px] bg-surface-container-lowest border border-surface-variant px-4 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col">
      <header className="w-full max-w-7xl mx-auto flex items-center justify-center h-16 px-container-padding">
        <h1 className="font-display text-headline-md font-bold text-primary">ColdConnect</h1>
      </header>
      <main className="flex-1 w-full max-w-md mx-auto px-container-padding pt-8 flex flex-col gap-stack-gap">
        <section className="flex flex-col gap-unit text-center">
          <h2 className="font-display text-display text-primary">Set a new password.</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Choose something you'll remember next time.
          </p>
        </section>
        <form onSubmit={handleSubmit} className="flex flex-col gap-gutter">
          <input
            className={inputClass}
            type="password"
            required
            minLength={6}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            className={inputClass}
            type="password"
            required
            minLength={6}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="font-caption text-caption text-error">{error}</p>}
          {done && (
            <p className="font-caption text-caption text-primary">
              Password updated! Taking you to sign in\u2026
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary-container text-white rounded-[16px] font-label-md text-label-md flex items-center justify-center hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Updating\u2026" : "Update password"}
          </button>
        </form>
      </main>
    </div>
  );
}
