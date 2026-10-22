/** Точка входа popup: авторизация или главный экран. */

import { Show, createMemo, createSignal } from "solid-js";
import { ConflictStatus, MessageType } from "../shared/constants";
import { sendMessage } from "../shared/browser";
import {
  useConflict,
  useConnectionState,
  useProxyRules,
  useSubscription,
  useTechnicalInfo,
} from "./lib/state";
import { AccountPanel, LogoutDialog, getSubscriptionStatus } from "./components/AccountPanel";
import { AuthPage } from "./components/AuthPage";
import { ConflictDialog } from "./components/ConflictDialog";
import { ConnectButton } from "./components/ConnectButton";
import { InfoDialog } from "./components/InfoDialog";
import { Layout } from "./components/Layout";
import { PrivateWindowsNotice } from "./components/PrivateWindowsNotice";
import { RulesPanel } from "./components/RulesPanel";
import { Spinner } from "./components/ui";

export default function App() {
  const subscription = useSubscription();
  const connection = useConnectionState();
  const conflict = useConflict();
  const rules = useProxyRules();
  const technical = useTechnicalInfo();
  const [logoutOpen, setLogoutOpen] = createSignal(false);
  const [infoOpen, setInfoOpen] = createSignal(false);
  const [error, setError] = createSignal("");

  const status = createMemo(() => {
    const current = subscription.subscription();
    return current ? getSubscriptionStatus(current) : null;
  });

  const toggleProxy = async () => {
    try {
      await sendMessage({ type: MessageType.ToggleProxy });
      setError("");
    } catch (requestError) {
      console.error(requestError);
      setError("Не удалось связаться с фоновым скриптом. Перезагрузите расширение.");
    }
  };

  const openInfo = () => {
    void technical.reload();
    setInfoOpen(true);
  };

  const logout = async () => {
    setLogoutOpen(false);
    try {
      await sendMessage({ type: MessageType.DisableProxy });
    } catch (requestError) {
      console.error(requestError);
    }
    await subscription.logout();
  };

  return (
    <Layout>
      <Show
        when={!subscription.loading() && !connection.loading()}
        fallback={
          <div class="flex flex-1 items-center justify-center">
            <Spinner class="size-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <Show
          when={subscription.subscription()}
          fallback={<AuthPage onAuthenticated={subscription.login} />}
        >
          <div class="flex w-full flex-col items-center gap-3">
            <PrivateWindowsNotice />

            <ConnectButton
              state={connection.state()}
              disabled={connection.isConnecting() || !status()?.isPaid}
              onToggle={() => void toggleProxy()}
              onInfo={openInfo}
            />

            <Show when={error()}>
              <div
                class="w-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                aria-live="polite"
              >
                {error()}
              </div>
            </Show>

            <Show when={status()}>
              {(current) => (
                <AccountPanel
                  email={subscription.subscription()!.email}
                  status={current()}
                  onLogout={() => setLogoutOpen(true)}
                />
              )}
            </Show>

            <RulesPanel
              settings={rules.settings()}
              onModeChange={(mode) => void rules.setMode(mode)}
              onAdd={(domain, action) => void rules.addRule(domain, action)}
              onSetAction={(domain, action) => void rules.setRuleAction(domain, action)}
              onRemove={(domain) => void rules.removeRule(domain)}
              onToggleAction={(domain) => void rules.toggleRuleAction(domain)}
              onApplyPreset={() => void rules.applyPreset()}
              onClear={() => void rules.clearRules()}
            />
          </div>
        </Show>
      </Show>

      <ConflictDialog
        open={conflict.conflict() === ConflictStatus.Detected}
        onDismiss={() => void conflict.dismiss()}
      />

      <InfoDialog
        open={infoOpen()}
        onClose={() => setInfoOpen(false)}
        info={technical.info()}
        state={connection.state()}
        rules={rules.settings()}
      />

      <LogoutDialog
        open={logoutOpen()}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
    </Layout>
  );
}
