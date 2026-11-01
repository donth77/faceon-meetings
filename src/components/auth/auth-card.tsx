import type { ReactNode } from "react";

/** The white card every account screen uses: optional icon, heading, subtitle, body. */
export function AuthCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className="bg-card text-card-foreground ring-border flex flex-col gap-5 rounded-[20px] p-6 ring-1 sm:p-8"
    >
      {icon}
      <div className="flex flex-col gap-2">
        <h1
          id="auth-title"
          className="text-[26px] leading-tight font-bold tracking-tight text-balance sm:text-[30px]"
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground text-[15px] leading-normal">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A round icon above a card's heading, as on "Check your email". */
export function AuthCardIcon({
  tone,
  children,
}: {
  tone: "brand" | "success";
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        tone === "brand"
          ? "bg-secondary text-primary flex size-14 items-center justify-center rounded-full"
          : "flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
      }
    >
      {children}
    </span>
  );
}

/** "or", between the social buttons and the email form. */
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-3 text-[13px]">
      <span aria-hidden="true" className="bg-border h-px flex-1" />
      {label}
      <span aria-hidden="true" className="bg-border h-px flex-1" />
    </div>
  );
}
