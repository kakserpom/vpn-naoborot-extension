/** Каркас popup: шапка, содержимое, подвал — как в прошлой версии. */

import { JSX } from "solid-js";
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM } from "../../shared/constants";

function ExternalLink(props: { href: string; children: JSX.Element }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer"
      class="text-foreground underline underline-offset-6 hover:text-primary hover:decoration-primary hover:underline-offset-4"
    >
      {props.children}
    </a>
  );
}

export function Header() {
  return (
    <div class="flex justify-between gap-3">
      <img src="/icon-128.png" alt="Icon" class="size-19" />
      <div>
        <h2 class="text-xl font-semibold">VPN Наоборот</h2>
        <p class="text-sm leading-4 font-semibold text-pretty">
          Доступ к российским сервисам из любой точки мира
        </p>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <div class="text-sm">
      Нужна помощь? Напишите нам на{" "}
      <ExternalLink href={`mailto:${SUPPORT_EMAIL}`}>почту</ExternalLink> или в{" "}
      <ExternalLink href={SUPPORT_TELEGRAM}>Telegram</ExternalLink>
    </div>
  );
}

export function Layout(props: { children: JSX.Element }) {
  return (
    <div class="m-auto flex min-h-135 max-h-150 w-78 flex-col gap-4 overflow-hidden p-4">
      <Header />
      <main class="flex min-h-0 flex-1 flex-col items-center overflow-y-auto scrollbar-none">
        {props.children}
      </main>
      <Footer />
    </div>
  );
}
