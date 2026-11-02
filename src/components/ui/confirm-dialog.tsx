"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A question that needs an answer before something happens: delete, end, replace. An
 * alert dialog with Cancel and the action; Cancel has focus first, so Enter never
 * destroys anything by accident.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  isPending,
  onConfirm,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** The action can't be undone: a red button. */
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
  /** Anything else the question needs, between the description and the buttons. */
  children?: ReactNode;
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      role="alertdialog"
      showCloseButton={false}
      isDismissable={!isPending}
    >
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        {description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : null}
      </DialogHeader>
      {children}
      <DialogFooter>
        <Button variant="outline" onPress={onClose} autoFocus>
          {cancelLabel}
        </Button>
        <Button
          isPending={isPending}
          onPress={onConfirm}
          className={
            destructive
              ? "bg-destructive-fill hover:bg-destructive-fill/90 text-white"
              : undefined
          }
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
