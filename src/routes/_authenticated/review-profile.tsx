import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppBack } from "@/hooks/useAppBack";

export const Route = createFileRoute("/_authenticated/review-profile")({
  head: () => ({
    meta: [
      { title: "Review Imported Profile — ColdConnect" },
      {
        name: "description",
        content: "Check and edit the details we imported before saving your ColdConnect profile.",
      },
      { property: "og:title", content: "Review Imported Profile — ColdConnect" },
      {
        property: "og:description",
        content: "Check and edit the details we imported before saving your ColdConnect profile.",
      },
    ],
  }),
  component: ReviewProfilePage,
});

function ReviewProfilePage() {
  const navigate = useNavigate();
  const goBack = useAppBack("/build-profile");
  const { user, profile, updateProfile } = useAuth();

  const [about, setAbout] = useState(profile?.about || "");
  const [experience, setExperience] = useState(profile?.experience || []);
  const [education, setEducation] = useState(profile?.education || []);
  const [skills, setSkills] = useState(profile?.skills || []);
  const [whatImLookingFor, setWhatImLookingFor] = useState(
    profile?.whatImLookingFor?.join(", ") || "",
  );
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.about !== undefined) setAbout(profile.about);
      if (profile.experience) setExperience(profile.experience);
      if (profile.education) setEducation(profile.education);
      if (profile.skills) setSkills(profile.skills);
      if (profile.whatImLookingFor) setWhatImLookingFor(profile.whatImLookingFor.join(", "));
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        about,
        experience,
        education,
        skills,
        whatImLookingFor: whatImLookingFor
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      navigate({ to: "/profile-preview" });
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleAddExperience = () => {
    setExperience([
      ...experience,
      { title: "New Role", company: "Company Name", period: "2024 - Present" },
    ]);
  };

  const handleRemoveExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  const handleExperienceChange = (
    index: number,
    field: "title" | "company" | "period",
    val: string,
  ) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: val };
    setExperience(updated);
  };

  const avatarUrl =
    profile?.photoURL ||
    user?.photoURL ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col pt-16 pb-24 md:pb-0">
      <header className="hidden md:flex bg-surface/80 dark:bg-surface/80 backdrop-blur-xl fixed top-0 w-full z-50 items-center justify-between px-container-padding h-16 max-w-7xl mx-auto left-0 right-0">
        <div className="flex items-center gap-4">
          <button
            onClick={goBack}
            aria-label="Go back"
            className="text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-display text-headline-md font-bold text-primary dark:text-primary-fixed">
            ColdConnect
          </h1>
        </div>
        <nav className="hidden md:flex gap-8 items-center">
          <Link
            to="/"
            className="text-on-surface-variant hover:opacity-80 transition-opacity font-label-md text-label-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">home</span> Home
          </Link>
          <Link
            to="/person"
            className="text-on-surface-variant hover:opacity-80 transition-opacity font-label-md text-label-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">hub</span> Network
          </Link>
          <Link
            to="/pitch-prep"
            className="text-on-surface-variant hover:opacity-80 transition-opacity font-label-md text-label-md flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">calendar_today</span> Upcoming
          </Link>
          <Link
            to="/profile"
            className="text-primary hover:opacity-80 transition-opacity font-label-md text-label-md flex items-center gap-2 relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full"
          >
            <span className="material-symbols-outlined text-xl">person</span> Profile
          </Link>
        </nav>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
            <img alt="User Profile" className="w-full h-full object-cover" src={avatarUrl} />
          </div>
        </div>
      </header>

      <header className="md:hidden bg-surface/80 dark:bg-surface/80 backdrop-blur-xl fixed top-0 w-full z-50 flex items-center justify-between px-container-padding h-16 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <button onClick={goBack} aria-label="Go back" className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-headline-md font-bold text-primary">ColdConnect</h1>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/30">
          <img alt="User Profile" className="w-full h-full object-cover" src={avatarUrl} />
        </div>
      </header>

      <main className="flex-grow w-full max-w-3xl mx-auto px-container-padding py-section-gap flex flex-col gap-section-gap mt-8 md:mt-16">
        <section className="flex flex-col gap-unit">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Here’s what we found.
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
            Review and edit before ColdConnect uses this information to personalize your networking
            strategy.
          </p>
        </section>

        <section className="flex flex-col gap-stack-gap">
          <div className="bg-surface-container-lowest rounded-xl p-[20px] shadow-[0_4px_20px_rgba(0,53,39,0.05)] border border-surface-container-high relative group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                ABOUT YOU
              </h3>
            </div>
            <div className="relative">
              <textarea
                className="w-full bg-surface-container-low border border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary p-3 rounded-lg font-body-md text-body-md text-on-surface resize-none h-28"
                placeholder="Brief bio..."
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-[20px] shadow-[0_4px_20px_rgba(0,53,39,0.05)] border border-surface-container-high relative group">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                EXPERIENCE
              </h3>
              <button
                onClick={handleAddExperience}
                aria-label="Add Experience"
                className="text-outline hover:text-primary transition-colors p-1 flex items-center gap-1 font-label-md text-xs"
              >
                <span className="material-symbols-outlined text-lg">add</span> Add
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {experience.map((exp, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 items-start group/item border-b border-surface-container pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant">work</span>
                  </div>
                  <div className="flex-grow flex flex-col gap-1">
                    <input
                      className="bg-surface-container-low border border-surface-variant focus:border-primary px-3 py-1.5 rounded font-body-md text-body-md font-semibold text-on-surface"
                      type="text"
                      value={exp.title}
                      placeholder="Title / Role"
                      onChange={(e) => handleExperienceChange(idx, "title", e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        className="bg-surface-container-low border border-surface-variant focus:border-primary px-3 py-1 rounded font-caption text-caption text-on-surface flex-1"
                        type="text"
                        value={exp.company}
                        placeholder="Company"
                        onChange={(e) => handleExperienceChange(idx, "company", e.target.value)}
                      />
                      <input
                        className="bg-surface-container-low border border-surface-variant focus:border-primary px-3 py-1 rounded font-caption text-caption text-on-surface-variant w-32"
                        type="text"
                        value={exp.period || ""}
                        placeholder="e.g. 2023-Present"
                        onChange={(e) => handleExperienceChange(idx, "period", e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveExperience(idx)}
                    className="text-outline hover:text-error transition-opacity p-1"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-gap">
            <div className="bg-surface-container-lowest rounded-xl p-[20px] shadow-[0_4px_20px_rgba(0,53,39,0.05)] border border-surface-container-high relative">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  EDUCATION
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {education.map((edu, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">
                        school
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 flex-grow">
                      <input
                        className="bg-surface-container-low border border-surface-variant focus:border-primary px-2 py-1 rounded font-body-md text-body-md font-semibold text-on-surface"
                        type="text"
                        value={edu.school}
                        onChange={(e) => {
                          const updated = [...education];
                          updated[idx].school = e.target.value;
                          setEducation(updated);
                        }}
                      />
                      <input
                        className="bg-surface-container-low border border-surface-variant focus:border-primary px-2 py-0.5 rounded font-caption text-caption text-on-surface-variant"
                        type="text"
                        value={edu.degree}
                        onChange={(e) => {
                          const updated = [...education];
                          updated[idx].degree = e.target.value;
                          setEducation(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-[20px] shadow-[0_4px_20px_rgba(0,53,39,0.05)] border border-surface-container-high relative">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-label-md text-label-md text-on-surface-variant tracking-wider uppercase">
                  SKILLS
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-high text-on-surface rounded-full font-caption text-caption border border-outline-variant/50 hover:bg-surface-variant transition-colors"
                  >
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="material-symbols-outlined text-[14px] text-outline hover:text-error transition-colors"
                    >
                      close
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                  className="bg-surface-container-low border border-surface-variant focus:border-primary px-3 py-1.5 rounded-lg font-caption text-caption text-on-surface flex-grow"
                />
                <button
                  onClick={handleAddSkill}
                  type="button"
                  className="px-3 py-1.5 bg-primary-container text-on-primary rounded-lg font-caption text-caption hover:opacity-90"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-container text-on-primary rounded-xl px-6 py-3 font-label-md text-label-md flex items-center gap-2 hover:bg-primary transition-colors active:scale-95 duration-200 shadow-sm disabled:opacity-50"
          >
            {saving ? "Saving Profile..." : "Save Profile"}{" "}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
        </section>
      </main>

      <nav className="md:hidden bg-surface/80 dark:bg-surface/80 backdrop-blur-xl fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-container-padding py-unit pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors active:scale-90 duration-200 gap-1 p-2 w-16"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-md text-[10px] leading-tight text-center">Home</span>
        </Link>
        <Link
          to="/person"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors active:scale-90 duration-200 gap-1 p-2 w-16"
        >
          <span className="material-symbols-outlined">hub</span>
          <span className="font-label-md text-[10px] leading-tight text-center">Network</span>
        </Link>
        <Link
          to="/pitch-prep"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-primary transition-colors active:scale-90 duration-200 gap-1 p-2 w-16"
        >
          <span className="material-symbols-outlined">calendar_today</span>
          <span className="font-label-md text-[10px] leading-tight text-center">Upcoming</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center justify-center text-primary dark:text-primary-fixed after:content-[''] after:w-1 after:h-1 after:bg-primary after:rounded-full after:mt-1 hover:text-primary transition-colors active:scale-90 duration-200 gap-1 p-2 w-16"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-[10px] leading-tight text-center">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
