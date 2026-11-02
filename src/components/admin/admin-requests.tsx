"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pager } from "@/components/ui/pager";
import { decideRequestAction } from "@/lib/hosting/admin-actions";
import type { ListPage } from "@/lib/pagination";

import { AdminCard } from "./admin-card";
import { useFocusAfterRemoval } from "./use-focus-after-removal";
import { useWhen } from "./use-when";

type Request = {
  id: string;
  name: string;
  email: string;
  note: string | null;
  createdAt: string;
};

type Decision = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "approved" | "declined";
  decidedAt: string | null;
  decidedBy: string | null;
};

/**
 * Settings → Admin → Requests: who asked to host full meetings, to approve or decline, and
 * the answers so far. Each list is paged (`?requests=`, `?answers=`).
 */
export function AdminRequests({
  requests,
  requestsPage,
  decisions,
  decisionsPage,
  askAgainDays,
}: {
  requests: Request[];
  requestsPage: ListPage;
  decisions: Decision[];
  decisionsPage: ListPage;
  askAgainDays: number;
}) {
  const t = useTranslations("Admin.requests");
  const admin = useTranslations("Admin");
  const router = useRouter();
  const when = useWhen();
  const heading = useRef<HTMLHeadingElement>(null);
  const [declining, setDeclining] = useState<Request | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const rowGoing = useFocusAfterRemoval(heading, requests);

  function decide(request: Request, approve: boolean) {
    setBusy(request.id);
    startTransition(async () => {
      const result = await decideRequestAction(request.id, approve).catch(
        () => "failed" as const,
      );
      setBusy(null);
      setDeclining(null);
      if (result === "done") {
        toast.success(
          t(approve ? "approvedDone" : "declinedDone", { name: request.name }),
        );
      } else if (result === "answered") {
        toast(t("answered"));
      } else {
        toast.error(
          admin(
            result === "notAllowed"
              ? "notAllowed"
              : result === "tooManyTries"
                ? "tooManyTries"
                : "failed",
          ),
        );
      }
      // The request goes: keep focus in the section.
      heading.current?.focus();
      rowGoing();
      router.refresh();
    });
  }

  return (
    <AdminCard title={t("title")} headingRef={heading}>
      <Pager label={t("pages")} param="requests" page={requestsPage}>
        {requests.length === 0 ? (
          <p className="text-muted-foreground text-[15px]">{t("none")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {requests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
                  <span className="font-semibold">{request.name}</span>
                  <span className="text-muted-foreground text-sm break-all">
                    {request.email}
                  </span>
                  {request.note ? (
                    <blockquote className="bg-muted mt-1 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
                      <span className="sr-only">{t("note")}: </span>
                      {request.note}
                    </blockquote>
                  ) : null}
                  <span className="text-muted-foreground text-[13px]">
                    {t("asked", { date: when(request.createdAt) })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onPress={() => decide(request, true)}
                    isPending={busy === request.id && declining === null}
                    isDisabled={busy !== null}
                    aria-label={t("approveLabel", { name: request.name })}
                  >
                    {t("approve")}
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => setDeclining(request)}
                    isDisabled={busy !== null}
                    aria-label={t("declineLabel", { name: request.name })}
                  >
                    {t("decline")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Pager>
      {decisionsPage.total > 0 ? (
        <div className="flex flex-col gap-3 border-t pt-4">
          <h4 className="text-[15px] font-bold">{t("recent")}</h4>
          <Pager label={t("recentPages")} param="answers" page={decisionsPage}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {decisions.map((decision) => (
                <li key={decision.id} className="text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {decision.name}
                  </span>{" "}
                  <span className="break-all">({decision.email})</span>
                  {" · "}
                  {t(
                    decision.status === "approved"
                      ? "wasApproved"
                      : "wasDeclined",
                    {
                      by: decision.decidedBy ?? t("formerAdmin"),
                      date: decision.decidedAt ? when(decision.decidedAt) : "",
                    },
                  )}
                </li>
              ))}
            </ul>
          </Pager>
        </div>
      ) : null}
      {declining ? (
        <ConfirmDialog
          isOpen
          onClose={() => setDeclining(null)}
          title={t("declineTitle", { name: declining.name })}
          description={t("declineBody", { days: askAgainDays })}
          confirmLabel={t("decline")}
          cancelLabel={t("cancel")}
          isPending={busy === declining.id}
          onConfirm={() => decide(declining, false)}
        />
      ) : null}
    </AdminCard>
  );
}
