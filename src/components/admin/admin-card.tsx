import type { ReactNode, Ref } from "react";

/**
 * One section of Settings → Admin, as a card like Settings' sections. `headingRef` lets a section
 * move focus to its heading when the row someone acted on goes away.
 */
export function AdminCard({
  title,
  description,
  headingRef,
  children,
}: {
  title: string;
  description?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <section className="bg-card ring-border flex flex-col gap-4 rounded-2xl px-5 py-5 ring-1 sm:px-6 sm:py-5.5">
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-lg font-bold outline-none"
        >
          {title}
        </h2>
        {description ? (
          <div className="text-muted-foreground text-sm leading-normal">
            {description}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
