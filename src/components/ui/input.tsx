"use client";

import { cn } from "cn";
import * as React from "react";
import {
  composeRenderProps,
  Input as InputPrimitive,
} from "react-aria-components";

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (className) =>
        cn(
          "border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 focus-visible:focus-ring h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base outline-hidden transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
          className,
        ),
      )}
      {...props}
    />
  );
}

export { Input };
