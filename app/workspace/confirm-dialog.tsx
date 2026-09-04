"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmDialogProps = {
  /** Controls visibility of the modal. */
  open: boolean;
  /** Modal title. */
  title: string;
  /** Body copy explaining what the user is about to confirm. */
  message: string;
  /** Fired when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Fired when the user clicks cancel or dismisses the modal. */
  onCancel: () => void;
  /** Optional override for the confirm button label. */
  confirmLabel?: string;
  /** Optional override for the cancel button label. */
  cancelLabel?: string;
  /** When `true`, the confirm button uses the destructive variant. */
  destructive?: boolean;
  /** Optional test id for snapshot/axe targeting. */
  testId?: string;
};

/**
 * Reusable confirmation modal built on the shadcn `Dialog` primitive.
 * Renders a title, message and a two-button footer (cancel + confirm).
 * The dialog is fully controlled — the parent owns the `open` flag and
 * decides what happens on confirm / cancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  testId,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent data-testid={testId} className="confirm-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
