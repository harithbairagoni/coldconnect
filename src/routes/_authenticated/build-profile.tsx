import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/build-profile")({
  head: () => ({
    meta: [
      { title: "Build your profile manually — ColdConnect" },
      {
        name: "description",
        content: "Create your ColdConnect profile step by step in a few minutes.",
      },
      { property: "og:title", content: "Build your profile manually — ColdConnect" },
      {
        property: "og:description",
        content: "Create your ColdConnect profile step by step in a few minutes.",
      },
    ],
  }),
  component: BuildProfilePage,
});

function BuildProfilePage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/profile");
  const { user, profile, updateProfile } = useAuth();

  const [name, setName] = useState(profile?.fullName || user?.displayName || "");
  const [headline, setHeadline] = useState(
    profile?.headline || "MBA Student · Entrepreneur · Product Builder",
  );
  const [location, setLocation] = useState(profile?.location || "");
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || user?.photoURL || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.fullName) setName(profile.fullName);
      if (profile.headline) setHeadline(profile.headline);
      if (profile.location) setLocation(profile.location);
      if (profile.photoURL) setPhotoURL(profile.photoURL);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        fullName: name,
        headline,
        location,
        photoURL: photoURL || user?.photoURL || "",
      });
      navigate({ to: "/profile-preview" });
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = () => {
    const defaultAvatars = [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    ];
    const currentIndex = defaultAvatars.indexOf(photoURL);
    const nextAvatar = defaultAvatars[(currentIndex + 1) % defaultAvatars.length];
    setPhotoURL(nextAvatar);
  };

  return (
    <div className="bg-background text-on-background antialiased min-h-screen flex flex-col font-body-md pb-safe md:pb-0">
      <header className="bg-surface/80 dark:bg-surface/80 backdrop-blur-xl fixed top-0 w-full z-50">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <button
            onClick={goBack}
            aria-label="Back"
            className="text-on-surface-variant dark:text-outline-variant hover:opacity-80 transition-opacity active:scale-95 duration-200 p-2 -ml-2"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed flex-1 text-center">
            ColdConnect
          </div>
          <div className="w-8 h-8 rounded-full bg-surface-variant overflow-hidden border border-outline-variant">
            <img
              alt="User profile"
              className="w-full h-full object-cover"
              src={
                photoURL ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              }
            />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto pt-24 pb-24 md:pt-32 px-container-padding">
        <div className="mb-section-gap">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background mb-unit">
            Build your profile
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Let's start with the essentials to make a strong first impression.
          </p>
        </div>

        <div className="mb-section-gap">
          <div className="flex items-center justify-between mb-unit">
            <span className="font-label-md text-label-md text-primary">Step 1: Basics</span>
            <span className="font-caption text-caption text-outline">1/4</span>
          </div>
          <div className="w-full h-[2px] bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary w-1/4 rounded-full"></div>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="bg-surface-container-lowest rounded-xl subtle-shadow p-container-padding space-y-stack-gap md:space-y-section-gap scale-on-active transition-transform duration-200 border border-surface-container-high"
        >
          <div className="flex flex-col items-center mb-stack-gap">
            <div onClick={handlePhotoUpload} className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant overflow-hidden">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-outline text-3xl">
                    add_a_photo
                  </span>
                )}
              </div>
              <div className="absolute inset-0 bg-primary-container/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xl">edit</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePhotoUpload}
              className="font-label-md text-label-md text-primary mt-unit cursor-pointer hover:underline"
            >
              {photoURL ? "Change Profile Photo" : "Upload Profile Photo"}
            </button>
          </div>

          <div className="space-y-stack-gap">
            <div className="flex flex-col">
              <label
                className="font-label-md text-label-md text-on-surface-variant mb-unit"
                htmlFor="name"
              >
                Name
              </label>
              <input
                className="w-full bg-surface-container-low border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary px-4 py-3 rounded-lg font-body-md text-body-md text-on-surface"
                id="name"
                name="name"
                placeholder="e.g., Alex Chen"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col">
              <label
                className="font-label-md text-label-md text-on-surface-variant mb-unit"
                htmlFor="headline"
              >
                Headline
              </label>
              <input
                className="w-full bg-surface-container-low border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary px-4 py-3 rounded-lg font-body-md text-body-md text-on-surface"
                id="headline"
                name="headline"
                placeholder="e.g., MBA Student · Entrepreneur · Product Builder"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
              <span className="font-caption text-caption text-outline mt-1">
                This will be your primary identifier across the network.
              </span>
            </div>
            <div className="flex flex-col">
              <label
                className="font-label-md text-label-md text-on-surface-variant mb-unit"
                htmlFor="location"
              >
                Location
              </label>
              <div className="relative">
                <input
                  className="w-full bg-surface-container-low border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary px-4 py-3 rounded-lg font-body-md text-body-md text-on-surface pr-10"
                  id="location"
                  name="location"
                  placeholder="e.g., New York, NY"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                  location_on
                </span>
              </div>
            </div>
          </div>

          <div className="pt-stack-gap mt-section-gap flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-container text-on-primary h-12 px-6 rounded-[16px] font-label-md text-label-md hover:bg-primary-container/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Next"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </form>
      </main>

      <nav className="bg-surface/80 dark:bg-surface/80 backdrop-blur-xl fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe md:hidden">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200 p-2"
        >
          <span className="material-symbols-outlined mb-1 text-2xl">home</span>
          <span className="font-label-md text-label-md text-[10px]">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200 p-2"
        >
          <span className="material-symbols-outlined mb-1 text-2xl">hub</span>
          <span className="font-label-md text-label-md text-[10px]">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200 p-2"
        >
          <span className="material-symbols-outlined mb-1 text-2xl">calendar_today</span>
          <span className="font-label-md text-label-md text-[10px]">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 hover:text-primary dark:hover:text-primary-fixed transition-colors active:scale-90 duration-200 p-2"
        >
          <span
            className="material-symbols-outlined mb-1 text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            person
          </span>
          <span className="font-label-md text-label-md text-[10px]">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
