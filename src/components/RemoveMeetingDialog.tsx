import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface RemoveMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  personName: string;
  isRemoving: boolean;
}

export function RemoveMeetingDialog({
  isOpen,
  onClose,
  onConfirm,
  personName,
  isRemoving,
}: RemoveMeetingDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(val) => {
        if (!val && !isRemoving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove this meeting?</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this scheduled meeting with {personName}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={isRemoving}>
            Keep Meeting
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? "Removing..." : "Remove Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
