/** Диалог конфликта с другим расширением, управляющим прокси. */

import { Button, Card, CardDescription, CardTitle, Modal } from "./ui";

export function ConflictDialog(props: { open: boolean; onDismiss: () => void }) {
  return (
    <Modal
      open={props.open}
      onClose={props.onDismiss}
      footer={
        <Button variant="secondary" onClick={props.onDismiss}>
          Понятно
        </Button>
      }
    >
      <Card class="border-0 bg-transparent p-0">
        <CardTitle class="mb-4 text-center text-lg">Конфликт расширений</CardTitle>
        <CardDescription class="text-center text-base">
          Ваши настройки прокси браузера контролируются другим расширением. Пожалуйста, отключите
          конфликтующее расширение, чтобы использовать VPN Наоборот.
        </CardDescription>
      </Card>
    </Modal>
  );
}
