import type { Attempt, Question } from "./types";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("doorplate-meta", 2);
    request.onupgradeneeded = () => {
      for (const name of ["questions", "attempts", "catalog"]) {
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("無法開啟本機資料庫，請確認瀏覽器允許網站儲存資料。"));
    request.onblocked = () =>
      reject(new Error("資料庫被其他分頁佔用，請關閉其他分頁再試。"));
  });
}

// Mark each bundled ID once in the same transaction as its initial insertion.
// Deleting a question deliberately retains the marker, so it stays deleted.
export const seedQuestions = (questions: Question[]) =>
  transaction<void>(["questions", "catalog"], "readwrite", (tx) => {
    const markers = tx.objectStore("catalog");
    const store = tx.objectStore("questions");
    for (const question of questions) {
      const marker = markers.get(question.id);
      marker.onsuccess = () => {
        if (marker.result) return;
        const existing = store.get(question.id);
        existing.onsuccess = () => {
          if (!existing.result) store.add(question);
          markers.put({ id: question.id });
        };
      };
    }
  });

async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    const request = action(tx);
    if (request)
      request.onsuccess = () => {
        result = request.result;
      };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("資料未能儲存，可能是儲存空間不足。請匯出備份後再試。"));
    };
    tx.onabort = () => {
      db.close();
      reject(new Error("資料庫操作已取消，變更尚未儲存。"));
    };
  });
}

export const getQuestions = () =>
  transaction<Question[]>(["questions"], "readonly", (tx) =>
    tx.objectStore("questions").getAll(),
  );
export const getAttempts = () =>
  transaction<Attempt[]>(["attempts"], "readonly", (tx) =>
    tx.objectStore("attempts").getAll(),
  );
export const saveQuestions = (questions: Question[]) =>
  transaction<void>(["questions"], "readwrite", (tx) => {
    for (const question of questions) tx.objectStore("questions").put(question);
  });
export const saveAttempt = (attempt: Attempt) =>
  transaction<void>(["attempts"], "readwrite", (tx) => {
    tx.objectStore("attempts").put(attempt);
  });
export const clearAttempts = () =>
  transaction<void>(["attempts"], "readwrite", (tx) => {
    tx.objectStore("attempts").clear();
  });
export const deleteQuestion = (id: string) =>
  transaction<void>(["questions", "attempts"], "readwrite", (tx) => {
    tx.objectStore("questions").delete(id);
    const request = tx.objectStore("attempts").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (cursor.value.questionId === id) cursor.delete();
        cursor.continue();
      }
    };
  });
