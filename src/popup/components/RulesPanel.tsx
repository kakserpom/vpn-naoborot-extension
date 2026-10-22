/**
 * Выборочное проксирование: режим работы и список сайтов.
 *
 * Режимы:
 *  - «Только из списка» — через VPN идут только сайты из списка (по умолчанию);
 *  - «Все сайты» — через VPN идёт всё, кроме помеченных «напрямую».
 *
 * Управление режимами выведено на верхний уровень popup. В поле ввода
 * placeholder показывает домен открытой вкладки: пустое поле + «Добавить»
 * добавляет текущий сайт.
 */

import { For, Show, createSignal, onCleanup } from "solid-js";
import { DEFAULT_RULES, normalizeDomain } from "../../shared/rules";
import type { ProxyAction, ProxyRulesSettings } from "../../shared/types";
import { useCurrentTabDomain } from "../lib/state";
import { Button, Card, Input } from "./ui";

interface Props {
  settings: ProxyRulesSettings;
  onModeChange: (mode: ProxyRulesSettings["mode"]) => void;
  onAdd: (domain: string, action: ProxyAction) => void;
  /** Меняет действие существующего правила («Добавить» того же домена с другим режимом). */
  onSetAction: (domain: string, action: ProxyAction) => void;
  onRemove: (domain: string) => void;
  onToggleAction: (domain: string) => void;
  onApplyPreset: () => void;
  onClear: () => void;
}

export function RulesPanel(props: Props) {
  const [domain, setDomain] = createSignal("");
  const [action, setAction] = createSignal<ProxyAction>("proxy");
  const [error, setError] = createSignal("");
  const [flash, setFlash] = createSignal(false);
  const tabDomain = useCurrentTabDomain();

  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(flashTimer));

  /** Плавно подсвечивает кнопку «Добавить» зелёным на секунду. */
  const flashSuccess = () => {
    setFlash(true);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => setFlash(false), 1000);
  };

  const submit = (event: Event) => {
    event.preventDefault();
    // пустое поле = «добавить текущий сайт» (домен активной вкладки)
    const raw = domain() || tabDomain();
    if (!raw) {
      setError("Введите домен, например gosuslugi.ru");
      return;
    }
    const normalized = normalizeDomain(raw);
    if (!normalized) {
      setError("Введите корректный домен, например gosuslugi.ru");
      return;
    }

    const existing = props.settings.rules.find((rule) => rule.domain === normalized);
    if (existing) {
      // операция идемпотентна: тот же домен с тем же действием — тихий успех,
      // с другим действием — просто обновляем пометку
      if (existing.action !== action()) props.onSetAction(normalized, action());
      flashSuccess();
      setDomain("");
      setError("");
      return;
    }

    props.onAdd(normalized, action());
    flashSuccess();
    setDomain("");
    setError("");
  };

  const badgeClass = (value: ProxyAction) =>
    value === "proxy" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  const badgeText = (value: ProxyAction) => (value === "proxy" ? "через VPN" : "напрямую");

  /** Готовый список можно прятать, когда каждый его домен уже в списке. */
  const allPresetInList = () => {
    if (props.settings.rules.length < DEFAULT_RULES.rules.length) return false;
    const present = new Set(props.settings.rules.map((rule) => rule.domain));
    return DEFAULT_RULES.rules.every((rule) => present.has(rule.domain));
  };

  return (
    <Card class="gap-2">
      {/* переключатель режима — первым идёт режим по умолчанию */}
      <div class="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => props.onModeChange("listed")}
          class="rounded-md border px-2 py-1.5 text-left text-xs transition-colors"
          classList={{
            "border-primary bg-primary/5": props.settings.mode === "listed",
            "border-input": props.settings.mode !== "listed",
          }}
        >
          <span class="font-medium">Только сайты из списка</span>
          <span class="block text-muted-foreground">Всё остальное — напрямую, без VPN</span>
        </button>
        <button
          type="button"
          onClick={() => props.onModeChange("all")}
          class="rounded-md border px-2 py-1.5 text-left text-xs transition-colors"
          classList={{
            "border-primary bg-primary/5": props.settings.mode === "all",
            "border-input": props.settings.mode !== "all",
          }}
        >
          <span class="font-medium">Все сайты через VPN</span>
          <span class="block text-muted-foreground">
            Кроме сайтов, помеченных «напрямую»
          </span>
        </button>
      </div>

      {/* форма добавления; placeholder — домен открытой вкладки */}
      <form class="flex flex-col gap-2" onSubmit={submit}>
        <Input
          value={domain()}
          onInput={(event) => {
            setDomain(event.currentTarget.value);
            setError("");
          }}
          placeholder={tabDomain() || "gosuslugi.ru"}
          aria-label="Домен"
          class="h-8 text-sm"
          spellcheck={false}
          autocomplete="off"
        />
        <div class="flex items-center gap-2">
          <select
            class="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={action()}
            onChange={(event) => setAction(event.currentTarget.value as ProxyAction)}
            aria-label="Что делать с сайтом"
          >
            <option value="proxy">Через VPN</option>
            <option value="direct">Напрямую</option>
          </select>
          <Button
            type="submit"
            size="sm"
            class={`relative shrink-0 duration-500 ${flash() ? "!bg-green-600 !text-white" : ""}`}
          >
            {/* текст держит ширину кнопки, галочка проявляется поверх */}
            <span class={`transition-opacity duration-500 ${flash() ? "opacity-0" : ""}`}>
              Добавить
            </span>
            <svg
              class={`absolute inset-0 m-auto size-4 transition-opacity duration-500 ${flash() ? "opacity-100" : "opacity-0"}`}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12.5l4.5 4.5L19 7"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </Button>
        </div>
        <Show when={error()}>
          <div class="text-xs text-destructive" aria-live="polite">
            {error()}
          </div>
        </Show>
      </form>

      {/* список правил */}
      <Show when={props.settings.rules.length > 0}>
        <ul class="flex max-h-36 flex-col gap-1 overflow-y-auto scrollbar-none">
          <For each={props.settings.rules}>
            {(rule) => (
              <li class="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                <span class="truncate text-xs" title={rule.domain}>
                  {rule.domain}
                </span>
                <div class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => props.onToggleAction(rule.domain)}
                    class={`rounded-full px-1.5 py-0.5 text-[10px] ${badgeClass(rule.action)}`}
                    title="Переключить"
                  >
                    {badgeText(rule.action)}
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onRemove(rule.domain)}
                    class="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    aria-label={`Удалить ${rule.domain}`}
                  >
                    <svg class="size-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

      {/* готовый список и очистка */}
      <div class="flex items-center gap-2">
        <Show when={!allPresetInList()}>
          <Button
            variant="outline"
            size="sm"
            class="h-7 flex-1 text-xs"
            title={`Добавить ${DEFAULT_RULES.rules.length} популярных российских сервисов`}
            onClick={props.onApplyPreset}
          >
            Готовый список
          </Button>
        </Show>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 flex-1 text-xs text-destructive hover:text-destructive"
          disabled={props.settings.rules.length === 0}
          onClick={props.onClear}
        >
          Очистить список
        </Button>
      </div>
    </Card>
  );
}
