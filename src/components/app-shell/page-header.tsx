import type { ReactNode } from "react";

/** The title row at the top of every dashboard page. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}
