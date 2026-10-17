import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Crop,
  Eye,
  Flag,
  Focus,
  ImagePlus,
  Layers,
  RotateCcw,
  Shuffle,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import { makeDemoImage } from "./images";
import {
  isCorrectAnswer,
  missedIds,
  safeSource,
  shuffled,
  SOURCE_URL,
} from "./logic";
import type { Attempt, Difficulty, Question } from "./types";

interface Props {
  questions: Question[];
  attempts: Attempt[];
  onAttempt: (attempt: Attempt) => Promise<void>;
  onAdd: () => void;
  onLibrary: () => void;
}
const modes: {
  id: Difficulty;
  title: string;
  hint: string;
  icon: typeof Eye;
}[] = [
  { id: "normal", title: "原始符號", hint: "完整觀察圖案", icon: Eye },
  { id: "blur", title: "強力模糊", hint: "提高遠距離辨識挑戰", icon: Focus },
  { id: "half", title: "裁切一半", hint: "只留下左側線索", icon: Crop },
];

export default function Practice({
  questions,
  attempts,
  onAttempt,
  onAdd,
  onLibrary,
}: Props) {
  const [mode, setMode] = useState<Difficulty>("normal");
  const [county, setCounty] = useState("all");
  const [review, setReview] = useState(false);
  const [deck, setDeck] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Attempt["outcome"] | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [round, setRound] = useState(1);
  const answerRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const misses = useMemo(() => missedIds(attempts), [attempts]);
  const counties = [...new Set(questions.map((q) => q.county))];
  const [demoQuestion] = useState<Question>(() => ({
    id: "demo",
    county: "示範縣",
    district: "示範區",
    image: makeDemoImage(),
    source: "",
    note: "這是用來測試操作的人造圖案，沒有對應真實地區。",
    createdAt: "",
  }));
  const question = demo
    ? demoQuestion
    : questions.find((q) => q.id === deck[cursor]);

  function clear() {
    setAnswer("");
    setResult(null);
    setError("");
  }
  function startSession(nextCounty = county, nextReview = review) {
    const pool = questions.filter(
      (q) =>
        (nextCounty === "all" || q.county === nextCounty) &&
        (!nextReview || misses.has(q.id)),
    );
    setDeck(shuffled(pool.map((q) => q.id)));
    setCursor(0);
    setRound(1);
    clear();
  }
  useEffect(() => {
    startSession();
  }, [questions]); // Data changes begin a new session; grading preserves the current review deck.
  useEffect(() => {
    if (result) submitRef.current?.focus();
  }, [result]);

  function next() {
    clear();
    if (demo) {
      answerRef.current?.focus();
      return;
    }
    if (cursor < deck.length - 1) setCursor((c) => c + 1);
    else {
      const pool = questions
        .filter(
          (q) =>
            (county === "all" || q.county === county) &&
            (!review || misses.has(q.id)),
        )
        .map((q) => q.id);
      const nextDeck = shuffled(pool);
      if (nextDeck.length > 1 && nextDeck[0] === question?.id)
        [nextDeck[0], nextDeck[1]] = [nextDeck[1], nextDeck[0]];
      setDeck(nextDeck);
      setCursor(0);
      setRound((r) => r + 1);
    }
    setTimeout(() => answerRef.current?.focus(), 0);
  }
  async function grade(reveal = false) {
    if (busyRef.current || !question || result) return;
    if (!reveal && !answer.trim()) {
      setError("先輸入你判斷的鄉鎮市區。");
      answerRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    const outcome = reveal
      ? "revealed"
      : isCorrectAnswer(answer, question)
        ? "correct"
        : "wrong";
    try {
      if (!demo)
        await onAttempt({
          id: crypto.randomUUID(),
          questionId: question.id,
          answer: answer.trim(),
          outcome,
          at: new Date().toISOString(),
        });
      setResult(outcome);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="orange-line" /> LOOK CLOSER. GUESS BETTER.
          </div>
          <h1>
            一個符號，
            <br className="mobile-break" />
            定位一個地方<span className="orange">。</span>
          </h1>
          <p>不靠路名，不看文字。用門牌上的小線索，認識台灣。</p>
        </div>
        <div className="heading-stamp">
          <Focus size={30} strokeWidth={1} />
          <span>
            TAIWAN
            <br />
            <strong>圖像辨識練習</strong>
          </span>
        </div>
      </div>
      <div className="practice-layout">
        <div className="practice-main">
          <div className="question-card">
            <div className="question-topline">
              <span className="tiny-badge">
                <span className="dot" />
                {demo ? "流程示範" : "門牌符號練習"}
              </span>
              <span className="mono">
                {question
                  ? `${String(demo ? 1 : cursor + 1).padStart(2, "0")} / ${String(demo ? 1 : deck.length).padStart(2, "0")}`
                  : "READY WHEN YOU ARE"}
              </span>
            </div>
            <div className={`symbol-stage ${question ? "" : "empty-stage"}`}>
              <span className="corner top-left" />
              <span className="corner top-right" />
              <span className="corner bottom-left" />
              <span className="corner bottom-right" />
              {question ? (
                <>
                  <div className={`question-image-frame ${mode}`}>
                    <img
                      key={question.id}
                      src={question.image}
                      alt="待辨識的門牌符號"
                      draggable={false}
                    />
                  </div>
                  <div className="image-caption">
                    <span className="dot" />
                    {modes.find((m) => m.id === mode)?.title} · 純圖像題目
                  </div>
                </>
              ) : (
                <div className="empty-content">
                  <div className="empty-symbols" aria-hidden="true">
                    <div>
                      <svg viewBox="0 0 64 64">
                        <path
                          d="M12 48 29 16l12 24 8-14 13 22Z"
                          fill="currentColor"
                        />
                        <circle cx="48" cy="16" r="5" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <svg viewBox="0 0 64 64">
                        <path
                          d="M32 53V29M32 42C9 42 10 14 10 14s24-3 22 28Zm0-9C31 9 53 9 53 9s4 22-21 24Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                      </svg>
                    </div>
                    <div>
                      <svg viewBox="0 0 64 64">
                        <path
                          d="M8 23q8-10 16 0t16 0 16 0M8 35q8-10 16 0t16 0 16 0M8 47q8-10 16 0t16 0 16 0"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                      </svg>
                    </div>
                  </div>
                  <span className="empty-kicker">
                    YOUR NEXT CLUE STARTS HERE
                  </span>
                  <h2>
                    {review
                      ? "目前沒有待複習的錯題"
                      : county !== "all"
                        ? "這個範圍還沒有符號"
                        : "收集第一個門牌符號"}
                  </h2>
                  <p>
                    {review
                      ? "答錯或查看答案的題目會留在這裡，答對後移出。"
                      : "把門牌上的圖案裁下來，建立屬於你的辨識題庫。"}
                  </p>
                  <button
                    className="button primary"
                    onClick={
                      review
                        ? () => {
                            setReview(false);
                            startSession(county, false);
                          }
                        : onAdd
                    }
                  >
                    {review ? <RotateCcw size={17} /> : <ImagePlus size={17} />}
                    {review ? "回到全部練習" : "新增門牌符號"}
                    <ArrowRight size={16} />
                  </button>
                  {!review && (
                    <button
                      className="text-button demo-button"
                      onClick={() => {
                        setDemo(true);
                        clear();
                      }}
                    >
                      先用示範題試玩 <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {demo && (
              <div className="demo-notice">
                <Sparkles size={16} />
                <span>人造圖案示範，答案為「示範區」，不計入正式紀錄。</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setDemo(false);
                    clear();
                  }}
                >
                  結束
                </button>
              </div>
            )}
            {question?.imageKind === "original-crop" && (
              <div className="reference-notice">
                <Focus size={15} />
                <span>原圖裁切 · 保留來源圖案，未生成或重繪。</span>
              </div>
            )}
            {question && (
              <div className="answer-area">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (result) next();
                    else void grade();
                  }}
                >
                  <label htmlFor="answer">這個符號來自哪個鄉鎮市區？</label>
                  <div className="answer-row">
                    <div className="answer-input-wrap">
                      <Flag size={18} />
                      <input
                        ref={answerRef}
                        id="answer"
                        value={answer}
                        onChange={(e) => {
                          setAnswer(e.target.value);
                          setError("");
                        }}
                        placeholder="輸入地名即可，不必加鄉鎮市區"
                        disabled={!!result || busy}
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={80}
                      />
                    </div>
                    <button
                      ref={submitRef}
                      type="submit"
                      className="button primary"
                      disabled={busy}
                    >
                      {busy ? "儲存中…" : result ? "下一題" : "確認答案"}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="answer-hints">
                    <span>
                      包含完整地名即可；不必加鄉鎮市區，「台／臺」皆可。
                    </span>
                    <span className="desktop-only">
                      <kbd>Enter</kbd> {result ? "下一題" : "送出"}
                    </span>
                  </div>
                </form>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                {result ? (
                  <div
                    className={`answer-result ${result === "correct" ? "correct" : result === "revealed" ? "revealed" : "wrong"}`}
                    role="status"
                  >
                    <div className="result-icon">
                      {result === "correct" ? (
                        <Check size={21} />
                      ) : result === "wrong" ? (
                        <X size={21} />
                      ) : (
                        <Eye size={21} />
                      )}
                    </div>
                    <div>
                      <strong>
                        {result === "correct"
                          ? "答對了，線索掌握得很好！"
                          : result === "wrong"
                            ? "還差一點，把這個符號記起來。"
                            : "先認識它，下次再挑戰。"}
                      </strong>
                      <p>
                        正確答案：
                        <b>
                          {question.county} {question.district}
                        </b>
                      </p>
                      {question.note && <p>{question.note}</p>}
                      {safeSource(question.source) && (
                        <a
                          href={safeSource(question.source)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          查看圖片來源 ↗
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="question-actions">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void grade(true)}
                    >
                      <Eye size={16} />
                      查看答案
                    </button>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={next}
                    >
                      跳過，不計分
                      <SkipForward size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="card-footer">
              <span>
                <CheckCheck size={15} />
                {question
                  ? "符號裁圖不含地名與門牌文字"
                  : "先整理，再辨識。從一張圖開始。"}
              </span>
              <span className="mono">
                {question && !demo
                  ? `ROUND ${String(round).padStart(2, "0")}`
                  : "TAIWAN / 22 COUNTIES"}
              </span>
            </div>
          </div>
          <div className="how-to">
            <div className="how-step">
              <span>01</span>
              <div>
                <strong>觀察圖案</strong>
                <p>注意外框、植物與線條形狀</p>
              </div>
            </div>
            <div className="how-step">
              <span>02</span>
              <div>
                <strong>輸入地區</strong>
                <p>試著回想對應的鄉鎮市區</p>
              </div>
            </div>
            <div className="how-step">
              <span>03</span>
              <div>
                <strong>建立記憶</strong>
                <p>從錯題中慢慢找到辨識線索</p>
              </div>
            </div>
          </div>
        </div>
        <aside className="practice-options">
          <section className="option-panel">
            <div className="panel-title">
              <Layers size={17} />
              <h2>練習設定</h2>
            </div>
            <span className="field-label">挑戰難度</span>
            <div className="mode-list">
              {modes.map((m) => (
                <button
                  disabled={busy || !!result}
                  key={m.id}
                  className={`mode-button ${mode === m.id ? "selected" : ""}`}
                  onClick={() => setMode(m.id)}
                >
                  <m.icon size={20} strokeWidth={1.6} />
                  <span>
                    <strong>{m.title}</strong>
                    <small>{m.hint}</small>
                  </span>
                  <span className="radio-indicator">
                    {mode === m.id && <span />}
                  </span>
                </button>
              ))}
            </div>
            <div className="divider" />
            <label className="field-label" htmlFor="county-filter">
              練習範圍
            </label>
            <div className="select-wrap">
              <select
                id="county-filter"
                disabled={busy || demo}
                value={county}
                onChange={(e) => {
                  setCounty(e.target.value);
                  startSession(e.target.value);
                }}
              >
                <option value="all">全部縣市</option>
                {counties.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={15} />
            </div>
            <label className="review-toggle">
              <span>
                <RotateCcw size={16} />
                只練錯題 <small>{misses.size}</small>
              </span>
              <input
                type="checkbox"
                checked={review}
                disabled={busy || demo}
                onChange={(e) => {
                  setReview(e.target.checked);
                  startSession(county, e.target.checked);
                }}
              />
              <span className={`toggle-track ${review ? "on" : ""}`} />
            </label>
            <button
              className="button secondary full-width"
              disabled={busy || !deck.length || demo}
              onClick={() => startSession()}
            >
              <Shuffle size={16} />
              重新洗牌
            </button>
          </section>
          <section className="tip-panel">
            <div className="panel-title">
              <Sparkles size={17} />
              <h2>給探索者的小提示</h2>
            </div>
            <p>
              先從完整符號建立印象，再挑戰模糊或裁切。同一種圖案可能跨地區使用，建題時請核對來源。
            </p>
            <button className="text-button" onClick={onLibrary}>
              翻開符號圖鑑
              <BookOpen size={16} />
            </button>
          </section>
          <a
            className="source-link"
            href={SOURCE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span className="source-icon">↗</span>
            <span>
              靈感來源<span>life.cq 的門牌符號整理</span>
            </span>
            <ArrowRight size={14} />
          </a>
        </aside>
      </div>
    </>
  );
}
