import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get Started \u2014 ColdConnect" },
      {
        name: "description",
        content:
          "Tell us about yourself. Import from LinkedIn or build your ColdConnect profile manually.",
      },
      { property: "og:title", content: "Get Started \u2014 ColdConnect" },
      {
        property: "og:description",
        content:
          "Tell us about yourself. Import from LinkedIn or build your ColdConnect profile manually.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <div className="font-body-md text-on-surface antialiased bg-background min-h-screen flex flex-col">
      <header className="hidden md:flex bg-surface/80 dark:bg-surface/80 backdrop-blur-xl fixed top-0 w-full z-50 items-center justify-between px-container-padding h-16 max-w-7xl mx-auto left-0 right-0">
        <div className="flex items-center gap-gutter">
          <span className="material-symbols-outlined text-primary dark:text-primary-fixed hover:opacity-80 transition-opacity cursor-pointer">
            menu
          </span>
          <span className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed">
            ColdConnect
          </span>
        </div>
        <nav className="flex items-center gap-container-padding">
          <Link
            to="/"
            className="font-label-md text-label-md text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors flex items-center gap-unit"
          >
            <span className="material-symbols-outlined">home</span>
            Home
          </Link>
          <Link
            to="/person"
            className="font-label-md text-label-md text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors flex items-center gap-unit"
          >
            <span className="material-symbols-outlined">hub</span>
            Network
          </Link>
          <Link
            to="/pitch-prep"
            className="font-label-md text-label-md text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors flex items-center gap-unit"
          >
            <span className="material-symbols-outlined">calendar_today</span>
            Upcoming
          </Link>
          <Link
            to="/profile"
            className="font-label-md text-label-md text-primary dark:text-primary-fixed flex items-center gap-unit relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
            Profile
          </Link>
        </nav>
        <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
          <img
            alt="User profile photo"
            className="w-full h-full object-cover"
            data-alt="A small circular user profile photo showing a professional looking person in a well lit environment."
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuANWLnOI9tLHZGchNbLJ6TEijqF7CuvjG--NhxL307qYtis8NlrCjobQ4LNn-Qf4wlHFZIzGn5DQ9SGWcSJ7Qlt3kTxCx9QmzP0F4mm0odF3tvXZOKrR0nW0ahkCewpvptiyDDl9kxag4F5DImZ1XoWxJgLbksYZNWWVB0ykaLM0DqjtTwThOSIl2UDe_O0_1QgYz6JmVL_NiUJpZR-xMeNeu9ETu-vnDy7nfSHy8BPXkoJ2sa4glPtgQ"
          />
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-container-padding pt-24 md:pt-32 pb-32 flex flex-col gap-section-gap">
        <section className="flex flex-col gap-unit">
          <h1 className="font-display text-display md:text-headline-lg-mobile text-primary">
            Tell us about yourself.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Add your details once. ColdConnect will use them across every conversation.
          </p>
        </section>

        <section className="flex flex-col gap-stack-gap md:grid md:grid-cols-2">
          <Link
            to="/import-linkedin"
            className="interactive-card text-left bg-surface-container-lowest rounded-xl p-[20px] card-shadow flex flex-col gap-stack-gap h-full border border-surface-container-lowest hover:border-surface-variant transition-colors group relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-inverse-primary/20 text-primary flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[24px]">work</span>
            </div>
            <div className="flex flex-col gap-unit flex-1">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Import from LinkedIn
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Bring in your professional background, experience, education and skills.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <div className="flex items-center text-primary font-label-md text-label-md group-hover:gap-2 transition-all">
                Import Profile{" "}
                <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </div>
              <p className="font-caption text-caption text-outline">
                Review everything before saving.
              </p>
            </div>

            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
          </Link>

          <Link
            to="/build-profile"
            className="interactive-card text-left bg-surface-container-lowest rounded-xl p-[20px] card-shadow flex flex-col gap-stack-gap h-full border border-surface-container-lowest hover:border-surface-variant transition-colors group relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[24px]">person</span>
            </div>
            <div className="flex flex-col gap-unit flex-1">
              <h3 className="font-headline-md text-headline-md text-on-surface">Build manually</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Create your ColdConnect profile in a few minutes.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-auto pt-6">
              <div className="flex items-center text-on-surface font-label-md text-label-md group-hover:gap-2 transition-all">
                Start from scratch{" "}
                <span className="material-symbols-outlined text-[18px] ml-1">arrow_forward</span>
              </div>
            </div>
          </Link>
        </section>

        <div className="mt-8 flex flex-col gap-2 items-center w-full max-w-xs mx-auto">
          <div className="w-full h-[2px] bg-primary/10 rounded-full overflow-hidden flex">
            <div className="h-full bg-primary w-1/4 rounded-full"></div>
          </div>
          <span className="font-caption text-caption text-outline">Step 1 of 4</span>
          <Link
            to="/auth"
            className="font-label-md text-label-md text-primary hover:opacity-80 transition-opacity mt-2"
          >
            Sign in or create an account
          </Link>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe bg-surface/80 dark:bg-surface/80 backdrop-blur-xl">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-md text-[10px] mt-1">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined">hub</span>
          <span className="font-label-md text-[10px] mt-1">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="font-label-md text-[10px] mt-1">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 active:scale-90 duration-200"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="font-label-md text-[10px] mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
