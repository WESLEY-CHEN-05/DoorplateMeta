import type { Attempt, Question } from "./types.ts";

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/台/g, "臺")
    .replace(/[\s·・，,。．、]/g, "")
    .trim();
}

export function isCorrectAnswer(
  input: string,
  question: Pick<Question, "county" | "district">,
): boolean {
  const value = normalizeAnswer(input);
  const placeName = normalizeAnswer(question.district).replace(
    /[鄉鎮市區]$/u,
    "",
  );
  // Accept any text containing the full place name, with or without a suffix.
  return placeName.length > 0 && value.includes(placeName);
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
