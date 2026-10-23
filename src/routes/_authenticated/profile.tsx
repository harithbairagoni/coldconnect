import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — ColdConnect" },
      {
        name: "description",
        content: "Your ColdConnect profile: story, experience, skills and networking preferences.",
      },
      { property: "og:title", content: "My Profile — ColdConnect" },
      {
        property: "og:description",
        content: "Your ColdConnect profile: story, experience, skills and networking preferences.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/");
  const { user, profile, logout, profileLoading } = useAuth();

  async function handleSignOut() {
    try {
      await logout();
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      console.error("Sign out failed:", e);
    }
  }

  const displayName =
    profile?.fullName || user?.displayName || user?.email?.split("@")[0] || "Your Profile";
  const displayHeadline = profile?.headline || "Add your headline";
  const displayLocation = profile?.location || "Location not set";
  const completeness = profile?.completenessScore ?? 25;
  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  return (
    <div className="antialiased min-h-screen flex flex-col pb-[90px] bg-background text-on-surface">
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

      <main className="flex-grow pt-24 px-container-padding max-w-3xl mx-auto w-full">
        <section className="mb-section-gap">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-2">
            My Profile
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            This is the story ColdConnect uses to introduce you.
          </p>
        </section>

        <section className="bg-surface-container-lowest rounded-[16px] shadow-soft p-5 mb-section-gap border border-surface-container-high">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-surface-variant bg-surface-container">
              <img className="w-full h-full object-cover" alt={displayName} src={avatarUrl} />
            </div>
            <div className="flex-grow">
              <h2 className="font-headline-md text-headline-md text-on-surface">{displayName}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                {displayHeadline}
              </p>
              <div className="flex items-center gap-1 mt-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                <span className="font-caption text-caption">{displayLocation}</span>
              </div>
            </div>
            <Link
              to="/build-profile"
              className="text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-container"
            >
              <span className="material-symbols-outlined">edit</span>
            </Link>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-[16px] p-6 mb-section-gap border border-surface-container-highest">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-label-md text-label-md text-on-surface">Profile Completeness</h3>
            <span className="font-headline-md text-headline-md text-primary">{completeness}%</span>
          </div>

          <div className="w-full h-[4px] bg-primary/10 rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${completeness}%` }}
            ></div>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Complete your profile to get better pitch recommendations.
          </p>
          <div className="flex flex-col gap-stack-gap">
            <Link
              to="/build-profile"
              className="w-full bg-primary-container text-on-primary h-12 rounded-[16px] font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Complete Profile
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
            <Link
              to="/import-linkedin"
              className="w-full bg-transparent border border-primary-container text-primary-container h-12 rounded-[16px] font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-surface-container transition-all"
            >
              Import from LinkedIn
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
        </section>

        {profile?.about && (
          <section className="bg-surface-container-lowest rounded-[16px] p-6 mb-section-gap border border-surface-container-high">
            <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-2">
              About
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {profile.about}
            </p>
          </section>
        )}

        {profile?.experience && profile.experience.length > 0 && (
          <section className="bg-surface-container-lowest rounded-[16px] p-6 mb-section-gap border border-surface-container-high">
            <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-4">
              Experience
            </h3>
            <div className="space-y-4">
              {profile.experience.map((exp, i) => (
                <div
                  key={i}
                  className="flex flex-col border-b border-surface-container pb-3 last:border-b-0 last:pb-0"
                >
                  <h4 className="font-body-md text-body-md font-semibold text-on-surface">
                    {exp.title}
                  </h4>
                  <p className="font-body-md text-body-md text-primary-container">
                    {exp.company} {exp.period ? `• ${exp.period}` : ""}
                  </p>
                  {exp.description && (
                    <p className="font-caption text-caption text-on-surface-variant mt-1">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {profile?.skills && profile.skills.length > 0 && (
          <section className="bg-surface-container-lowest rounded-[16px] p-6 mb-section-gap border border-surface-container-high">
            <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-3">
              Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-surface-container-high rounded-full font-caption text-caption text-on-surface"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mb-section-gap">
          <button
            onClick={handleSignOut}
            className="w-full h-12 bg-transparent border border-surface-variant text-on-surface-variant rounded-[16px] font-label-md text-label-md flex items-center justify-center gap-2 hover:text-primary hover:border-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe bg-surface/80 dark:bg-surface/80 backdrop-blur-xl">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-90 duration-200 min-w-[64px] h-14"
        >
          <span className="material-symbols-outlined text-[24px] mb-1">home</span>
          <span className="font-caption text-[10px] font-medium leading-none">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-90 duration-200 min-w-[64px] h-14"
        >
          <span className="material-symbols-outlined text-[24px] mb-1">hub</span>
          <span className="font-caption text-[10px] font-medium leading-none">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-90 duration-200 min-w-[64px] h-14"
        >
          <span className="material-symbols-outlined text-[24px] mb-1">calendar_today</span>
          <span className="font-caption text-[10px] font-medium leading-none">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-primary after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 min-w-[64px] h-14 active:scale-90 duration-200"
        >
          <span
            className="material-symbols-outlined text-[24px] fill mb-1"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            person
          </span>
          <span className="font-caption text-[10px] font-semibold leading-none">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
