"use client";

import { cn } from "cn";
import {
  Check,
  Info,
  KeyRound,
  Lock,
  Shuffle,
  Trash2,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Radio, RadioGroup, ToggleButton } from "react-aria-components";
import { toast } from "sonner";

import {
  focusFirstInvalid,
  FormNotice,
  PasswordField,
} from "@/components/auth/fields";
import { GitHubIcon, GoogleIcon } from "@/components/auth/provider-icons";
import { LEGAL_LINKS } from "@/components/legal/legal-links";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INPUT } from "@/components/ui/form-fields";
import { setPasswordAction, updateProfileAction } from "@/lib/account/actions";
import {
  changePassword,
  deleteUser,
  linkSocial,
  signOut,
  unlinkAccount,
} from "@/lib/auth/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { authProblem, linkProblem } from "@/lib/auth/problems";
import { createAvatarSeed, parseAvatarSeed } from "@/lib/avatars/seed";
import { publicEnv } from "@/lib/env";
import { signInPath } from "@/lib/routes";

import { SettingsCard } from "./settings-nav";

const ACCOUNT_ROUTE = "/settings/account";

/** Where the account's profile photo came from. */
export type PhotoProvider = "google" | "github" | "other";

export type AccountInfo = {
  name: string;
  email: string;
  emailVerified: boolean;
  /** The Google or GitHub profile photo, if the account has one. */
  photo: string | null;
  photoProvider: PhotoProvider | null;
  /** Whether the photo is shown instead of the avatar. */
  usesPhoto: boolean;
  avatarSeed: string;
  /** Linked sign-in methods: "google", "github" and "credential" (a password). */
  methods: Array<{ id: string; providerId: string }>;
  /** Whether this deployment offers email-and-password sign-in. */
  passwordSignIn: boolean;
  /** Whether Google Calendar sync is connected, so deleting cancels events there. */
  onGoogleCalendar: boolean;
};

const OUTLINE =
  "h-[38px] gap-2 rounded-[10px] border-[#c9cfd8] px-3.5 text-sm font-semibold dark:border-white/15";

const avatarSrc = (seed: string) => `/avatar/${seed}.svg`;

function Profile({
  account,
  avatarChoices,
}: {
  account: AccountInfo;
  avatarChoices: string[];
}) {
  const t = useTranslations("Settings.account");
  const router = useRouter();
  const nameId = useId();
  const avatarsId = useId();
  const nameErrorId = useId();
  const [seed, setSeed] = useState(account.avatarSeed);
  const [usesPhoto, setUsesPhoto] = useState(account.usesPhoto);
  const [seeds, setSeeds] = useState(() => [
    account.avatarSeed,
    ...avatarChoices,
  ]);
  const [name, setName] = useState(account.name);
  const [nameError, setNameError] = useState(false);

  async function save(change: Record<string, string>) {
    const saved = await updateProfileAction(change).catch(() => false);
    if (saved) router.refresh();
    else toast.error(t("saveFailed"));
  }

  function pickAvatar(next: string) {
    setSeed(next);
    setUsesPhoto(false);
    void save({ avatarSeed: next, avatarSource: "dicebear" });
  }

  function usePhoto(on: boolean) {
    setUsesPhoto(on);
    void save(
      on
        ? { avatarSource: "provider" }
        : { avatarSeed: seed, avatarSource: "dicebear" },
    );
  }

  function shuffle() {
    // Keeps the avatar you have, with seven new ones beside it.
    const look = parseAvatarSeed(seed)?.look ?? "n";
    setSeeds([
      seed,
      ...Array.from({ length: 7 }, () => createAvatarSeed(look)),
    ]);
  }

  function saveName() {
    const next = name.trim();
    if (!next) {
      setNameError(true);
      return;
    }
    setNameError(false);
    if (next !== account.name) void save({ name: next });
  }

  const shown = usesPhoto && account.photo ? account.photo : avatarSrc(seed);
  return (
    <SettingsCard title={t("profile")}>
      <div className="flex flex-wrap items-start gap-7">
        <div className="flex w-[140px] flex-col items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="" className="size-[120px] rounded-full" />
          <span className="text-muted-foreground text-center text-[13px]">
            {t("shownWhenOff")}
          </span>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
          <RadioGroup
            value={usesPhoto ? null : seed}
            onChange={pickAvatar}
            orientation="horizontal"
            aria-labelledby={avatarsId}
          >
            <span id={avatarsId} className="mb-3 block text-sm font-semibold">
              {t("pickAvatar")}
            </span>
            <div className="flex flex-wrap gap-3.5">
              {seeds.map((option, index) => (
                <Radio
                  key={option}
                  value={option}
                  aria-label={t("avatarOption", { n: index + 1 })}
                  className="group data-focus-visible:focus-ring-strong relative size-16 rounded-full outline-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc(option)}
                    alt=""
                    className="size-16 rounded-full shadow-[0_0_0_1px_var(--border)] group-data-selected:shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--primary)]"
                  />
                  <span className="bg-primary text-primary-foreground absolute -right-0.5 -bottom-0.5 hidden size-[22px] items-center justify-center rounded-full shadow-[0_0_0_2px_var(--card)] group-data-selected:flex">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                </Radio>
              ))}
            </div>
          </RadioGroup>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className={OUTLINE} onPress={shuffle}>
              <Shuffle className="size-[18px]" aria-hidden="true" />
              {t("shuffle")}
            </Button>
            {account.photo && account.photoProvider ? (
              <ToggleButton
                isSelected={usesPhoto}
                onChange={usePhoto}
                className="bg-background hover:bg-muted border-input data-selected:border-primary data-selected:bg-chip data-selected:text-chip-foreground data-focus-visible:focus-ring flex h-[38px] items-center gap-2 rounded-[10px] border px-3.5 text-sm font-semibold whitespace-nowrap outline-hidden"
              >
                <User className="size-[18px]" aria-hidden="true" />
                {t("usePhoto", { provider: account.photoProvider })}
              </ToggleButton>
            ) : null}
          </div>
          <div className="flex max-w-[420px] flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-semibold">
              {t("displayName")}
            </label>
            <input
              id={nameId}
              value={name}
              maxLength={64}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveName();
              }}
              aria-invalid={nameError || undefined}
              aria-describedby={nameError ? nameErrorId : undefined}
              className={cn(INPUT, "h-11 text-[15px]")}
            />
            {nameError ? (
              <span
                id={nameErrorId}
                role="alert"
                className="text-destructive-text text-[13px]"
              >
                {t("nameRequired")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{t("credit")}</p>
    </SettingsCard>
  );
}

function PasswordDialog({
  email,
  hasPassword,
  onClose,
}: {
  email: string;
  hasPassword: boolean;
  onClose: (saved: boolean) => void;
}) {
  const t = useTranslations("Settings.account");
  const authT = useTranslations("Auth");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const tooShort = () =>
    authT("errors.passwordShort", { min: MIN_PASSWORD_LENGTH });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (next.length < MIN_PASSWORD_LENGTH) {
      setErrors({ next: tooShort() });
      focusFirstInvalid(form);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (hasPassword) {
        const { error } = await changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        if (error) {
          const kind = authProblem(error);
          if (error.code === "INVALID_PASSWORD") {
            setErrors({ current: t("wrongPassword") });
          } else if (kind === "passwordBreached") {
            setErrors({ next: authT("errors.passwordBreached") });
          } else if (kind === "passwordShort") {
            setErrors({ next: tooShort() });
          } else {
            setErrors({
              form: authT(
                kind === "tooMany" ? "errors.tooMany" : "errors.generic",
              ),
            });
          }
          focusFirstInvalid(form);
          return;
        }
      } else {
        const result = await setPasswordAction(next).catch(
          () => "failed" as const,
        );
        if (result !== "ok") {
          setErrors(
            result === "breached"
              ? { next: authT("errors.passwordBreached") }
              : result === "invalid"
                ? { next: tooShort() }
                : { form: authT("errors.generic") },
          );
          focusFirstInvalid(form);
          return;
        }
      }
      toast.success(hasPassword ? t("passwordChanged") : t("passwordAdded"));
      onClose(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose(false);
      }}
      closeLabel={t("cancel")}
      className="sm:max-w-md"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {hasPassword ? t("changePassword") : t("setPassword")}
          </DialogTitle>
          <DialogDescription>
            {hasPassword ? t("passwordSet") : t("setPasswordHelp", { email })}
          </DialogDescription>
        </DialogHeader>
        {errors.form ? (
          <FormNotice icon={Info}>{errors.form}</FormNotice>
        ) : null}
        {/* Lets password managers file the new password under this account. */}
        <input
          type="email"
          value={email}
          autoComplete="username"
          readOnly
          hidden
        />
        {hasPassword ? (
          <PasswordField
            label={t("currentPassword")}
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            error={errors.current}
            pending={saving}
          />
        ) : null}
        <PasswordField
          label={t("newPassword")}
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint={authT("passwordHint", { min: MIN_PASSWORD_LENGTH })}
          error={errors.next}
          pending={saving}
        />
        <DialogFooter>
          <Button variant="outline" onPress={() => onClose(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" isPending={saving}>
            {hasPassword ? t("changePassword") : t("setPassword")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

const PROVIDERS = [
  { id: "google", name: "Google", Icon: GoogleIcon },
  { id: "github", name: "GitHub", Icon: GitHubIcon },
] as const;

function SignIn({
  account,
  linkError,
}: {
  account: AccountInfo;
  linkError: string | null;
}) {
  const t = useTranslations("Settings.account");
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const methodFor = (providerId: string) =>
    account.methods.find((method) => method.providerId === providerId);
  const hasPassword = methodFor("credential") !== undefined;
  // A password only counts where this deployment lets people sign in with one.
  const usable = account.methods.filter(
    (method) => method.providerId !== "credential" || account.passwordSignIn,
  ).length;

  async function connect(provider: "google" | "github") {
    setBusy(provider);
    const { error } = await linkSocial({
      provider,
      callbackURL: ACCOUNT_ROUTE,
      errorCallbackURL: ACCOUNT_ROUTE,
    });
    if (error) {
      setBusy(null);
      toast.error(t("linkErrors.generic"));
    }
  }

  async function remove(providerId: string) {
    const method = methodFor(providerId);
    if (!method) return;
    setBusy(providerId);
    const { error } = await unlinkAccount({ accountId: method.id });
    setBusy(null);
    if (!error) router.refresh();
    else if (error.code === "SESSION_EXPIRED")
      toast.error(t("removeSignInFirst"));
    else toast.error(t("removeFailed"));
  }

  const row =
    "flex flex-wrap items-center justify-between gap-2.5 border-t border-[#e2e5ea] py-3 dark:border-white/10";
  return (
    <SettingsCard title={t("emailAndSignIn")}>
      {linkError ? (
        <FormNotice icon={Info}>
          {t(`linkErrors.${linkProblem(linkError)}`, {
            email: account.email,
            appName: publicEnv.NEXT_PUBLIC_APP_NAME,
          })}
        </FormNotice>
      ) : null}
      <div className="flex max-w-[420px] flex-col gap-1.5">
        <label htmlFor="account-email" className="text-sm font-semibold">
          {t("email")}
        </label>
        <input
          id="account-email"
          type="email"
          value={account.email}
          readOnly
          aria-describedby="account-email-help"
          className="bg-muted h-11 rounded-[10px] border border-[#e2e5ea] px-3 text-[15px] outline-none dark:border-white/10"
        />
        <span
          id="account-email-help"
          className="text-muted-foreground text-[13px]"
        >
          {account.emailVerified ? t("verified") : t("notVerified")}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="pb-1.5 text-sm font-semibold">{t("methods")}</span>
        {PROVIDERS.map(({ id, name, Icon }) => {
          const connected = methodFor(id) !== undefined;
          return (
            <div key={id} className={row}>
              <span className="flex items-center gap-2.5 text-[15px]">
                <Icon className="size-[22px]" />
                {connected
                  ? t("withEmail", { method: name, email: account.email })
                  : name}
              </span>
              {!connected ? (
                <Button
                  variant="outline"
                  className={OUTLINE}
                  isPending={busy === id}
                  onPress={() => void connect(id)}
                >
                  {t("connect", { provider: name })}
                </Button>
              ) : usable < 2 ? (
                <span className="text-muted-foreground text-[13px]">
                  {t("onlyMethod")}
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground text-[13px]">
                    {t("connected")}
                  </span>
                  <Button
                    variant="outline"
                    className={OUTLINE}
                    isPending={busy === id}
                    aria-label={t("removeLabel", { provider: name })}
                    onPress={() => void remove(id)}
                  >
                    {t("remove")}
                  </Button>
                </span>
              )}
            </div>
          );
        })}
        {account.passwordSignIn ? (
          <div className={row}>
            <span className="flex items-start gap-2.5 text-[15px]">
              <KeyRound
                className="text-muted-foreground mt-px size-[22px] shrink-0"
                aria-hidden="true"
              />
              <span className="flex flex-col gap-0.5">
                <span>
                  {hasPassword
                    ? t("withEmail", {
                        method: t("emailPassword"),
                        email: account.email,
                      })
                    : t("emailPassword")}
                </span>
                <span className="text-muted-foreground text-[13px]">
                  {hasPassword ? t("passwordSet") : t("passwordNotSet")}
                </span>
              </span>
            </span>
            <Button
              variant="outline"
              className={OUTLINE}
              onPress={() => setDialog(true)}
            >
              {hasPassword ? (
                <Lock className="size-[18px]" aria-hidden="true" />
              ) : null}
              {hasPassword ? t("changePassword") : t("setPassword")}
            </Button>
          </div>
        ) : null}
      </div>
      {dialog ? (
        <PasswordDialog
          email={account.email}
          hasPassword={hasPassword}
          onClose={(saved) => {
            setDialog(false);
            if (saved) router.refresh();
          }}
        />
      ) : null}
    </SettingsCard>
  );
}

function DeleteAccount({
  hasPassword,
  onGoogleCalendar,
}: {
  hasPassword: boolean;
  onGoogleCalendar: boolean;
}) {
  const t = useTranslations("Settings.account");
  const authT = useTranslations("Auth");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<
    "password" | "signInAgain" | "failed" | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (hasPassword && !password) {
      setProblem("password");
      focusFirstInvalid(form);
      return;
    }
    setDeleting(true);
    const { error } = await deleteUser(hasPassword ? { password } : {});
    if (!error) {
      // A full load, so nothing from the deleted account stays in memory, and Back
      // doesn't return to its settings.
      window.location.replace("/");
      return;
    }
    setDeleting(false);
    setProblem(
      error.code === "INVALID_PASSWORD"
        ? "password"
        : error.code === "SESSION_EXPIRED"
          ? "signInAgain"
          : "failed",
    );
    focusFirstInvalid(form);
  }

  async function signInAgain() {
    await signOut();
    // A full load after signing out, as above.
    window.location.replace(signInPath(ACCOUNT_ROUTE));
  }

  return (
    <SettingsCard title={t("deleteTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground max-w-[56ch] text-sm leading-normal">
          {t("deleteBody")}
        </span>
        <Button
          variant="outline"
          className={cn(
            OUTLINE,
            "text-destructive-text hover:text-destructive-text",
          )}
          onPress={() => {
            setPassword("");
            setProblem(null);
            setOpen(true);
          }}
        >
          <Trash2 className="size-[18px]" aria-hidden="true" />
          {t("deleteTitle")}
        </Button>
      </div>
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        role="alertdialog"
        closeLabel={t("cancel")}
        className="sm:max-w-md"
      >
        <form onSubmit={confirm} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("deleteConfirmBody")}
              {onGoogleCalendar ? ` ${t("deleteCalendar")}` : null}
            </DialogDescription>
          </DialogHeader>
          {problem === "signInAgain" ? (
            <FormNotice icon={Info}>{t("signInFirst")}</FormNotice>
          ) : problem === "failed" ? (
            <FormNotice icon={Info}>{authT("errors.generic")}</FormNotice>
          ) : null}
          {hasPassword ? (
            <PasswordField
              label={t("password")}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              error={problem === "password" ? t("wrongPassword") : null}
              pending={deleting}
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            {problem === "signInAgain" ? (
              <Button onPress={() => void signInAgain()}>
                {t("signInAgain")}
              </Button>
            ) : (
              <Button
                type="submit"
                isPending={deleting}
                className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
              >
                {t("deleteForGood")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </Dialog>
    </SettingsCard>
  );
}

/**
 * Settings → Account: profile and avatar, how you sign in, deleting the account, and
 * where the privacy policy and the terms are.
 */
export function AccountSettings({
  account,
  avatarChoices,
  linkError,
}: {
  account: AccountInfo;
  /** Seven avatars to offer beside the current one. */
  avatarChoices: string[];
  /** The error from a failed Connect Google or GitHub, if the page came back with one. */
  linkError: string | null;
}) {
  const t = useTranslations("Settings.account");
  return (
    <>
      <h2 className="text-[22px] font-bold">{t("title")}</h2>
      <Profile account={account} avatarChoices={avatarChoices} />
      <SignIn account={account} linkError={linkError} />
      <DeleteAccount
        hasPassword={account.methods.some(
          (method) => method.providerId === "credential",
        )}
        onGoogleCalendar={account.onGoogleCalendar}
      />
      <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
        {t.rich("legal", {
          appName: publicEnv.NEXT_PUBLIC_APP_NAME,
          ...LEGAL_LINKS,
        })}
      </p>
    </>
  );
}
