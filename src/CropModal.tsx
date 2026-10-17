import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  Check,
  Crop as CropIcon,
  ImagePlus,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { districts } from "./dataset";
import { cropImage, loadImage, readImage } from "./images";
import type { Crop } from "./images";
import { SOURCE_URL } from "./logic";
import type { Question } from "./types";

interface Props {
  onClose: () => void;
  onSave: (question: Question) => Promise<void>;
}

export default function CropModal({ onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState("");
  const [crop, setCrop] = useState<Crop | null>(null);
  const [preview, setPreview] = useState("");
  const [county, setCounty] = useState("");
  const [district, setDistrict] = useState("");
  const [source, setSource] = useState(SOURCE_URL);
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    let active = true;
    setPreview("");
    setApproved(false);
    if (image && crop && crop.width > 0 && crop.height > 0) {
      cropImage(image, crop)
        .then((value) => {
          if (active) {
            setPreview(value);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
    };
  }, [image, crop]);

  async function selectFile(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const next = await readImage(file);
      await loadImage(next);
      setImage(next);
      setCrop(null);
      setPreview("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = imageRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (busy || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = point(event);
    setCrop(null);
    setError("");
    setMessage("");
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const end = point(event);
    setCrop({
      x: Math.min(start.current.x, end.x),
      y: Math.min(start.current.y, end.y),
      width: Math.abs(end.x - start.current.x),
      height: Math.abs(end.y - start.current.y),
    });
  }
  function up() {
    start.current = null;
  }

  async function save() {
    if (busy) return;
    if (!preview || !county || !district || !approved) {
      setError("請框選符號、填寫答案，並確認裁切圖沒有文字。");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSave({
        id: crypto.randomUUID(),
        county,
        district,
        image: preview,
        source: source.trim(),
        note: note.trim(),
        createdAt: new Date().toISOString(),
      });
      setMessage(
        `已儲存 ${county}${district}。可以繼續框選同一張圖的下一個符號。`,
      );
      setDistrict("");
      setCrop(null);
      setPreview("");
      setApproved(false);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="crop-dialog"
      aria-labelledby="crop-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">BUILD YOUR COLLECTION</span>
          <h2 id="crop-title">新增門牌符號</h2>
        </div>
        <button
          className="icon-button"
          aria-label="關閉新增符號"
          disabled={busy}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <p className="muted dialog-intro">
        從門牌照片或對照表中，保留<strong>圖案與數字，避開地名與路名</strong>
        。同一張圖可以連續建立多題。
      </p>
      <div className="crop-layout">
        <div className="crop-left">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            aria-label="選擇門牌圖片"
            onChange={(e) => {
              void selectFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {!image ? (
            <button
              className="upload-zone"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={38} strokeWidth={1.3} />
              <strong>選擇門牌圖片</strong>
              <span>PNG、JPG、WebP · 最大 15 MB</span>
              <small>可以使用貼文截圖，圖片不會上傳。</small>
            </button>
          ) : (
            <>
              <div className="crop-toolbar">
                <span>
                  <CropIcon size={15} /> 拖曳框選符號
                </span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  更換圖片
                </button>
              </div>
              <div className="image-scroll">
                <div
                  className="crop-surface"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                >
                  <img
                    ref={imageRef}
                    src={image}
                    alt="待裁切的門牌原圖"
                    draggable={false}
                  />
                  {crop && (
                    <div
                      className="selection-box"
                      style={{
                        left: `${crop.x * 100}%`,
                        top: `${crop.y * 100}%`,
                        width: `${crop.width * 100}%`,
                        height: `${crop.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <p className="tiny muted">
                觸控也可拖曳框選。裁切後請在右側預覽確認，避開地名與路名等文字，門牌數字可保留。
              </p>
              <div className="keyboard-crop">
                <span className="tiny muted">也可用數值調整框選範圍（%）</span>
                <div className="crop-coordinates">
                  {(["x", "y", "width", "height"] as const).map((key, i) => (
                    <label key={key}>
                      {["左", "上", "寬", "高"][i]}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(
                          (crop?.[key] ??
                            { x: 0, y: 0, width: 1, height: 1 }[key]) * 100,
                        )}
                        onChange={(e) => {
                          const base = crop ?? {
                            x: 0,
                            y: 0,
                            width: 1,
                            height: 1,
                          };
                          const next = {
                            ...base,
                            [key]:
                              Math.max(
                                0,
                                Math.min(100, Number(e.target.value)),
                              ) / 100,
                          };
                          next.width = Math.min(next.width, 1 - next.x);
                          next.height = Math.min(next.height, 1 - next.y);
                          setCrop(next);
                        }}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })}
                >
                  圖片已去除文字？選取整張
                </button>
              </div>
            </>
          )}
        </div>
        <div className="crop-right">
          <span className="field-label">題目預覽</span>
          <div className="crop-preview">
            {preview ? (
              <img src={preview} alt="裁切後的純圖案預覽" />
            ) : (
              <>
                <CropIcon size={26} strokeWidth={1.3} />
                <span>框選後顯示符號</span>
              </>
            )}
          </div>
          <div className="form-pair">
            <div>
              <label htmlFor="crop-county">縣市</label>
              <select
                id="crop-county"
                value={county}
                onChange={(e) => {
                  setCounty(e.target.value);
                  setDistrict("");
                }}
              >
                <option value="">選擇縣市</option>
                {districts.map((c) => (
                  <option key={c.county}>{c.county}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="crop-district">鄉鎮市區</label>
              <select
                id="crop-district"
                value={district}
                disabled={!county}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="">選擇地區</option>
                {districts
                  .find((c) => c.county === county)
                  ?.districts.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
              </select>
            </div>
          </div>
          <label className="field-label">
            來源網址
            <input
              value={source}
              maxLength={2000}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </label>
          <label className="field-label">
            辨識筆記 <span className="optional">選填，答題後才顯示</span>
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：注意外框形狀、葉片的方向…"
              rows={2}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={approved}
              disabled={!preview}
              onChange={(e) => setApproved(e.target.checked)}
            />
            <span>我已確認：裁切圖不含地名與路名等文字，且地區對應正確。</span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              <Check size={16} />
              {message}
            </p>
          )}
          <button
            className="button primary full-width"
            disabled={busy || !preview || !approved || !county || !district}
            onClick={() => void save()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Plus size={18} />
            )}
            儲存符號
          </button>
        </div>
      </div>
    </dialog>
  );
}
