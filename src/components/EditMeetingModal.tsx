import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserMeeting, deleteUserMeeting } from "@/services/dataServices";
import { Meeting } from "@/types/models";

interface EditMeetingModalProps {
  isOpen: boolean;
  meeting: Meeting | null;
  onClose: () => void;
  onUpdated: () => void;
  onCancelled: () => void;
}

export function EditMeetingModal({
  isOpen,
  meeting,
  onClose,
  onUpdated,
  onCancelled,
}: EditMeetingModalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Meeting["status"]>("upcoming");

  useEffect(() => {
    if (!meeting || !isOpen) return;
    setTitle(meeting.title || "");
    setLocation(meeting.location || "");
    setPurpose(meeting.purpose || "");
    setNotes(meeting.notes || "");
    setStatus(meeting.status || "upcoming");

    if (meeting.scheduledAt) {
      try {
        const d = new Date(meeting.scheduledAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setDate(`${yyyy}-${mm}-${dd}`);

        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        setTime(`${hh}:${min}`);
      } catch {
        setDate("");
        setTime("12:00");
      }
    }
  }, [meeting, isOpen]);

  if (!isOpen || !meeting) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !meeting?.id) return;
    if (!date) {
      setError("Please choose a date.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let scheduledAtIso: string;
      try {
        const timePart = time || "12:00";
        const dateObj = new Date(`${date}T${timePart}:00`);
        scheduledAtIso = dateObj.toISOString();
      } catch {
        scheduledAtIso = new Date(date).toISOString();
      }

      await updateUserMeeting(user.uid, meeting.id, {
        title: title.trim() || meeting.title,
        scheduledAt: scheduledAtIso,
        location: location.trim(),
        purpose: purpose.trim(),
        notes: notes.trim(),
        status,
      });

      onUpdated();
      onClose();
    } catch (err: unknown) {
      console.error("Error updating meeting:", err);
      const msg = err instanceof Error ? err.message : "Failed to update meeting.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelMeeting() {
    if (!user?.uid || !meeting?.id) return;
    if (
      !window.confirm(
        "Are you sure you want to cancel this meeting? It will be removed from your active upcoming schedule.",
      )
    ) {
      return;
    }

    try {
      setCancelling(true);
      setError(null);
      await updateUserMeeting(user.uid, meeting.id, {
        status: "cancelled",
      });
      onCancelled();
      onClose();
    } catch (err: unknown) {
      console.error("Error cancelling meeting:", err);
      const msg = err instanceof Error ? err.message : "Failed to cancel meeting.";
      setError(msg);
    } finally {
      setCancelling(false);
    }
  }

  async function handleDeleteMeeting() {
    if (!user?.uid || !meeting?.id) return;
    if (!window.confirm("Delete this meeting permanently?")) {
      return;
    }

    try {
      setSaving(true);
      await deleteUserMeeting(user.uid, meeting.id);
      onCancelled();
      onClose();
    } catch (err: unknown) {
      console.error("Error deleting meeting:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete meeting.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      id="edit-meeting-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="edit-meeting-modal-card"
        className="bg-surface text-on-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-surface-variant/40 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-surface-variant/30">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container">
              <span className="material-symbols-outlined text-[20px]">edit_calendar</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-primary font-bold">
                Edit Meeting
              </h2>
              <p className="font-caption text-caption text-on-surface-variant">
                Update date, time, location or purpose
              </p>
            </div>
          </div>
          <button
            id="close-edit-meeting-btn"
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

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">
              Meeting Title
            </label>
            <input
              id="edit-meeting-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">
                Date <span className="text-error">*</span>
              </label>
              <input
                id="edit-meeting-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">Time</label>
              <input
                id="edit-meeting-time-input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Location & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">
                Location / Channel
              </label>
              <input
                id="edit-meeting-location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Coffee chat, Zoom"
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">
                Purpose
              </label>
              <input
                id="edit-meeting-purpose-input"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Career advice, Partnership"
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">
              Notes & Talking Points
            </label>
            <textarea
              id="edit-meeting-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preparation and meeting notes..."
              className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">Status</label>
            <select
              id="edit-meeting-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Meeting["status"])}
              className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="upcoming">Upcoming</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-surface-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                id="cancel-meeting-action-btn"
                type="button"
                onClick={handleCancelMeeting}
                disabled={cancelling || status === "cancelled"}
                className="flex-1 sm:flex-initial px-4 py-2 text-error hover:bg-error/10 rounded-xl font-label-md text-caption transition-colors flex items-center justify-center gap-1 border border-error/30"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                <span>Cancel Meeting</span>
              </button>
              <button
                id="delete-meeting-action-btn"
                type="button"
                onClick={handleDeleteMeeting}
                className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-colors"
                title="Delete Permanently"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-label-md text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                Close
              </button>
              <button
                id="save-edit-meeting-btn"
                type="submit"
                disabled={saving}
                className="px-6 py-2 rounded-xl font-label-md text-white bg-primary-container hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
