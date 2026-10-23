import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { completeMeetingAndRecordInteraction } from "@/services/dataServices";
import { Meeting } from "@/types/models";
import { useNavigate } from "@tanstack/react-router";

interface PostMeetingModalProps {
  isOpen: boolean;
  meeting: Meeting | null;
  onClose: () => void;
  onCompleted: () => void;
  onScheduleFollowup?: (connectionId: string) => void;
}

const RATING_OPTIONS = [
  {
    id: "great",
    label: "Great",
    icon: "sentiment_very_satisfied",
    color: "text-emerald-600 bg-emerald-50 border-emerald-300",
  },
  {
    id: "good",
    label: "Good",
    icon: "sentiment_satisfied",
    color: "text-primary bg-primary/10 border-primary/30",
  },
  {
    id: "okay",
    label: "Okay",
    icon: "sentiment_neutral",
    color: "text-amber-600 bg-amber-50 border-amber-300",
  },
  {
    id: "not_great",
    label: "Not great",
    icon: "sentiment_dissatisfied",
    color: "text-rose-600 bg-rose-50 border-rose-300",
  },
];

export function PostMeetingModal({
  isOpen,
  meeting,
  onClose,
  onCompleted,
  onScheduleFollowup,
}: PostMeetingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rating, setRating] = useState<string>("great");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !meeting) return null;

  const contactName = meeting.connectionName || "your contact";

  async function handleSaveAndComplete() {
    if (!user?.uid || !meeting?.id) return;
    try {
      setSaving(true);
      setError(null);

      await completeMeetingAndRecordInteraction(user.uid, meeting.id, {
        connectionId: meeting.connectionId,
        scheduledAt: meeting.scheduledAt,
        location: meeting.location,
        notes: notes.trim(),
        rating,
      });

      setIsDone(true);
      onCompleted();
    } catch (err: unknown) {
      console.error("Error marking meeting completed:", err);
      const msg = err instanceof Error ? err.message : "Failed to save meeting completion.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      id="post-meeting-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="post-meeting-modal-card"
        className="bg-surface text-on-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-surface-variant/40 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {!isDone ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-surface-variant/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[24px]">task_alt</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-primary font-bold">
                    Meeting Completed
                  </h2>
                  <p className="font-caption text-caption text-on-surface-variant">
                    {meeting.title} · with {contactName}
                  </p>
                </div>
              </div>
              <button
                id="close-post-meeting-btn"
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-caption flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Content Form */}
            <div className="mt-6 space-y-5">
              <div>
                <label className="block font-headline-md text-headline-md text-on-surface mb-2">
                  How did it go?
                </label>
                <p className="font-caption text-caption text-on-surface-variant mb-3">
                  Rate your conversation with {contactName} to track relationship momentum.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {RATING_OPTIONS.map((opt) => {
                    const isSelected = rating === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRating(opt.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 ${
                          isSelected
                            ? "border-primary-container bg-primary-container/10 text-primary font-bold shadow-sm"
                            : "border-surface-variant/50 bg-surface-container-lowest text-on-surface-variant hover:border-primary-container/40"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[28px] mb-1">
                          {opt.icon}
                        </span>
                        <span className="font-label-md text-caption">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes input */}
              <div>
                <label className="block font-label-md text-label-md text-on-surface mb-1">
                  Key Takeaways & Follow-up Commitments
                </label>
                <textarea
                  id="post-meeting-notes-input"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What topics resonated most? Any promises made, articles to share, or specific date to follow up?"
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-surface-variant/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-label-md text-on-surface-variant hover:bg-surface-variant transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  id="save-post-meeting-btn"
                  type="button"
                  onClick={handleSaveAndComplete}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl font-label-md text-white bg-primary-container hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Save & Complete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Post-Completion Next Steps Screen */
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce-short">
              <span className="material-symbols-outlined text-[36px]">celebration</span>
            </div>

            <div>
              <h3 className="font-headline-lg text-headline-lg text-primary font-bold">
                Great job!
              </h3>
              <p className="font-body-md text-on-surface-variant mt-1 max-w-sm mx-auto">
                Meeting marked completed. <strong>{contactName}</strong> is now marked as{" "}
                <span className="text-primary font-semibold">"Met"</span> in your Network.
              </p>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl text-left border border-surface-variant/40">
              <div className="flex items-center gap-2 text-primary mb-2">
                <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                <span className="font-label-md text-label-md font-semibold">
                  Recommended Next Action
                </span>
              </div>
              <p className="font-body-md text-caption text-on-surface-variant">
                Send a quick thank-you note within 24 hours while key discussion points are fresh.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              {onScheduleFollowup && (
                <button
                  id="post-meeting-schedule-followup-btn"
                  onClick={() => {
                    onClose();
                    onScheduleFollowup(meeting.connectionId);
                  }}
                  className="w-full bg-primary-container text-white py-3 rounded-xl font-label-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
                  <span>Schedule Follow-up Message</span>
                </button>
              )}

              <button
                id="post-meeting-view-conn-btn"
                onClick={() => {
                  onClose();
                  navigate({
                    to: "/connection-profile",
                    search: { id: meeting.connectionId },
                  });
                }}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 text-primary py-3 rounded-xl font-label-md flex items-center justify-center gap-2 hover:bg-surface-variant/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
                <span>View Connection Profile</span>
              </button>

              <button
                id="post-meeting-return-network-btn"
                onClick={() => {
                  onClose();
                  navigate({ to: "/person" });
                }}
                className="w-full text-on-surface-variant hover:text-primary py-2.5 rounded-xl font-label-md transition-colors"
              >
                Return to Network
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
