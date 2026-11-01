import {
  Hand,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SmilePlus,
  Video,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

const PEOPLE = [
  { name: "Ana", tone: "from-sky-400/70 to-blue-600/70", speaking: true },
  { name: "Ben", tone: "from-emerald-400/70 to-teal-600/70" },
  { name: "Priya", tone: "from-violet-400/70 to-indigo-600/70", muted: true },
  { name: "Kenji", tone: "from-amber-300/70 to-orange-500/70" },
];

const CONTROLS = [Mic, Video, MonitorUp, SmilePlus, Hand];

/** A drawn (not screenshotted) meeting: four tiles and the control bar. */
export async function ProductShot() {
  const t = await getTranslations("Landing");

  return (
    <div
      role="img"
      aria-label={t("productShotLabel")}
      className="w-full max-w-xl rounded-2xl bg-[#12161c] p-3 shadow-xl ring-1 ring-black/10"
    >
      <div className="grid grid-cols-2 gap-2">
        {PEOPLE.map(({ name, tone, speaking, muted }) => (
          <div
            key={name}
            className={`relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br ${tone} ${
              speaking ? "ring-live ring-2" : ""
            }`}
          >
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
              {muted ? <MicOff className="size-3" aria-hidden="true" /> : null}
              {name}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        {CONTROLS.map((Icon, index) => (
          <span
            key={index}
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ))}
        <span className="bg-destructive flex h-9 w-12 items-center justify-center rounded-full text-white">
          <PhoneOff className="size-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
