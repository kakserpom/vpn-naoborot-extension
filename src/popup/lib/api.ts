/** Запросы popup к API: авторизация по email + OTP и данные подписки. */

import { apiRequest, ApiError } from "../../shared/api";
import type { Subscription, UserDataResponse } from "../../shared/types";

/** Запрашивает отправку кода подтверждения на почту. */
export async function requestOtpCode(email: string): Promise<void> {
  await apiRequest("get", "auth/request_email_verification", {
    searchParams: { reason: "website_request", email },
  });
}

/** Подтверждает код и возвращает данные подписки. */
export async function validateOtpCode(email: string, otpCode: string): Promise<Subscription> {
  const response = await apiRequest<UserDataResponse>("post", "user_data", {
    json: { email, otp_code: otpCode },
  });

  const request = response?.data?.request;
  if (!request?.public_request_id) {
    throw new ApiError("Сервер вернул некорректный ответ", 500);
  }

  return {
    email,
    paidUntil: request.paid_until ?? null,
    publicRequestId: request.public_request_id,
    simplifiedStatus: request.simplified_status,
  };
}

/** Загружает актуальные данные подписки. */
export async function fetchSubscription(
  publicRequestId: string,
  email: string,
): Promise<Subscription> {
  const response = await apiRequest<UserDataResponse>("get", "user_data", {
    searchParams: { public_request_id: publicRequestId },
  });
  const request = response?.data?.request;
  if (!request) throw new ApiError("Сервер вернул некорректный ответ", 500);

  return {
    email,
    paidUntil: request.paid_until ?? null,
    publicRequestId: request.public_request_id,
    simplifiedStatus: request.simplified_status,
  };
}
