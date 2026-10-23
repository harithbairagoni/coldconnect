import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserConnections, createUserMeeting } from "@/services/dataServices";
import { Connection, Meeting } from "@/types/models";

interface AddMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meetingId: string) => void;
  initialConnectionId?: string;
}

export function AddMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  initialConnectionId,
}: AddMeetingModalProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    initialConnectionId || "",
  );
  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("19:30");
  const [location, setLocation] = useState<string>("Coffee chat");
  const [purpose, setPurpose] = useState<string>("Career advice");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    let isMounted = true;
    async function loadConnections() {
      if (!user?.uid) return;
      try {
        if (isMounted) setLoadingConnections(true);
        const list = await fetchUserConnections(user.uid);
        if (!isMounted) return;
        setConnections(list);
        if (initialConnectionId) {
          setSelectedConnectionId(initialConnectionId);
        } else if (list.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(list[0].id || "");
        }
      } catch (err) {
        console.error("Error loading connections for modal:", err);
      } finally {
        if (isMounted) {
          setLoadingConnections(false);
        }
      }
    }
    loadConnections();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.uid, initialConnectionId]);

  // Set default date to tomorrow
  useEffect(() => {
    if (isOpen && !date) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const dd = String(tomorrow.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [isOpen, date]);

  // Update title automatically when connection or purpose changes if title is empty or default
  useEffect(() => {
    const selected = connections.find((c) => c.id === selectedConnectionId);
    if (
      selected &&
      (!title || title.startsWith("Meeting with ") || title.startsWith("Chat with "))
    ) {
      setTitle(`${purpose || "Meeting"} with ${selected.name}`);
    }
  }, [selectedConnectionId, purpose, connections]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid) return;
    if (!selectedConnectionId) {
      setError("Please select a connection.");
      return;
    }
    if (!date) {
      setError("Please choose a date.");
      return;
    }

    const selected = connections.find((c) => c.id === selectedConnectionId);
    if (!selected) {
      setError("Selected connection not found.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Combine date and time into an ISO timestamp
      let scheduledAtIso: string;
      try {
        const timePart = time || "12:00";
        const dateObj = new Date(`${date}T${timePart}:00`);
        scheduledAtIso = dateObj.toISOString();
      } catch {
        scheduledAtIso = new Date(`${date}`).toISOString();
      }

      const meetingData: Omit<Meeting, "id"> = {
        connectionId: selected.id || selectedConnectionId,
        connectionName: selected.name,
        connectionRole: selected.role,
        connectionCompany: selected.company,
        connectionImage: selected.profileImage,
        title: title.trim() || `Meeting with ${selected.name}`,
        scheduledAt: scheduledAtIso,
        location: location.trim() || "Coffee chat",
        purpose: purpose.trim() || "Career advice",
        notes: notes.trim(),
        status: "upcoming",
        preparationScore: 25,
        preparationItems: {
          personResearched: true,
          questionsPrepared: false,
          pitchPracticed: false,
          conversationPlanPrepared: false,
        },
      };

      const meetingId = await createUserMeeting(user.uid, meetingData);
      onSuccess(meetingId);
      onClose();
    } catch (err: unknown) {
      console.error("Error creating meeting:", err);
      const msg = err instanceof Error ? err.message : "Failed to schedule meeting.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      id="add-meeting-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="add-meeting-modal-card"
        className="bg-surface text-on-surface w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-surface-variant/40 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-surface-variant/30">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary-container/10 flex items-center justify-center text-primary-container">
              <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-primary font-bold">
                Schedule Meeting
              </h2>
              <p className="font-caption text-caption text-on-surface-variant">
                Set date, purpose and plan your connection
              </p>
            </div>
          </div>
          <button
            id="close-add-meeting-btn"
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Connection Selector */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">
              Select Connection <span className="text-error">*</span>
            </label>
            {loadingConnections ? (
              <div className="h-11 bg-surface-container rounded-xl animate-pulse flex items-center px-4 text-caption text-on-surface-variant">
                Loading your connections...
              </div>
            ) : connections.length === 0 ? (
              <div className="p-3 bg-surface-container rounded-xl text-caption text-on-surface-variant flex items-center justify-between">
                <span>No connections found in your network.</span>
                <a href="/add-person" className="text-primary font-semibold underline">
                  Add Connection First
                </a>
              </div>
            ) : (
              <select
                id="meeting-connection-select"
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="" disabled>
                  Choose a person from your network
                </option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.role || "Role"} at ${c.company})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1">
              Meeting Title
            </label>
            <input
              id="meeting-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Coffee chat with Rahul"
              className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">
                Date <span className="text-error">*</span>
              </label>
              <input
                id="meeting-date-input"
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
                id="meeting-time-input"
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
                Location / Format
              </label>
              <input
                id="meeting-location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Coffee chat, Zoom, Blue Bottle"
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1">
                Purpose
              </label>
              <input
                id="meeting-purpose-input"
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
              Preparation & Objective Notes
            </label>
            <textarea
              id="meeting-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What is your main goal for this meeting? Key topics to explore..."
              className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-variant/30">
            <button
              id="cancel-add-meeting-btn"
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-label-md text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-meeting-btn"
              type="submit"
              disabled={saving || connections.length === 0}
              className="px-6 py-2.5 rounded-xl font-label-md text-white bg-primary-container hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Schedule Meeting</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
