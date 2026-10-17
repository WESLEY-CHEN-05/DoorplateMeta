import test from "node:test";
import assert from "node:assert/strict";
import {
  isCorrectAnswer,
  missedIds,
  normalizeAnswer,
  safeSource,
  shuffled,
  statsFor,
} from "../src/logic.ts";
import type { Attempt } from "../src/types.ts";

test("accepts any answer containing the complete place name, with or without an administrative suffix", () => {
  const q = { county: "臺南市", district: "永康區" };
  for (const value of [
    "永康區",
    " 臺南市 永康區 ",
    "台南市永康區",
    "台南市　永康區",
    "永康",
    "永康鄉",
    "高雄市永康區",
    "我猜是永康附近",
  ])
    assert.equal(isCorrectAnswer(value, q), true, value);
  assert.equal(
    isCorrectAnswer("台西鄉", { county: "雲林縣", district: "臺西鄉" }),
    true,
  );
});
test("rejects empty input and partial or incorrect place names", () => {
  const q = { county: "宜蘭縣", district: "礁溪鄉" };
  for (const value of [
    "",
    " ",
    "礁",
    "溪",
    "宜蘭縣",
    "溪礁",
    "頭城鎮",
    "永康區",
  ])
    assert.equal(isCorrectAnswer(value, q), false, value);
});
test("accepts 礁溪 substrings and does not require or validate an administrative suffix", () => {
  const q = { county: "宜蘭縣", district: "礁溪鄉" };
  for (const value of [
    "礁溪",
    "礁溪鄉",
    "宜蘭礁溪",
    "礁溪鎮",
    "答案是礁溪",
    "礁溪附近",
    " 礁 溪 ",
  ])
    assert.equal(isCorrectAnswer(value, q), true, value);
  assert.equal(
    isCorrectAnswer("東", { county: "臺南市", district: "東區" }),
    true,
  );
  assert.equal(
    isCorrectAnswer("任何答案", { county: "", district: "" }),
    false,
  );
});
test("normalizes full width characters and punctuation consistently", () => {
  assert.equal(normalizeAnswer(" 台南市， 永康區 "), "臺南市永康區");
});
test("review bank uses chronology; correct answer removes a previous mistake", () => {
  const attempts = [
    { questionId: "a", outcome: "correct", at: "2026-10-17T03:00:00Z" },
    { questionId: "a", outcome: "wrong", at: "2026-10-17T01:00:00Z" },
    { questionId: "b", outcome: "revealed", at: "2026-10-17T02:00:00Z" },
  ] as Attempt[];
  assert.deepEqual([...missedIds(attempts)], ["b"]);
});
test("statistics count reveals as non-correct and break the streak", () => {
  const attempts = ["wrong", "correct", "revealed", "correct", "correct"].map(
    (outcome, i) => ({ outcome, at: String(i) }),
  ) as Attempt[];
  assert.deepEqual(statsFor(attempts), {
    answered: 5,
    correct: 3,
    streak: 2,
    accuracy: 60,
  });
  assert.deepEqual(statsFor([]), {
    answered: 0,
    correct: 0,
    streak: 0,
    accuracy: 0,
  });
});
test("shuffle preserves input and membership", () => {
  const original = ["a", "b", "c", "d"];
  const result = shuffled(original, () => 0);
  assert.deepEqual(original, ["a", "b", "c", "d"]);
  assert.deepEqual([...result].sort(), original);
  assert.notDeepEqual(result, original);
  assert.deepEqual(shuffled([]), []);
});
test("source links accept only web protocols", () => {
  assert.equal(safeSource("javascript:alert(1)"), undefined);
  assert.equal(safeSource("data:text/html,abc"), undefined);
  assert.equal(safeSource("bad"), undefined);
  assert.equal(
    safeSource("https://www.threads.com/test"),
    "https://www.threads.com/test",
  );
});
