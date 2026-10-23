import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In \u2014 ColdConnect" },
      {
        name: "description",
        content: "Sign in or create your ColdConnect account to prepare for every introduction.",
      },
      { property: "og:title", content: "Sign In \u2014 ColdConnect" },
      {
        property: "og:description",
        content: "Sign in or create your ColdConnect account to prepare for every introduction.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showFilm, setShowFilm] = useState(false);

  useEffect(() => {
    if (user) {
      navigate({ to: "/", replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        await signUpWithEmail(email.trim(), password, fullName.trim());
        navigate({ to: "/", replace: true });
      } else {
        await sendPasswordReset(email.trim());
        setNotice("Password reset link sent. Check your inbox.");
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      let msg = "Authentication failed. Please check your details.";
      const errorObj = err as { code?: string; message?: string };
      if (
        errorObj.code === "auth/user-not-found" ||
        errorObj.code === "auth/wrong-password" ||
        errorObj.code === "auth/invalid-credential"
      ) {
        msg = "Invalid email or password.";
      } else if (errorObj.code === "auth/email-already-in-use") {
        msg = "An account with this email already exists.";
      } else if (errorObj.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      } else if (errorObj.message) {
        msg = errorObj.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate({ to: "/", replace: true });
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
      setError(errorMsg);
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

      <main className="flex-1 w-full max-w-md mx-auto px-container-padding pt-8 pb-16 flex flex-col gap-stack-gap">
        <section className="flex flex-col gap-unit text-center">
          <h2 className="font-display text-display text-primary">
            {mode === "signin" && "Welcome back."}
            {mode === "signup" && "Create your account."}
            {mode === "forgot" && "Reset your password."}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {mode === "forgot"
              ? "We'll email you a secure link to set a new password."
              : "Make every introduction count."}
          </p>
        </section>

        {mode !== "forgot" && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full h-12 rounded-[16px] border border-primary-container text-primary font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-surface-container transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-surface-variant" />
              <span className="font-caption text-caption text-outline">or</span>
              <div className="h-px flex-1 bg-surface-variant" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-gutter">
          {mode === "signup" && (
            <input
              className={inputClass}
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className={inputClass}
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {mode !== "forgot" && (
            <input
              className={inputClass}
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          )}

          {error && <p className="font-caption text-caption text-error">{error}</p>}
          {notice && <p className="font-caption text-caption text-primary">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary-container text-white rounded-[16px] font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-60"
          >
            {mode === "signin" && (loading ? "Signing in\u2026" : "Sign in")}
            {mode === "signup" && (loading ? "Creating account\u2026" : "Create account")}
            {mode === "forgot" && (loading ? "Sending\u2026" : "Send reset link")}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2">
          {mode === "signin" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setNotice(null);
                }}
                className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setNotice(null);
                }}
                className="font-label-md text-label-md text-primary hover:opacity-80 transition-opacity"
              >
                New here? Create an account
              </button>
            </>
          )}
          {mode !== "signin" && (
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              className="font-label-md text-label-md text-primary hover:opacity-80 transition-opacity"
            >
              Back to sign in
            </button>
          )}
          <Link
            to="/onboarding"
            className="font-caption text-caption text-outline hover:text-primary transition-colors"
          >
            Learn what ColdConnect does
          </Link>
        </div>

        <section className="flex flex-col items-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => setShowFilm((v) => !v)}
            className="group inline-flex items-center gap-2.5 text-primary hover:opacity-80 transition-opacity"
            aria-expanded={showFilm}
          >
            <span className="w-9 h-9 rounded-full bg-primary-container/10 border border-primary-container/30 flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
              ▶
            </span>
            <span className="font-label-md text-label-md font-bold">
              {showFilm ? "Hide the launch film" : "Watch the 34-second launch film"}
            </span>
          </button>
          {showFilm && (
            <video
              className="w-full aspect-video rounded-[20px] border border-surface-variant bg-surface-container-lowest shadow-sm"
              src="/launch-video.mp4"
              poster="/launch-poster.png"
              controls
              preload="none"
              playsInline
            />
          )}
        </section>
      </main>
    </div>
  );
}
