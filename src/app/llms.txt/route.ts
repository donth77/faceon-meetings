import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

// A plain-language summary for AI agents and LLM crawlers (https://llmstxt.org).
export function GET() {
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  const origin = siteUrl();
  const repo = publicEnv.NEXT_PUBLIC_REPO_URL;

  const body = [
    `# ${name}`,
    "",
    `> ${name} is a free, open-source (MIT) video meeting app that runs in the browser. It works like Zoom or Google Meet: start or schedule a meeting, share the link, and people join from any device without installing anything.`,
    "",
    "- Guests join a meeting with just their name; hosts sign in with Google, GitHub, or an email and password.",
    "- Meetings have IDs, passcodes, a waiting room and host controls, plus chat, reactions, raise hand and screen sharing.",
    "- Meeting links (/j/...) and account pages are private and must not be crawled or summarized.",
    "",
    "## Pages",
    "",
    `- [Home](${origin}/): what ${name} is, and joining or starting a meeting`,
    ...(repo
      ? [
          "",
          "## Source",
          "",
          `- [Source code on GitHub](${repo}): MIT-licensed`,
        ]
      : []),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
