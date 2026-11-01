import { cn } from "cn";

/**
 * A person's avatar: their chosen image when there is one, otherwise their initials.
 * Decorative next to a visible name, so it's hidden from screen readers.
 */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-secondary text-secondary-foreground inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold",
        className,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar from our own route or the sign-in provider
        <img src={image} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
