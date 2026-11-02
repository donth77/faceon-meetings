"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Sonner draws focus as a faint shadow and removes the outline; ours wins. */
const FOCUS =
  "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-solid! focus-visible:outline-ring!";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const t = useTranslations("Toasts");

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      containerAriaLabel={t("region")}
      toastOptions={{
        classNames: {
          toast: `cn-toast ${FOCUS}`,
          actionButton: FOCUS,
          cancelButton: FOCUS,
          closeButton: FOCUS,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
