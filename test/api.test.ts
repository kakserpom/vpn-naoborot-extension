/** Тесты URL-построения API-клиента. */

import assert from "node:assert/strict";
import { buildApiUrl } from "../src/shared/api.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

console.log("buildApiUrl");
check("основной хост без субдомена", () => {
  assert.equal(
    buildApiUrl(null, "user_data"),
    "https://naoborot-api.naoinfrastructure.com/api/v1/user_data",
  );
});
check("хост-под с индексом", () => {
  assert.equal(
    buildApiUrl(3, "get_proxy"),
    "https://3.naoborot-api.naoinfrastructure.com/api/v1/get_proxy",
  );
});
check("ведущий слэш не дублируется", () => {
  assert.equal(
    buildApiUrl(null, "/user_data"),
    "https://naoborot-api.naoinfrastructure.com/api/v1/user_data",
  );
});

console.log(`\n${passed} проверок пройдено`);
