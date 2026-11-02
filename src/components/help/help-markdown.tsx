import { ExternalLink } from "lucide-react";
import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** "Share your screen" → "share-your-screen", for heading anchors. */
const anchorFor = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");

const textOf = (children: unknown): string =>
  Array.isArray(children)
    ? children.map(textOf).join("")
    : typeof children === "string"
      ? children
      : "";

const COMPONENTS: Components = {
  h2: ({ children }) => (
    <h2
      id={anchorFor(textOf(children))}
      className="mt-9 scroll-mt-6 text-xl font-bold text-balance first:mt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-bold text-balance">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-3 text-[15px] leading-relaxed">{children}</p>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 flex list-decimal flex-col gap-2 pl-6 text-[15px] leading-relaxed marker:font-semibold">
      {children}
    </ol>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 flex list-disc flex-col gap-2 pl-6 text-[15px] leading-relaxed">
      {children}
    </ul>
  ),
  li: ({ children }) => (
    <li className="pl-1 [&>ol]:mt-2 [&>ul]:mt-2">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  // Inline code in the articles is always a key or a key combination.
  code: ({ children }) => (
    <kbd className="bg-muted text-foreground rounded-md border px-1.5 py-px font-sans text-[13px] font-semibold whitespace-nowrap">
      {children}
    </kbd>
  ),
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link
        href={href}
        className="text-primary font-medium underline-offset-4 hover:underline"
      >
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
      >
        {children}
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    ),
  // A quote is a tip or a note, set off in a box.
  blockquote: ({ children }) => (
    <aside className="bg-secondary/60 text-foreground mt-5 rounded-xl px-4 py-1 pb-4 ring-1 ring-[#dbe4ff] dark:ring-white/10 [&>p:first-child]:mt-3">
      {children}
    </aside>
  ),
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-[#e2e5ea] dark:ring-white/10">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children }) => (
    <th scope="col" className="px-4 py-2.5 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t px-4 py-2.5">{children}</td>,
};

/** A help article's Markdown, set in FaceOn's type. Rendered on the server only. */
export function HelpMarkdown({ markdown }: { markdown: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {markdown}
    </Markdown>
  );
}
