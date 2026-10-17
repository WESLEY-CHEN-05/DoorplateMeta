import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Database,
  ExternalLink,
  Flame,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  LayoutList,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import CropModal from "./CropModal";
import Practice from "./Practice";
import { cropOriginalSheet, loadBundledQuestions } from "./catalog";
import {
  clearAttempts,
  deleteQuestion,
  getAttempts,
  getQuestions,
  saveAttempt,
  saveQuestions,
  seedQuestions,
} from "./db";
import { downloadDataset, parseDataset } from "./dataset";
import {
  missedIds,
  displayNote,
  normalizeAnswer,
  safeSource,
  SOURCE_URL,
  statsFor,
} from "./logic";
import type { Attempt, Page, Question } from "./types";
import { version as appVersion } from "../package.json";

const pages: { id: Page; name: string; icon: typeof Target }[] = [
  { id: "practice", name: "練習模式", icon: Target },
  { id: "library", name: "符號圖鑑", icon: BookOpen },
  { id: "manage", name: "資料管理", icon: Database },
];

export default function App() {
  const [page, setPage] = useState<Page>("practice");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [resetting, setResetting] = useState(false);
  const [pendingImport, setPendingImport] = useState<Question[] | null>(null);
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const originalInput = useRef<HTMLInputElement>(null);
  const stats = statsFor(attempts);
  const misses = missedIds(attempts);
  const countyCount = new Set(questions.map((q) => q.county)).size;

  useEffect(() => {
    let active = true;
    async function initialize() {
      // Local libraries remain available even if a bundled asset fails to load.
      const [existing, a] = await Promise.all([getQuestions(), getAttempts()]);
      let q = existing;
      try {
        await seedQuestions(await loadBundledQuestions());
        q = await getQuestions();
      } catch (e) {
        if (active) setError((e as Error).message);
      }
      if (active) {
        setQuestions(
          q.filter((question) => question.imageKind !== "reference-redraw"),
        );
        setAttempts(a);
      }
    }
    initialize()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  async function addQuestion(question: Question) {
    if (
      questions.some(
        (q) =>
          q.county === question.county &&
          q.district === question.district &&
          q.image === question.image,
      )
    )
      throw new Error("這個地區的相同符號已經在題庫中。");
    await saveQuestions([question]);
    setQuestions((q) => [...q, question]);
  }
  async function recordAttempt(attempt: Attempt) {
    await saveAttempt(attempt);
    setAttempts((a) => [...a, attempt]);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("題庫檔案請小於 25 MB，較大的題庫請分批匯入。");
      const parsed = await parseDataset(await file.text());
      const existing = new Set(
        questions.map((q) => q.county + q.district + q.image),
      );
      const additions = parsed.filter(
        (q) => !existing.has(q.county + q.district + q.image),
      );
      if (!additions.length) setToast("題庫中的符號都已存在，沒有重複匯入。");
      else setPendingImport(additions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirmImport() {
    if (!pendingImport || busy) return;
    setBusy(true);
    try {
      await saveQuestions(pendingImport);
      const ids = new Set(pendingImport.map((question) => question.id));
      setQuestions((q) => [
        ...q.filter((question) => !ids.has(question.id)),
        ...pendingImport,
      ]);
      setToast(`已匯入 ${pendingImport.length} 個符號。`);
      setPendingImport(null);
      setPage("library");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importOriginal(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      setPendingImport(await cropOriginalSheet(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeQuestion() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteQuestion(deleting.id);
      setQuestions((q) => q.filter((v) => v.id !== deleting.id));
      setAttempts((a) => a.filter((v) => v.questionId !== deleting.id));
      setDeleting(null);
      setToast("符號與相關練習紀錄已刪除。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resetStats() {
    if (busy) return;
    setBusy(true);
    try {
      await clearAttempts();
      setAttempts([]);
      setResetting(false);
      setToast("練習紀錄已重設，題庫保持不變。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("practice");
          }}
          aria-label="Doorplate Meta 首頁"
        >
          <div className="brand-mark">
            <Compass size={26} strokeWidth={1.5} />
          </div>
          <div>
            Doorplate
            <span>
              META <span className="brand-tag">TAIWAN</span>
            </span>
          </div>
        </a>
        <div className="sidebar-caption">YOUR EXPLORATION</div>
        <nav aria-label="主要導覽">
          {pages.map((p) => (
            <button
              key={p.id}
              aria-label={p.name}
              aria-current={page === p.id ? "page" : undefined}
              className={`nav-item ${page === p.id ? "active" : ""}`}
              onClick={() => setPage(p.id)}
            >
              <p.icon size={19} strokeWidth={1.7} />
              <span>{p.name}</span>
              {p.id === "library" ? (
                <span className="nav-count">{questions.length}</span>
              ) : p.id === "practice" && page === p.id ? (
                <span className="nav-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <MapPin size={21} strokeWidth={1.5} />
          </div>
          <strong>走得更遠，從細節開始。</strong>
          <p>
            每一塊門牌，
            <br />
            都有屬於這個地方的故事。
          </p>
          <div className="note-path" aria-hidden="true">
            <span />
            ·········
            <MapPin size={15} />
          </div>
        </div>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          資料保存在此瀏覽器<small>記得定期匯出題庫備份</small>
          <span className="version">DOORPLATE META · V{appVersion}</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>探索台灣</span>
            <ChevronRight size={14} />
            <strong>{pages.find((p) => p.id === page)?.name}</strong>
          </div>
          <div className="topbar-right">
            <span className="desktop-only">FOR THE CURIOUS EXPLORER</span>
            <span className="taiwan-pill">
              <span className="dot" />
              TAIWAN
            </span>
          </div>
        </header>
        <main>
          <div className="stats-strip">
            <div>
              <span className="stat-icon orange-soft">
                <BookOpen size={19} />
              </span>
              <span>
                <strong>
                  {questions.length}
                  <small>個</small>
                </strong>
                <span>已收集符號</span>
              </span>
            </div>
            <div>
              <span className="stat-icon green-soft">
                <MapPin size={19} />
              </span>
              <span>
                <strong>
                  {countyCount}
                  <small>/ 22</small>
                </strong>
                <span>縣市覆蓋</span>
              </span>
            </div>
            <div>
              <span className="stat-icon blue-soft">
                <Target size={19} />
              </span>
              <span>
                <strong>
                  {stats.answered ? stats.accuracy : "—"}
                  <small>{stats.answered ? "%" : ""}</small>
                </strong>
                <span>答題正確率</span>
              </span>
            </div>
            <div>
              <span className="stat-icon yellow-soft">
                <Flame size={19} />
              </span>
              <span>
                <strong>
                  {stats.streak}
                  <small>題</small>
                </strong>
                <span>連續答對</span>
              </span>
            </div>
          </div>
          {!loading &&
            !questions.some(
              (q) => q.imageKind === "original-crop" && q.county === "宜蘭縣",
            ) && (
              <section className="original-import-panel">
                <ImagePlus size={24} />
                <div>
                  <strong>使用原圖，直接裁出宜蘭 12 題</strong>
                  <p>選擇完整的宜蘭縣門牌整理圖，預覽並核對裁切後即可練習。</p>
                </div>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => originalInput.current?.click()}
                >
                  匯入宜蘭原圖
                </button>
              </section>
            )}
          {error && (
            <div className="global-error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="關閉錯誤訊息"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" />
              正在打開你的符號收藏…
            </div>
          ) : (
            <>
              {page === "practice" && (
                <Practice
                  questions={questions}
                  attempts={attempts}
                  onAttempt={recordAttempt}
                  onAdd={() => setAdding(true)}
                  onLibrary={() => setPage("library")}
                />
              )}
              {page === "library" && (
                <Library
                  questions={questions}
                  misses={misses}
                  onAdd={() => setAdding(true)}
                  onImport={() => importInput.current?.click()}
                  onDelete={setDeleting}
                  onPractice={() => setPage("practice")}
                />
              )}
              {page === "manage" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        <span className="orange-line" /> MAKE IT YOUR OWN
                      </div>
                      <h1>
                        你的線索收藏庫<span className="orange">。</span>
                      </h1>
                      <p>整理門牌符號，建立可以反覆練習的地區記憶。</p>
                    </div>
                  </div>
                  <div className="manage-layout">
                    <section className="management-card">
                      <div className="panel-title">
                        <ImagePlus size={20} />
                        <h2>從圖片建立題庫</h2>
                      </div>
                      <p>
                        打開門牌對照表或照片，框選不含文字的符號，再填上對應的縣市與鄉鎮市區。
                      </p>
                      <ol className="import-steps">
                        <li>
                          <span>1</span>
                          <div>
                            <strong>準備圖片</strong>
                            <p>下載或截取你要練習的門牌圖案。</p>
                          </div>
                        </li>
                        <li>
                          <span>2</span>
                          <div>
                            <strong>裁出符號</strong>
                            <p>保留圖案與數字，避開地名與路名等文字。</p>
                          </div>
                        </li>
                        <li>
                          <span>3</span>
                          <div>
                            <strong>核對地區</strong>
                            <p>確認對應答案，即可開始練習。</p>
                          </div>
                        </li>
                      </ol>
                      <button
                        className="button primary"
                        onClick={() => setAdding(true)}
                      >
                        <Plus size={18} />
                        新增門牌符號
                        <ArrowRight size={17} />
                      </button>
                    </section>
                    <div className="manage-right">
                      <section className="management-card">
                        <div className="panel-title">
                          <FolderOpen size={20} />
                          <h2>匯入與備份</h2>
                        </div>
                        <p>
                          題庫包含裁切圖片、答案、筆記與來源。練習紀錄只存在此瀏覽器，不包含在題庫備份中。
                        </p>
                        <div className="backup-buttons">
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => importInput.current?.click()}
                          >
                            <ArrowUpFromLine size={17} />
                            {busy ? "讀取中…" : "匯入 JSON 題庫"}
                          </button>
                          <button
                            className="button secondary"
                            disabled={!questions.length || busy}
                            onClick={() => downloadDataset(questions)}
                          >
                            <ArrowDownToLine size={17} />
                            匯出題庫
                          </button>
                        </div>
                        <p className="tiny muted">
                          JSON 最多 25 MB／500 題；重複符號自動略過。
                        </p>
                      </section>
                      <section className="management-card">
                        <div className="panel-title">
                          <Trophy size={19} />
                          <h2>練習紀錄</h2>
                        </div>
                        <div className="record-numbers">
                          <div>
                            <strong>{stats.answered}</strong>
                            <span>已作答</span>
                          </div>
                          <div>
                            <strong>{stats.correct}</strong>
                            <span>答對</span>
                          </div>
                          <div>
                            <strong>{misses.size}</strong>
                            <span>待複習</span>
                          </div>
                        </div>
                        <button
                          className="text-button danger"
                          disabled={!attempts.length || busy}
                          onClick={() => setResetting(true)}
                        >
                          重設練習紀錄
                        </button>
                      </section>
                    </div>
                  </div>
                  <section className="source-panel">
                    <div className="source-panel-icon">
                      <ExternalLink size={21} />
                    </div>
                    <div>
                      <h2>參考來源：life.cq 的門牌符號整理</h2>
                      <p>
                        宜蘭縣 12
                        個地區對應已整理。可匯入完整原圖，直接裁出不含文字的符號。
                      </p>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => originalInput.current?.click()}
                      >
                        匯入宜蘭原圖
                      </button>
                      <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                        查看 Threads 原文
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </section>
                  <div className="privacy-note">
                    <ShieldCheck size={17} />
                    <span>
                      圖片和練習紀錄只儲存在本機瀏覽器，不會上傳。清除瀏覽器資料或更換網址會影響資料存取，請先匯出備份。
                    </span>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="site-footer">
            <span>
              <Compass size={15} /> A LITTLE DETAIL. A WHOLE NEW PLACE.{" "}
              <span aria-label="網站版本">v{appVersion}</span>
            </span>
            <span>Made for curious minds, one doorplate at a time.</span>
          </footer>
        </main>
      </div>
      <input
        type="file"
        className="visually-hidden"
        accept="image/png,image/jpeg,image/webp"
        aria-label="選擇宜蘭門牌原圖"
        ref={originalInput}
        onChange={(e) => {
          void importOriginal(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        className="visually-hidden"
        accept=".json,application/json"
        aria-label="選擇 JSON 題庫"
        ref={importInput}
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {adding && (
        <CropModal onClose={() => setAdding(false)} onSave={addQuestion} />
      )}
      {deleting && (
        <Confirmation
          title="刪除這個符號？"
          busy={busy}
          confirmLabel="刪除符號"
          danger
          onConfirm={() => void removeQuestion()}
          onClose={() => setDeleting(null)}
        >
          <p>
            將刪除{" "}
            <strong>
              {deleting.county}
              {deleting.district}
            </strong>{" "}
            的這個符號及相關練習紀錄。這個操作無法復原。
          </p>
        </Confirmation>
      )}
      {resetting && (
        <Confirmation
          title="重設所有練習紀錄？"
          busy={busy}
          confirmLabel="重設紀錄"
          danger
          onConfirm={() => void resetStats()}
          onClose={() => setResetting(false)}
        >
          <p>答題紀錄、連勝與錯題清單會清空。你的符號題庫會保留。</p>
        </Confirmation>
      )}
      {pendingImport && (
        <ImportConfirmation
          questions={pendingImport}
          busy={busy}
          onConfirm={() => void confirmImport()}
          onClose={() => setPendingImport(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Library({
  questions,
  misses,
  onAdd,
  onImport,
  onDelete,
  onPractice,
}: {
  questions: Question[];
  misses: Set<string>;
  onAdd: () => void;
  onImport: () => void;
  onDelete: (question: Question) => void;
  onPractice: () => void;
}) {
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(24);
  const filtered = useMemo(
    () =>
      questions
        .filter(
          (q) =>
            (county === "all" || q.county === county) &&
            normalizeAnswer(q.county + q.district + q.note).includes(
              normalizeAnswer(search),
            ),
        )
        .sort((a, b) =>
          (a.county + a.district).localeCompare(
            b.county + b.district,
            "zh-Hant",
          ),
        ),
    [questions, county, search],
  );
  return (
    <>
      <div className="page-heading library-heading">
        <div>
          <div className="eyebrow">
            <span className="orange-line" /> THE FIELD GUIDE
          </div>
          <h1>
            把每個地方，記成圖案<span className="orange">。</span>
          </h1>
          <p>對照符號與地區，在下一場探索之前多看一眼。</p>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={18} />
          新增符號
        </button>
      </div>
      <div className="library-toolbar">
        <div className="search-wrap">
          <Search size={18} />
          <input
            aria-label="搜尋地區或筆記"
            placeholder="搜尋縣市、鄉鎮市區或筆記…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(24);
            }}
          />
        </div>
        <select
          aria-label="圖鑑縣市篩選"
          value={county}
          onChange={(e) => {
            setCounty(e.target.value);
            setLimit(24);
          }}
        >
          <option value="all">全部縣市</option>
          {[...new Set(questions.map((q) => q.county))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="view-toggle">
          <button
            aria-label="格狀檢視"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            aria-label="列表檢視"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <LayoutList size={18} />
          </button>
        </div>
      </div>
      <div className="library-count">
        <span>
          共 <strong>{filtered.length}</strong> 個符號
        </span>
        <span>依地區查找門牌符號</span>
      </div>
      {filtered.length ? (
        <>
          <div className={`symbol-library ${view}`}>
            {filtered.slice(0, limit).map((q) => (
              <article className="symbol-card" key={q.id}>
                <div className="library-image">
                  <img
                    src={q.image}
                    alt={`${q.county}${q.district}門牌符號`}
                    loading="lazy"
                  />
                  {misses.has(q.id) && (
                    <span className="review-badge">待複習</span>
                  )}
                </div>
                <div className="symbol-details">
                  <span className="symbol-county">
                    <MapPin size={12} />
                    {q.county}
                  </span>
                  <h2>{q.district}</h2>
                  {displayNote(q.note) && <p>{displayNote(q.note)}</p>}
                  <div className="symbol-card-bottom">
                    {safeSource(q.source) ? (
                      <a
                        href={safeSource(q.source)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        圖片來源
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="tiny muted">未提供來源網址</span>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`刪除${q.county}${q.district}符號`}
                      onClick={() => onDelete(q)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {filtered.length > limit && (
            <button
              className="button secondary load-more"
              onClick={() => setLimit((l) => l + 24)}
            >
              載入更多符號
            </button>
          )}
          <div className="library-practice">
            <span>看熟了嗎？讓圖案成為你的定位線索。</span>
            <button className="button primary" onClick={onPractice}>
              開始練習
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      ) : (
        <div className="library-empty">
          <div className="empty-book">
            <BookOpen size={44} strokeWidth={1.2} />
          </div>
          <span className="eyebrow">A COLLECTION WAITING TO GROW</span>
          <h2>
            {questions.length
              ? "沒有找到相符的符號"
              : "你的第一本門牌圖鑑，從這裡開始。"}
          </h2>
          <p>
            {questions.length
              ? "試試其他地區名稱，或調整篩選範圍。"
              : "匯入門牌圖案，整理好地區對應，再開始純圖像練習。"}
          </p>
          <div className="empty-buttons">
            <button className="button primary" onClick={onAdd}>
              <ImagePlus size={17} />
              新增門牌符號
            </button>
            {!questions.length && (
              <button className="button secondary" onClick={onImport}>
                <ArrowUpFromLine size={17} />
                匯入題庫
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Confirmation({
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onClose,
  onConfirm,
  disabled = false,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="confirm-heading">
        <h2 id="confirm-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="關閉確認視窗"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
      <div className="confirm-buttons">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          取消
        </button>
        <button
          className={`button ${danger ? "danger-button" : "primary"}`}
          disabled={busy || disabled}
          onClick={onConfirm}
        >
          {busy && <LoaderCircle size={16} className="spin" />}
          {busy ? "處理中…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

function ImportConfirmation({
  questions,
  busy,
  onClose,
  onConfirm,
}: {
  questions: Question[];
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [approved, setApproved] = useState(false);
  return (
    <Confirmation
      title={`匯入 ${questions.length} 個符號`}
      confirmLabel="確認匯入"
      busy={busy}
      disabled={!approved}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <p>
        以下是前 {Math.min(questions.length, 24)}{" "}
        個符號的預覽。請確認題庫來源與地區對應，裁除地名與路名等文字；門牌數字可保留。
      </p>
      <div className="import-preview">
        {questions.slice(0, 24).map((q) => (
          <div key={q.id}>
            <img src={q.image} alt={`${q.county}${q.district}匯入預覽`} />
            <span>
              {q.county}
              <strong>{q.district}</strong>
            </span>
          </div>
        ))}
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
        />
        我已核對整份題庫的地區對應，且符號圖不含地名與路名等文字。
      </label>
    </Confirmation>
  );
}
