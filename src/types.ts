export interface Question {
  id: string;
  county: string;
  district: string;
  image: string;
  source: string;
  note: string;
  createdAt: string;
  imageKind?: "reference-redraw";
}

export interface Attempt {
  id: string;
  questionId: string;
  answer: string;
  outcome: "correct" | "wrong" | "revealed";
  at: string;
}

export type Difficulty = "normal" | "blur" | "half";
export type Page = "practice" | "library" | "manage";
