/** Блок аккаунта: почта, статус подписки, выход и оплата. */

import { Show } from "solid-js";
import { DEFAULT_TARIFF_ID, SUBSCRIPTION_FORM_URL } from "../../shared/constants";
import type { Subscription } from "../../shared/types";
import { Button, Card, Modal } from "./ui";

export interface SubscriptionStatus {
  status: string;
  isPaid: boolean;
  paidUntil: Date | null;
}

/** Считает статус подписки по данным аккаунта. */
export function getSubscriptionStatus(subscription: Subscription): SubscriptionStatus {
  if (!subscription.paidUntil) {
    const isPaid = subscription.simplifiedStatus === "paid";
    return { status: isPaid ? "Оплачено" : "Не оплачено", isPaid, paidUntil: null };
  }

  const timestamp = Date.parse(subscription.paidUntil);
  if (Number.isNaN(timestamp)) {
    return { status: "Не оплачено", isPaid: false, paidUntil: null };
  }

  const paidUntil = new Date(timestamp);
  if (timestamp > Date.now()) {
    return { status: "Оплачено", isPaid: true, paidUntil };
  }
  return { status: "Подписка истекла", isPaid: false, paidUntil };
}

/** Формат даты dd.MM.yyyy — как в прошлой версии расширения. */
export function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function SuccessIcon() {
  return (
    <svg class="size-4 shrink-0 text-success" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg class="size-4 shrink-0 text-destructive" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
      <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      class="size-4 shrink-0 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2" />
      <path d="M2 7l10 6 10-6" stroke="currentColor" stroke-width="2" />
    </svg>
  );
}

export function AccountPanel(props: {
  email: string;
  status: SubscriptionStatus;
  onLogout: () => void;
}) {
  const payUrl = () =>
    `${SUBSCRIPTION_FORM_URL}?email=${encodeURIComponent(props.email)}&tariffId=${DEFAULT_TARIFF_ID}`;

  return (
    <Card class="gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <MailIcon />
          <span class="truncate text-sm" title={props.email}>
            {props.email}
          </span>
        </div>
        <Button variant="link" class="h-auto shrink-0 p-0 text-xs" onClick={() => props.onLogout()}>
          Выйти
        </Button>
      </div>

      <div class="flex items-center gap-2">
        <Show when={props.status.isPaid} fallback={<ErrorIcon />}>
          <SuccessIcon />
        </Show>
        <span class="text-sm">{props.status.status}</span>
        <Show when={props.status.isPaid && props.status.paidUntil}>
          <span class="text-xs text-muted-foreground">
            до {formatDate(props.status.paidUntil!)}
          </span>
        </Show>
      </div>

      <Show when={!props.status.isPaid}>
        <Button variant="link" class="h-auto justify-start p-0 text-xs">
          <a href={payUrl()} target="_blank" rel="noreferrer">
            Оплатить
          </a>
        </Button>
      </Show>
    </Card>
  );
}

/** Диалог подтверждения выхода из аккаунта. */
export function LogoutDialog(props: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Выйти из аккаунта?"
      footer={
        <>
          <Button variant="secondary" onClick={props.onCancel}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={props.onConfirm}>
            Выйти
          </Button>
        </>
      }
    >
      <p class="text-sm text-muted-foreground">
        Подписка останется активной, но потребуется снова войти по коду из письма.
      </p>
    </Modal>
  );
}
