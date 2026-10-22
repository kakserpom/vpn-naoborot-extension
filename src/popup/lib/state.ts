/** Реактивное состояние popup: подписка, соединение, правила, конфликт. */

import { createSignal, onCleanup, onMount } from "solid-js";
import { API_HOST, ConflictStatus, ConnectionState, StorageKey } from "../../shared/constants";
import { browserApi, callApi } from "../../shared/browser";
import { getValue, setValue, watchValue } from "../../shared/storage";
import { DEFAULT_RULES, dedupeRules, normalizeDomain } from "../../shared/rules";
import type { ProxyAction, ProxyRulesSettings, Subscription } from "../../shared/types";

/** Подписка пользователя. */
export function useSubscription() {
  const [subscription, setSubscription] = createSignal<Subscription | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    void (async () => {
      const stored = await getValue<Subscription | null>("local", StorageKey.Subscription, null);
      setSubscription(stored);
      setLoading(false);
    })();

    const unwatch = watchValue<Subscription>("local", StorageKey.Subscription, (value) => {
      setSubscription(value ?? null);
    });
    onCleanup(unwatch);
  });

  const login = async (next: Subscription) => {
    await setValue("local", StorageKey.Subscription, next);
    setSubscription(next);
  };

  const logout = async () => {
    await setValue("local", StorageKey.Subscription, null);
    setSubscription(null);
  };

  return { subscription, loading, login, logout };
}

/** Состояние соединения с прокси. */
export function useConnectionState() {
  const [state, setState] = createSignal<ConnectionState>(ConnectionState.Disconnected);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    void (async () => {
      const stored = await getValue<ConnectionState>(
        "local",
        StorageKey.ConnectionState,
        ConnectionState.Disconnected,
      );
      setState(stored ?? ConnectionState.Disconnected);
      setLoading(false);
    })();

    const unwatch = watchValue<ConnectionState>(
      "local",
      StorageKey.ConnectionState,
      (value) => setState(value ?? ConnectionState.Disconnected),
    );
    onCleanup(unwatch);
  });

  return {
    state,
    loading,
    isConnected: () => state() === ConnectionState.Connected,
    isConnecting: () => state() === ConnectionState.Connecting,
    isDisconnected: () => state() === ConnectionState.Disconnected,
    hasError: () => state() === ConnectionState.Error,
  };
}

/** Конфликт с другим расширением, управляющим прокси. */
export function useConflict() {
  const [conflict, setConflict] = createSignal<ConflictStatus>(ConflictStatus.None);

  onMount(() => {
    void (async () => {
      const stored = await getValue<ConflictStatus>(
        "local",
        StorageKey.ConflictStatus,
        ConflictStatus.None,
      );
      setConflict(stored ?? ConflictStatus.None);
    })();

    const unwatch = watchValue<ConflictStatus>(
      "local",
      StorageKey.ConflictStatus,
      (value) => setConflict(value ?? ConflictStatus.None),
    );
    onCleanup(unwatch);
  });

  const dismiss = async () => {
    await setValue("local", StorageKey.ConflictStatus, ConflictStatus.None);
    setConflict(ConflictStatus.None);
  };

  return { conflict, dismiss };
}

/** Правила выборочного проксирования. */
export function useProxyRules() {
  const [settings, setSettings] = createSignal<ProxyRulesSettings>(DEFAULT_RULES);
  const [loading, setLoading] = createSignal(true);

  const persist = async (next: ProxyRulesSettings) => {
    setSettings(next);
    await setValue("local", StorageKey.ProxyRules, next);
  };

  onMount(() => {
    void (async () => {
      const stored = await getValue<ProxyRulesSettings>(
        "local",
        StorageKey.ProxyRules,
        DEFAULT_RULES,
      );
      setSettings({
        mode: stored?.mode === "listed" ? "listed" : "all",
        rules: Array.isArray(stored?.rules) ? dedupeRules(stored.rules) : [],
      });
      setLoading(false);
    })();

    const unwatch = watchValue<ProxyRulesSettings>("local", StorageKey.ProxyRules, (value) => {
      if (!value) return;
      setSettings({
        mode: value.mode === "listed" ? "listed" : "all",
        rules: Array.isArray(value.rules) ? value.rules : [],
      });
    });
    onCleanup(unwatch);
  });

  const setMode = async (mode: ProxyRulesSettings["mode"]) => {
    await persist({ ...settings(), mode });
  };

  const addRule = async (domain: string, action: ProxyAction) => {
    const current = settings();
    await persist({
      mode: current.mode,
      // новые сайты ставим в начало списка — свежие пункты сразу видно
      rules: dedupeRules([{ domain, action }, ...current.rules]),
    });
  };

  /** Задаёт действие («через VPN» / «напрямую») для уже существующего правила. */
  const setRuleAction = async (domain: string, action: ProxyAction) => {
    const current = settings();
    await persist({
      mode: current.mode,
      rules: current.rules.map((rule) =>
        rule.domain === domain ? { ...rule, action } : rule,
      ),
    });
  };

  const removeRule = async (domain: string) => {
    const current = settings();
    await persist({
      mode: current.mode,
      rules: current.rules.filter((rule) => rule.domain !== domain),
    });
  };

  const toggleRuleAction = async (domain: string) => {
    const current = settings();
    await persist({
      mode: current.mode,
      rules: current.rules.map((rule) =>
        rule.domain === domain
          ? { ...rule, action: rule.action === "proxy" ? "direct" : "proxy" }
          : rule,
      ),
    });
  };

  /**
   * Добавляет готовый список российских сервисов.
   *
   * Существующие правила не перезаписываются: если домена пользователя
   * нет в списке — он остаётся с любым действием (в том числе «напрямую»),
   * добавляются только те домены пресета, которых ещё нет. Новые домены
   * ставятся в начало списка.
   */
  const applyPreset = async () => {
    const current = settings();
    const present = new Set(current.rules.map((rule) => rule.domain));
    const additions = DEFAULT_RULES.rules
      .filter((rule) => !present.has(rule.domain))
      .map(({ domain }) => ({ domain, action: "proxy" as const }));
    await persist({
      mode: current.mode,
      rules: [...additions, ...current.rules],
    });
  };

  /** Удаляет все правила. */
  const clearRules = async () => {
    await persist({ ...settings(), rules: [] });
  };

  return {
    settings,
    loading,
    setMode,
    addRule,
    setRuleAction,
    removeRule,
    toggleRuleAction,
    applyPreset,
    clearRules,
  };
}

/**
 * Домен текущей активной вкладки — для кнопки «добавить текущий сайт».
 *
 * Право читать URL активной вкладки даёт разрешение `activeTab`: оно
 * срабатывает в момент клика по иконке расширения, которое открывает popup.
 * Для системных вкладок (chrome://, новая вкладка) домена не будет.
 */
export function useCurrentTabDomain() {
  const [domain, setDomain] = createSignal("");

  onMount(() => {
    void (async () => {
      try {
        const tabs = await callApi<{ url?: string }[]>(
          browserApi.tabs?.query,
          browserApi.tabs,
          [{ active: true, currentWindow: true }],
        );
        const url = tabs?.[0]?.url;
        if (!url) return;
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
        if (!parsed.hostname) return;
        // «www» в правиле не нужен — PAC и так покрывает все поддомены
        const normalized = normalizeDomain(parsed.hostname)?.replace(/^www\./, "") ?? "";
        setDomain(normalized);
      } catch {
        // URL недоступен (нет activeTab / системная вкладка) — кнопку не показываем
      }
    })();
  });

  return domain;
}

/** Техническая информация: прокси-серверы, учётные данные, устройство, API. */
export interface TechnicalInfo {
  proxies: string[];
  proxyLogin: string;
  apiHost: string;
  apiHostIndex: number | null;
  deviceId: string;
  deviceIp: string;
  version: string;
}

export function useTechnicalInfo() {
  const [info, setInfo] = createSignal<TechnicalInfo>({
    proxies: [],
    proxyLogin: "",
    apiHost: API_HOST,
    apiHostIndex: null,
    deviceId: "",
    deviceIp: "",
    version: "",
  });

  const load = async () => {
    const [proxies, credentials, apiHostIndex, deviceId, deviceIp] = await Promise.all([
      getValue<{ host: string; port: number }[]>("local", StorageKey.ProxyList, []),
      getValue<{ login: string } | null>("local", StorageKey.ProxyCredentials, null),
      getValue<number | null>("local", StorageKey.ApiHostIndex, null),
      getValue<string | null>("local", StorageKey.DeviceId, null),
      getValue<string | null>("local", StorageKey.DeviceIp, null),
    ]);

    setInfo({
      proxies: (proxies ?? []).map((proxy) => `${proxy.host}:${proxy.port}`),
      proxyLogin: credentials?.login ?? "",
      apiHost: apiHostIndex === null ? API_HOST : `${apiHostIndex}.${API_HOST}`,
      apiHostIndex,
      deviceId: deviceId ?? "",
      deviceIp: deviceIp ?? "",
      version: browserApi.runtime?.getManifest?.()?.version ?? "",
    });
  };

  onMount(() => {
    void load();
    const unwatch = [
      watchValue("local", StorageKey.ProxyList, () => void load()),
      watchValue("local", StorageKey.ProxyCredentials, () => void load()),
      watchValue("local", StorageKey.ApiHostIndex, () => void load()),
      watchValue("local", StorageKey.DeviceId, () => void load()),
      watchValue("local", StorageKey.DeviceIp, () => void load()),
    ];
    onCleanup(() => unwatch.forEach((fn) => fn()));
  });

  return { info, reload: load };
}
