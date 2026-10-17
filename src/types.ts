export interface Question {
  id: string;
  county: string;
  district: string;
  image: string;
  source: string;
  note: string;
  createdAt: string;
  imageKind?: "original-crop" | "reference-redraw";
}

export interface Attempt {
  id: string;
  questionId: string;
  answer: string;
  outcome: "correct" | "wrong" | "revealed";
  at: string;
}

export type Difficulty = "normal" | "blur" | "half" | "distance";
export type Page = "practice" | "library" | "manage";
