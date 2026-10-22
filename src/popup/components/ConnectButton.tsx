/**
 * Кнопка подключения: круглая кнопка с анимированной иконкой питания.
 * SVG и анимации повторяют прошлую версию расширения, но без framer-motion.
 */

import { Show } from "solid-js";
import { ConnectionState } from "../../shared/constants";
import { InfoButton } from "./InfoDialog";

const POWER_PATH =
  "M51 107.19L51 101.124C28.8239 96.896 12 77.388 12 53.9999C12 27.532 33.532 5.99995 60 5.99995C86.468 5.99995 108 27.532 108 53.9999C108 77.388 91.1761 96.896 69 101.124V107.19C94.53 102.898 114 80.7499 114 53.9999C114 24.176 89.824 -5.34058e-05 60 -5.34058e-05C30.176 -5.34058e-05 6 24.176 6 53.9999C6 80.7499 25.47 102.898 51 107.19Z";
const BAR_PATH =
  "M60 120C61.658 120 63 118.658 63 117L63 69C63 67.342 61.658 66 60 66C58.342 66 57 67.342 57 69L57 117C57 118.658 58.342 120 60 120Z";

function VpnIcon(props: { state: ConnectionState }) {
  const isConnected = () => props.state === ConnectionState.Connected;
  const isConnecting = () => props.state === ConnectionState.Connecting;
  const hasError = () => props.state === ConnectionState.Error;

  return (
    <div class="relative size-24">
      {/* пульсирующий круг при подключении */}
      <Show when={isConnected()}>
        <svg
          class="pointer-events-none absolute inset-0 -z-10 size-full"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: "visible" }}
        >
          <defs>
            <mask id="pulse-mask">
              <rect x="-50" y="-50" width="220" height="220" fill="white" />
              <circle cx="60" cy="67" r="60" fill="black" />
            </mask>
          </defs>
          <circle cx="60" cy="67" r="60" class="vpn-pulse fill-primary" mask="url(#pulse-mask)" />
        </svg>
      </Show>

      <svg
        class="relative z-10 size-24 transition-transform duration-700 focus:outline-none"
        classList={{
          "rotate-180": isConnected(),
          "vpn-spin": isConnecting(),
        }}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="vpn-gradient"
            gradientUnits="userSpaceOnUse"
            x1="48.1362"
            y1="31.4397"
            x2="5.26682"
            y2="51.4505"
          >
            <stop offset="0.495356" stop-color="var(--input)" />
            <stop offset="1" stop-color="var(--primary)" />
          </linearGradient>
        </defs>
        <g>
          <path
            d={POWER_PATH}
            fill="url(#vpn-gradient)"
            classList={{
              "fill-input": !isConnected() && !isConnecting() && !hasError(),
              "fill-primary": isConnected(),
              "fill-destructive": hasError(),
            }}
          />
          <path
            d={BAR_PATH}
            classList={{
              "fill-input": !isConnected(),
              "fill-primary": isConnected(),
              "fill-destructive": hasError(),
            }}
          />
        </g>
      </svg>
    </div>
  );
}

export function ConnectButton(props: {
  state: ConnectionState;
  disabled: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  const label = () =>
    props.state === ConnectionState.Connected ? "Отключить VPN" : "Подключить VPN";

  return (
    <div class="relative flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={props.onToggle}
        disabled={props.disabled}
        aria-label={label()}
        title={label()}
        class="relative z-10 size-24 rounded-full transition-transform duration-200 enabled:hover:scale-105 enabled:active:scale-93 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <VpnIcon state={props.state} />
      </button>

      {/* (i) — в правом верхнем углу всей колонки */}
      <div class="absolute top-0 right-0 z-20">
        <InfoButton onClick={props.onInfo} />
      </div>

      <div
        class="overflow-hidden text-center text-sm text-pretty transition-all duration-200"
        classList={{
          "max-h-20 pt-1.5 opacity-100": props.state === ConnectionState.Error,
          "max-h-0 opacity-0": props.state !== ConnectionState.Error,
        }}
      >
        <div aria-live="polite">Произошла ошибка. Попробуйте еще раз.</div>
      </div>
    </div>
  );
}
