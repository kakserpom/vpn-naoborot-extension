/** Экран входа: email → код из письма. */

import { For, Show, createSignal, onMount } from "solid-js";
import { requestOtpCode, validateOtpCode } from "../lib/api";
import { getValue, setValue } from "../../shared/storage";
import { StorageKey } from "../../shared/constants";
import type { AuthStepState, Subscription } from "../../shared/types";
import { Button, Input, Label } from "./ui";

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

/** Поле ввода кода из четырёх цифр. */
function OtpInput(props: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  let inputs: HTMLInputElement[] = [];

  const setValueAt = (index: number, digit: string) => {
    const digits = props.value.padEnd(4, " ").slice(0, 4).split("");
    digits[index] = digit;
    const next = digits.join("").trimEnd();
    props.onChange(next);
    if (digit && index < 3) inputs[index + 1]?.focus();
  };

  const handleInput = (index: number, event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const digits = target.value.replace(/\D/g, "");
    if (!digits) {
      setValueAt(index, "");
      return;
    }
    // поддержка вставки нескольких цифр
    for (let i = 0; i < digits.length && index + i < 4; i++) {
      setValueAt(index + i, digits[i]);
    }
    const nextIndex = Math.min(index + digits.length, 3);
    inputs[nextIndex]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent) => {
    if (event.key === "Backspace" && !props.value[index]) {
      inputs[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputs[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 3) inputs[index + 1]?.focus();
  };

  return (
    <div class="flex justify-center gap-2">
      <For each={[0, 1, 2, 3]}>
        {(index) => (
          <input
            ref={(element) => {
              inputs[index] = element;
            }}
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength={4}
            disabled={props.disabled}
            value={props.value[index] ?? ""}
            onInput={(event) => handleInput(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            aria-label={`Цифра ${index + 1}`}
            class="size-10 rounded-md border border-input bg-transparent text-center text-lg shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}
      </For>
    </div>
  );
}

export function AuthPage(props: { onAuthenticated: (subscription: Subscription) => void }) {
  const [step, setStep] = createSignal<"email" | "otp">("email");
  const [email, setEmail] = createSignal("");
  const [otp, setOtp] = createSignal("");
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  onMount(() => {
    void (async () => {
      const saved = await getValue<AuthStepState | null>("session", StorageKey.AuthStep, null);
      if (saved?.step === "otp" && saved.email) {
        setEmail(saved.email);
        setStep("otp");
      }
    })();
  });

  const saveStep = async (next: "email" | "otp", nextEmail: string) => {
    await setValue("session", StorageKey.AuthStep, { step: next, email: nextEmail });
  };

  const submitEmail = async (event: Event) => {
    event.preventDefault();
    const value = email().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Введите корректный email");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await requestOtpCode(value);
      await saveStep("otp", value);
      setStep("otp");
    } catch (requestError) {
      console.error(requestError);
      setError("Не удалось отправить код. Проверьте email и попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (event: Event) => {
    event.preventDefault();
    const code = otp();
    if (code.length !== 4) {
      setError("Введите четыре цифры из письма");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const subscription = await validateOtpCode(email(), code);
      await setValue("session", StorageKey.AuthStep, null);
      props.onAuthenticated(subscription);
    } catch (requestError) {
      console.error(requestError);
      setError("Неверный код или срок действия кода истёк");
    } finally {
      setBusy(false);
    }
  };

  const backToEmail = async () => {
    setOtp("");
    setError("");
    await saveStep("email", email());
    setStep("email");
  };

  return (
    <div class="-mt-6 flex w-full flex-1 flex-col items-center justify-center gap-6">
      <h1 class="mb-2 animate-in text-center text-xl font-semibold duration-700 fade-in slide-in-from-top-4">
        Вход
      </h1>

      <Show when={error()}>
        <div
          class="animate-in w-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          aria-live="polite"
        >
          {error()}
        </div>
      </Show>

      <Show when={step() === "email"}>
        <form class="flex w-full flex-col gap-4" onSubmit={submitEmail}>
          <div class="flex flex-col gap-0">
            <Label class="mb-2">Email</Label>
            <Input
              type="email"
              required
              placeholder="your@email.com"
              autocomplete="email"
              autofocus
              disabled={busy()}
              value={email()}
              onInput={(event) => {
                setEmail(event.currentTarget.value);
                setError("");
              }}
            />
          </div>
          <div class="flex flex-col gap-2">
            <Button type="submit" disabled={busy()}>
              {busy() ? "Отправляем…" : "Получить код"}
            </Button>
          </div>
        </form>
      </Show>

      <Show when={step() === "otp"}>
        <form class="flex w-full flex-col gap-4" onSubmit={submitOtp}>
          <div class="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
            <MailIcon />
            <span class="text-sm text-foreground">{email()}</span>
          </div>

          <div class="flex flex-col items-center gap-2">
            <Label>Код из письма</Label>
            <OtpInput value={otp()} onChange={setOtp} disabled={busy()} />
          </div>

          <div class="flex flex-col gap-2">
            <Button type="submit" disabled={busy() || otp().length !== 4}>
              {busy() ? "Проверяем…" : "Войти"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy()} onClick={backToEmail}>
              Изменить email
            </Button>
          </div>
        </form>
      </Show>
    </div>
  );
}
