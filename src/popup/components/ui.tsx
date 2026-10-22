/**
 * Минимальные UI-примитивы в духе shadcn/ui.
 * Классы перенесены из прошлой версии расширения, поэтому внешний вид не изменился.
 */

import { JSX, Show, createEffect, onCleanup, splitProps } from "solid-js";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-base font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-dark",
  destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
  outline:
    "border border-primary bg-background text-primary shadow-xs hover:border-ring hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary-dark",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-foreground underline underline-offset-6 hover:text-primary hover:decoration-primary hover:underline-offset-4",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 gap-1.5 rounded-md px-3",
  lg: "h-10 rounded-md px-6",
  icon: "size-9",
};

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "size", "class", "children"]);
  const variant = () => local.variant ?? "default";
  const size = () => local.size ?? "default";

  return (
    <button
      type="button"
      {...rest}
      class={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant()]} ${BUTTON_SIZES[size()]} ${local.class ?? ""}`}
    >
      {local.children}
    </button>
  );
}

const INPUT_BASE =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"]);
  return <input {...rest} class={`${INPUT_BASE} ${local.class ?? ""}`} />;
}

export function Label(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <label
      {...rest}
      class={`text-sm font-medium leading-none text-foreground ${local.class ?? ""}`}
    >
      {local.children}
    </label>
  );
}

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      {...rest}
      class={`flex w-full flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm text-card-foreground ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}

export function CardTitle(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div {...rest} class={`font-medium tracking-tight ${local.class ?? ""}`}>
      {local.children}
    </div>
  );
}

export function CardDescription(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      {...rest}
      class={`grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}

export function Spinner(props: { class?: string }) {
  return (
    <svg
      class={`animate-spin ${props.class ?? "size-4"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
      />
    </svg>
  );
}

/** Простое модальное окно в стиле старого расширения. */
export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
  footer?: JSX.Element;
}) {
  createEffect(() => {
    if (!props.open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={() => props.onClose()}
      >
        <div
          class="animate-in relative w-full max-w-72 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => props.onClose()}
            aria-label="Закрыть"
            class="absolute top-1.5 right-1.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <Show when={props.title}>
            <CardTitle class="mb-2 pr-6 text-base">{props.title}</CardTitle>
          </Show>
          {props.children}
          <Show when={props.footer}>
            <div class="mt-4 flex flex-col gap-2">{props.footer}</div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

/** Переключатель «вкл/выкл» в стиле старого расширения. */
export function Toggle(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      class={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${props.checked ? "bg-primary" : "bg-input"}`}
    >
      <span
        class={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${props.checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}
