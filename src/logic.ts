import type { Attempt, Question } from "./types.ts";

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/台/g, "臺")
    .replace(/[\s\p{Cf}·・，,。．、]/gu, "")
    .trim();
}

export function isCorrectAnswer(
  input: string,
  question: Pick<Question, "county" | "district">,
): boolean {
  const value = normalizeAnswer(input);
  const county = normalizeAnswer(question.county);
  let district = normalizeAnswer(question.district);
  if (county && district.startsWith(county))
    district = district.slice(county.length);
  const placeName = district.replace(/[鄉鎮市區]$/u, "");
  // Accept any text containing the full place name, with or without a suffix.
  return placeName.length > 0 && value.includes(placeName);
}

// Remove only boilerplate written by earlier releases; retain users' clues.
export function displayNote(note: string): string {
  return note
    .replace(/(?:此圖為\s*)?AI\s*參考圖重[製置][^。\n]*(?:。|$)/gu, "")
    .replace(
      /符號由 life\.cq 宜蘭縣門牌整理原圖直接裁切，未使用生成或重繪。/gu,
      "",
    )
    .trim();
}

export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function missedIds(attempts: readonly Attempt[]): Set<string> {
  const result = new Set<string>();
  for (const attempt of [...attempts].sort((a, b) =>
    a.at.localeCompare(b.at),
  )) {
    if (attempt.outcome === "correct") result.delete(attempt.questionId);
    else result.add(attempt.questionId);
  }
  return result;
}

export function statsFor(attempts: readonly Attempt[]) {
  const answered = attempts.length;
  const correct = attempts.filter((a) => a.outcome === "correct").length;
  let streak = 0;
  for (const attempt of [...attempts].sort((a, b) =>
    b.at.localeCompare(a.at),
  )) {
    if (attempt.outcome !== "correct") break;
    streak++;
  }
  return {
    answered,
    correct,
    streak,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

export function safeSource(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export const SOURCE_URL = "https://www.threads.com/@life.cq/post/Dbw2vlYj61J";
