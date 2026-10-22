/**
 * Домены, которые по умолчанию пускаются через российский IP.
 *
 * Это сервисы, которые ограничивают доступ по географии: госорганы, суды,
 * банки, почта, операторы связи и популярные порталы. Список открыт для
 * правки — в popup его можно дополнить или удалить лишнее.
 */

export const DEFAULT_PROXY_DOMAINS: string[] = [
  // Госуслуги и государственные органы
  "gosuslugi.ru",
  "nalog.ru",
  "pfr.gov.ru",
  "sfr.gov.ru",
  "minjust.gov.ru",
  "fssp.gov.ru",
  "rosreestr.gov.ru",
  "zakupki.gov.ru",
  "mvd.ru",
  "gibdd.ru",
  "cbr.ru",
  "ofr.ru",

  // Суды
  "sudrf.ru",
  "vsrf.ru",
  "mos-gorsud.ru",
  "kad.arbitr.ru",

  // Почта и доставка
  "pochta.ru",
  "russianpost.ru",
  "cdek.ru",
  "boxberry.ru",

  // Банки
  "sberbank.ru",
  "sber.ru",
  "tinkoff.ru",
  "tbank.ru",
  "vtb.ru",
  "alfabank.ru",
  "gazprombank.ru",
  "sovcombank.ru",
  "psb.ru",

  // Операторы связи и интернет
  "mts.ru",
  "megafon.ru",
  "beeline.ru",
  "tele2.ru",
  "rt.ru",

  // Порталы и соцсети
  "yandex.ru",
  "mail.ru",
  "vk.com",
  "ok.ru",

  // Маркетплейсы и сервисы
  "ozon.ru",
  "wildberries.ru",
  "avito.ru",
  "hh.ru",
  "cian.ru",
  "flamp.ru",
  "eda.yandex.ru",
  "taxi.yandex.ru",

  // Медиа, кино и транспорт
  "rbc.ru",
  "ria.ru",
  "tass.ru",
  "vedomosti.ru",
  "kinopoisk.ru",
  "lenta.ru",
  "2gis.ru",
  "gismeteo.ru",
  "aeroflot.ru",
  "rzd.ru",
  "moex.com",
];
