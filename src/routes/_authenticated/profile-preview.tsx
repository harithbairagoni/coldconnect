import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/profile-preview")({
  head: () => ({
    meta: [
      { title: "Profile Preview — ColdConnect" },
      {
        name: "description",
        content: "See how your ColdConnect profile looks before you save it.",
      },
      { property: "og:title", content: "Profile Preview — ColdConnect" },
      {
        property: "og:description",
        content: "See how your ColdConnect profile looks before you save it.",
      },
    ],
  }),
  component: ProfilePreviewPage,
});

function ProfilePreviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const goBack = useAppBack("/profile");

  const fullName =
    profile?.fullName || user?.displayName || user?.email?.split("@")[0] || "Your Profile";
  const headline = profile?.headline || "Add your headline in Profile settings";
  const location = profile?.location || "Location not set";
  const photoURL =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
  const about =
    profile?.about || "Add a short bio to introduce your story and background to your network.";

  const experiences = profile?.experience || [];
  const educationList = profile?.education || [];
  const interestsList = profile?.interests || [];
  const themesList = profile?.skills || [];

  return (
    <div className="bg-background text-on-background min-h-screen pt-20 pb-32 md:pb-20 font-body-md">
      <header className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-surface/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="text-primary hover:opacity-80 transition-opacity active:scale-95 duration-200 p-2 -ml-2"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="font-display text-headline-md font-bold text-primary">ColdConnect</h1>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant">
            <img alt="User profile photo" className="w-full h-full object-cover" src={photoURL} />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-container-padding w-full">
        <section className="mb-section-gap text-center md:text-left mt-8">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">
            Your ColdConnect Profile
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Preview how others see you in the network.
          </p>
        </section>

        <div className="glass-panel rounded-xl p-6 md:p-8 mb-section-gap flex flex-col md:flex-row items-center md:items-start gap-6 border border-surface-container-high transition-transform duration-300 hover:scale-[0.99]">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shrink-0 shadow-lg ring-4 ring-white">
            <img alt={fullName} className="w-full h-full object-cover" src={photoURL} />
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="font-headline-lg text-headline-lg text-on-surface mb-1">{fullName}</h3>
            <p className="font-body-lg text-body-lg text-primary-container mb-3 font-semibold">
              {headline}
            </p>
            <div className="flex items-center justify-center md:justify-start gap-2 text-on-surface-variant mb-6 font-label-md text-label-md">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span>{location}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
              <button
                onClick={() => navigate({ to: "/profile" })}
                className="block text-center bg-primary-container text-white font-label-md text-label-md py-3 px-6 rounded-[16px] hover:opacity-90 transition-opacity w-full sm:w-auto shadow-md"
              >
                Save Profile
              </button>
              <button
                onClick={() => navigate({ to: "/build-profile" })}
                className="bg-transparent border border-primary-container text-primary-container font-label-md text-label-md py-3 px-6 rounded-[16px] hover:bg-surface-container-low transition-colors w-full sm:w-auto"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-section-gap">
            <section className="bg-surface-container-lowest rounded-xl p-6 soft-shadow border border-surface-container-high">
              <h4 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container">article</span> My
                Story
              </h4>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {about}
              </p>
            </section>

            {experiences.length > 0 && (
              <section className="bg-surface-container-lowest rounded-xl p-6 soft-shadow border border-surface-container-high">
                <h4 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container">work</span>{" "}
                  Experience
                </h4>
                <div className="relative border-l-2 border-surface-container-high ml-3 space-y-8">
                  {experiences.map((exp, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div
                        className={`absolute w-3 h-3 ${idx === 0 ? "bg-primary-container" : "bg-surface-container-high"} rounded-full -left-[7px] top-1.5 ring-4 ring-white`}
                      ></div>
                      <h5 className="font-label-md text-label-md text-on-surface text-lg">
                        {exp.title}
                      </h5>
                      <p className="font-body-md text-body-md text-primary-container font-semibold">
                        {exp.company}
                      </p>
                      {exp.period && (
                        <p className="font-caption text-caption text-outline mb-2">{exp.period}</p>
                      )}
                      {exp.description && (
                        <p className="font-body-md text-body-md text-on-surface-variant">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-section-gap">
            {themesList.length > 0 && (
              <section className="bg-surface-container-lowest rounded-xl p-6 soft-shadow border border-surface-container-high relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <span className="material-symbols-outlined text-[64px]">auto_awesome</span>
                </div>
                <h4 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2 relative z-10">
                  <span className="material-symbols-outlined text-secondary-container">
                    psychology
                  </span>{" "}
                  Skills & Themes
                </h4>
                <div className="flex flex-wrap gap-2 relative z-10">
                  {themesList.map((theme, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-secondary-container/20 text-on-secondary-container font-label-md text-label-md text-xs border border-secondary-container/30"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {interestsList.length > 0 && (
              <section className="bg-surface-container-lowest rounded-xl p-6 soft-shadow border border-surface-container-high">
                <h4 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container">favorite</span>{" "}
                  Interests
                </h4>
                <div className="flex flex-wrap gap-2">
                  {interestsList.map((interest, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface font-label-md text-label-md text-xs border border-surface-container-high"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {educationList.length > 0 && (
              <section className="bg-surface-container-lowest rounded-xl p-6 soft-shadow border border-surface-container-high">
                <h4 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container">school</span>{" "}
                  Education
                </h4>
                <div className="space-y-4">
                  {educationList.map((edu, idx) => (
                    <div
                      key={idx}
                      className="bg-surface rounded-lg p-3 border border-surface-container"
                    >
                      <h5 className="font-label-md text-label-md text-on-surface">{edu.degree}</h5>
                      <p className="font-body-md text-body-md text-primary-container text-sm">
                        {edu.school}
                      </p>
                      {edu.year && (
                        <p className="font-caption text-caption text-outline">{edu.year}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe bg-surface/80 dark:bg-surface/80 backdrop-blur-xl md:hidden border-t-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mb-1" data-icon="home">
            home
          </span>
          <span className="font-label-md text-[10px]">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mb-1" data-icon="hub">
            hub
          </span>
          <span className="font-label-md text-[10px]">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors"
        >
          <span className="material-symbols-outlined mb-1" data-icon="calendar_today">
            calendar_today
          </span>
          <span className="font-label-md text-[10px]">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 hover:text-primary transition-colors"
        >
          <span
            className="material-symbols-outlined mb-1"
            data-icon="person"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            person
          </span>
          <span className="font-label-md text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
