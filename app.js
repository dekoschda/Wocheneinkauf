"use strict";

const DB_NAME = "wochenkauf-pwa";
const DB_VERSION = 1;
const STORE = "receipts";
const CATEGORY_WORDS = {
  "Rabatte": ["rabatt","coupon","gutschein","ersparnis","gespart","preisnachlass","aktion"],
  "Pfand & Rückgabe": ["pfand","leergut","flaschenrückgabe","dosenrückgabe"],
  "Obst & Gemüse": ["apfel","banane","tomate","gurke","salat","kartoffel","zwiebel","paprika","beeren","gemüse","obst","karotte"],
  "Milchprodukte": ["milch","käse","joghurt","quark","butter","sahne","skyr","mozzarella"],
  "Brot & Frühstück": ["brot","brötchen","toast","müsli","hafer","marmelade","kaffee","cornflakes"],
  "Fleisch & Fisch": ["hähnchen","fleisch","hack","wurst","lachs","fisch","schinken","salami"],
  "Getränke": ["wasser","saft","cola","bier","wein","getränk","limonade"],
  "Haushalt": ["papier","reiniger","spül","wasch","müllbeutel","seife","tücher"],
  "Tiefkühl": ["tk ","tiefkühl","pizza","eiscreme"],
  "Süßes & Snacks": ["schokolade","chips","keks","bonbon","gummi"],
};

const state = { receipts: [], draftItems: [], draftImage: null, draftImageName: "", draftFileType: "", installPrompt: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (cents) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format((Number(cents) || 0) / 100);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const today = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const categoryFor = (name) => { const lower = name.toLowerCase(); return Object.entries(CATEGORY_WORDS).find(([, words]) => words.some((word) => lower.includes(word)))?.[0] || "Sonstiges"; };
const offerSlug = (value) => value.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

async function dbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function dbAdd(value) {
  const db = await openDb();
  return new Promise((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).add(value); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function dbDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
}
async function dbClearAndImport(rows) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite"); const store = tx.objectStore(STORE); store.clear();
    rows.forEach((row) => store.put(row)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
}

function parseReceiptText(text) {
  const checkoutWords = /(?:^|\b)(?:zwischen\s*summe|teil\s*summe|summe|gesamt(?:summe|betrag)?|end(?:summe|betrag)|rechnungsbetrag|zahlbetrag|zu\s+zahlen|total)(?:\b|\s|:)/i;
  const finalCheckoutWords = /^(?:summe|gesamt(?:summe|betrag)?|end(?:summe|betrag)|rechnungsbetrag|zahlbetrag|zu\s+zahlen|total)(?:\b|\s|:)/i;
  const nonItemWords = /(?:^|\b)(?:betrag|mwst|mehrwertsteuer|umsatzsteuer|ust|steuer|netto|brutto|steuerpfl(?:ichtig)?|steuerfrei|gegeben|r(?:ü|ue|u)ckgeld|bar(?:geld|zahlung)?|unbar|karte|kartenzahlung|kartenbeleg|girocard|ec[ -]?(?:cash|karte)?|visa|mastercard|maestro|v[ -]?pay|debit|kreditkarte|kontaktlos|apple\s*pay|google\s*pay|zahlung|zahlart|transaktion|autorisierung|terminal|belegnr|bonnr|rechnungsnr|bonuspunkte|treuepunkte)(?:\b|\s|:)/i;
  const discountWords = /(?:^|\b)(?:[a-zäöüß]*rabatt|[a-zäöüß]*coupon|gutschein|ersparnis|gespart|preisnachlass|aktion(?:spreis)?)(?:\b|\s|:)/i;
  const items = [];
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[−–—]/g, "-").replace(/\s+/g, " ").trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/(.+?)\s+(\(?\s*-?\s*\d+[,.]\d{2}\s*-?\s*\)?)\s*(?:€|EUR)?\s*(-)?\s*[AB]?$/i);
    if (!match) continue;
    const quantityMatch = match[1].match(/^(\d+(?:[,.]\d+)?)\s*[xX*]/);
    const name = match[1].replace(/^\d+(?:[,.]\d+)?\s*[xX*]\s*/, "").replace(/\s+[AB]$/i, "").trim();
    const looksLikeCheckoutTotal = checkoutWords.test(name);
    if (looksLikeCheckoutTotal) {
      if (items.length && finalCheckoutWords.test(name)) break;
      continue;
    }
    const amountText = match[2].replace(/\s/g, "");
    const isNegative = Boolean(match[3]) || amountText.startsWith("-") || amountText.endsWith("-") || (amountText.startsWith("(") && amountText.endsWith(")"));
    const amount = Number(amountText.replace(/[-()]/g, "").replace(",", "."));
    if (!Number.isFinite(amount)) continue;
    const isDiscount = discountWords.test(name);
    const looksLikeTaxRate = /^(?:[a-z]\s+)?\d{1,2}[,.]\d+\s*%/i.test(name);
    const looksLikeNumericSummary = /^[a-z]?\s*(?:\d+[,.]\d{1,2}\s*){2,}$/i.test(name);
    const looksLikeCountOnly = /^-?\s*\d+(?:[,.]\d+)?\s*(?:x|×|\*|stk\.?|st[üu]ck|flaschen?|dosen?)\s*$/i.test(name);
    if (name.length < 2 || !/[a-zäöüß]/i.test(name) || nonItemWords.test(name) || (isDiscount && !isNegative) || looksLikeTaxRate || looksLikeNumericSummary || looksLikeCountOnly) continue;
    items.push({ name, quantity: quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : 1, totalPriceCents: Math.round(amount * 100) * (isNegative ? -1 : 1), category: categoryFor(name) });
  }

  return items;
}

function guessStore(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  const known = ["REWE","EDEKA","LIDL","ALDI","PENNY","NETTO","KAUFLAND","GLOBUS","DM","ROSSMANN","NORMA","MÜLLER"];
  const found = known.find((name) => lines.some((line) => line.toUpperCase().includes(name)));
  return found || "";
}

function goTo(view) {
  $$(".view").forEach((element) => element.classList.toggle("active", element.id === `view-${view}`));
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (view === "history") renderHistory(); if (view === "analysis") renderAnalysis(); if (view === "offers") renderOffers();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDraftItems() {
  const container = $("#itemList");
  if (!state.draftItems.length) {
    container.innerHTML = '<div class="empty"><strong>Noch keine Artikel</strong><span>Bon auslesen oder Artikel manuell hinzufügen.</span></div>';
  } else {
    container.innerHTML = state.draftItems.map((item, index) => `<div class="item-row" data-index="${index}"><div class="item-info"><input class="draft-name" value="${esc(item.name)}" aria-label="Artikelname"><small>${esc(item.category)}</small></div><input class="price-input" inputmode="decimal" value="${(item.totalPriceCents / 100).toFixed(2).replace(".", ",")}" aria-label="Preis"><button class="icon-button danger delete-draft" type="button" aria-label="Artikel entfernen">×</button></div>`).join("");
  }
  const total = state.draftItems.reduce((sum, item) => sum + item.totalPriceCents, 0); $("#captureTotal").textContent = money(total);
}

function renderHistory() {
  const rows = [...state.receipts].sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  const latest = rows[0]?.date ? new Date(`${rows[0].date}T12:00:00`).toLocaleDateString("de-DE") : "–";
  $("#historySummary").innerHTML = `<div class="summary-cell"><span>Einkäufe</span><strong>${rows.length}</strong></div><div class="summary-cell"><span>Ausgaben</span><strong>${money(total)}</strong></div><div class="summary-cell"><span>Letzter Bon</span><strong>${latest}</strong></div>`;
  const list = $("#historyList");
  if (!rows.length) { list.innerHTML = '<div class="empty"><strong>Noch kein Einkauf gespeichert</strong><span>Fotografiere deinen ersten Kassenbon und starte deine persönliche Auswertung.</span><button class="button primary compact" data-go="capture" type="button">Ersten Bon erfassen</button></div>'; return; }
  list.innerHTML = rows.map((row) => `<article class="history-card"><div class="history-main"><div class="store-avatar">${row.fileType === "application/pdf" ? "PDF" : "🧾"}</div><div class="history-title"><strong>${esc(row.store)}</strong><span>${new Date(`${row.date}T12:00:00`).toLocaleDateString("de-DE")} · ${row.items.length} Artikel${row.fileType === "application/pdf" ? " · PDF-Bon" : ""}</span></div><strong class="history-total">${money(row.totalCents)}</strong></div><div class="history-items">${row.items.slice(0, 5).map((item) => `<span>${esc(item.name)}</span>`).join("")}${row.items.length > 5 ? `<span>+${row.items.length - 5}</span>` : ""}</div><div class="history-actions"><button class="text-button delete-receipt" data-id="${row.id}" type="button">Einkauf löschen</button></div></article>`).join("");
}

function filteredReceipts() {
  const value = $("#periodSelect").value; if (value === "all") return state.receipts;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(value)); return state.receipts.filter((row) => new Date(`${row.date}T12:00:00`) >= cutoff);
}

function aggregateItems(receipts) {
  const map = new Map();
  receipts.flatMap((row) => row.items).filter((item) => item.totalPriceCents > 0).forEach((item) => { const key = item.name.trim().toLowerCase(); const old = map.get(key) || { name: item.name, quantity: 0, spent: 0, count: 0, lastPrice: 0 }; old.quantity += Number(item.quantity) || 1; old.spent += item.totalPriceCents; old.count += 1; old.lastPrice = item.totalPriceCents; map.set(key, old); });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

function renderAnalysis() {
  const rows = filteredReceipts(); const allItems = rows.flatMap((row) => row.items); const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  $("#metrics").innerHTML = `<div class="metric featured"><span>Ausgaben</span><strong>${money(total)}</strong><small>${rows.length} Einkäufe im Zeitraum</small></div><div class="metric"><span>Ø pro Einkauf</span><strong>${rows.length ? money(Math.round(total / rows.length)) : money(0)}</strong><small>Durchschnitt</small></div><div class="metric"><span>Artikel</span><strong>${allItems.length}</strong><small>Positionen</small></div><div class="metric"><span>Händler</span><strong>${new Set(rows.map((row) => row.store.toLowerCase())).size}</strong><small>verschiedene</small></div>`;
  const categories = new Map(); allItems.forEach((item) => categories.set(item.category, (categories.get(item.category) || 0) + item.totalPriceCents)); const sortedCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  $("#categoryChart").innerHTML = sortedCategories.length ? sortedCategories.map(([name, value]) => `<div><div class="bar-label"><span>${esc(name)}</span><strong>${money(value)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Math.round(value / sortedCategories[0][1] * 100))}%"></div></div></div>`).join("") : '<div class="empty"><strong>Noch keine Daten</strong><span>Die Kategorien erscheinen nach dem ersten Einkauf.</span></div>';
  const top = aggregateItems(rows).slice(0, 8); $("#topItems").innerHTML = top.length ? top.map((item, index) => `<div class="top-row"><span class="rank">${index + 1}</span><div><strong>${esc(item.name)}</strong><small>${item.quantity.toLocaleString("de-DE")}× gekauft</small></div><strong>${money(item.spent)}</strong></div>`).join("") : '<div class="empty"><strong>Noch keine Artikel</strong><span>Deine Favoriten werden automatisch ermittelt.</span></div>';
  const lastBackup = localStorage.getItem("wochenkauf-last-backup");
  const lastBackupAt = localStorage.getItem("wochenkauf-last-backup-at");
  const backupIsOld = lastBackupAt ? Date.now() - new Date(lastBackupAt).getTime() > 7 * 24 * 60 * 60 * 1000 : true;
  const pending = localStorage.getItem("wochenkauf-backup-pending") === "true" || backupIsOld;
  const status = $("#backupStatus");
  $("#backupInfo").textContent = lastBackup ? `Letzte Sicherung: ${lastBackup}` : "Noch keine Datensicherung erstellt.";
  status.classList.toggle("safe", !pending && Boolean(lastBackup));
  status.textContent = !state.receipts.length ? "Noch keine Daten zu sichern" : pending || !lastBackup ? "Sicherung empfohlen" : "Alle Änderungen gesichert";
}

function renderOffers() {
  const items = aggregateItems(state.receipts).slice(0, 9); const container = $("#offerList");
  if (!items.length) { container.innerHTML = '<div class="panel empty"><strong>Noch keine persönlichen Angebotssuchen</strong><span>Nach dem ersten Einkauf erscheinen hier deine häufig gekauften Artikel.</span></div>'; return; }
  container.innerHTML = items.map((item) => { const slug = offerSlug(item.name); return `<article class="offer-card"><div class="offer-card-head"><div><span class="buy-count">${item.quantity.toLocaleString("de-DE")}× gekauft</span><h3>${esc(item.name)}</h3><p>Letzter Positionspreis: ${money(item.lastPrice)}</p></div><span>✨</span></div><div class="offer-links"><a class="offer-link" href="https://www.kaufda.de/Angebote/${encodeURIComponent(slug)}" target="_blank" rel="noopener"><span><strong>kaufDA</strong><small>Prospekte in der Umgebung</small></span><b>↗</b></a><a class="offer-link" href="https://www.marktguru.de/c/${encodeURIComponent(slug)}" target="_blank" rel="noopener"><span><strong>marktguru</strong><small>Aktuelle Händlerangebote</small></span><b>↗</b></a></div></article>`; }).join("");
}

async function loadAll() {
  try { state.receipts = await dbGetAll(); renderHistory(); } catch { showToast("Die gespeicherten Einkäufe konnten nicht geladen werden."); }
}

function resetCapture() {
  state.draftItems = []; state.draftImage = null; state.draftImageName = ""; state.draftFileType = ""; $("#receiptFile").value = ""; $("#uploadFile").value = ""; $("#receiptPreview").src = ""; $("#receiptPreview").classList.add("hidden"); $("#pdfPreview").classList.add("hidden"); $("#uploadPrompt").classList.remove("hidden"); $("#ocrBtn").disabled = true; $("#storeInput").value = ""; $("#dateInput").value = today(); $("#rawText").value = ""; renderDraftItems();
}

function selectImage(file) {
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!file.type.startsWith("image/") && !isPdf) return showToast("Bitte ein Foto oder eine PDF-Datei auswählen.");
  if (file.size > 15 * 1024 * 1024) return showToast("Die Bondatei darf höchstens 15 MB groß sein.");
  state.draftImage = file; state.draftImageName = file.name; state.draftFileType = isPdf ? "application/pdf" : file.type;
  $("#uploadPrompt").classList.add("hidden"); $("#receiptPreview").classList.add("hidden"); $("#pdfPreview").classList.add("hidden");
  if (isPdf) { $("#pdfName").textContent = file.name; $("#pdfInfo").textContent = "Bereit zum Auslesen"; $("#pdfPreview").classList.remove("hidden"); }
  else { const preview = $("#receiptPreview"); preview.src = URL.createObjectURL(file); preview.classList.remove("hidden"); }
  $("#ocrBtn").disabled = false;
}

async function runOcr() {
  if (!state.draftImage) return; const button = $("#ocrBtn"); button.disabled = true; button.textContent = "Bon wird gelesen …"; $("#ocrProgressWrap").classList.remove("hidden");
  try {
    if (!window.Tesseract) await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
    let text = "";
    if (state.draftFileType === "application/pdf") {
      const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
      const pdf = await pdfjs.getDocument({ data: await state.draftImage.arrayBuffer() }).promise;
      const pageCount = Math.min(pdf.numPages, 10); $("#pdfInfo").textContent = `${pdf.numPages} Seite${pdf.numPages === 1 ? "" : "n"} · ${pageCount > 1 ? "werden" : "wird"} ausgewertet`;
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale: 2 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const result = await window.Tesseract.recognize(canvas, "deu", { logger: (message) => { if (typeof message.progress === "number") { const value = Math.round(((pageNumber - 1 + message.progress) / pageCount) * 100); $("#ocrProgress").style.width = `${value}%`; $("#ocrPercent").textContent = `${value} %`; } } });
        text += `${result.data.text.trim()}\n`;
      }
      if (pdf.numPages > 10) showToast("Die ersten 10 PDF-Seiten wurden ausgewertet.");
    } else {
      const result = await window.Tesseract.recognize(state.draftImage, "deu", { logger: (message) => { if (typeof message.progress === "number") { const value = Math.round(message.progress * 100); $("#ocrProgress").style.width = `${value}%`; $("#ocrPercent").textContent = `${value} %`; } } });
      text = result.data.text.trim();
    }
    $("#rawText").value = text.trim(); state.draftItems = parseReceiptText(text); if (!$("#storeInput").value) $("#storeInput").value = guessStore(text); renderDraftItems(); showToast(`${state.draftItems.length} Artikel erkannt – bitte kurz prüfen.`);
  } catch { showToast("Texterkennung nicht verfügbar. Du kannst Artikel manuell hinzufügen."); }
  finally { button.disabled = false; button.textContent = "Bon erneut auslesen"; $("#ocrProgressWrap").classList.add("hidden"); }
}

async function saveReceipt() {
  const store = $("#storeInput").value.trim(); const date = $("#dateInput").value;
  if (!store) return showToast("Bitte den Händler eintragen."); if (!date) return showToast("Bitte das Einkaufsdatum auswählen."); if (!state.draftItems.length) return showToast("Bitte mindestens einen Artikel hinzufügen.");
  const row = { store, date, totalCents: state.draftItems.reduce((sum, item) => sum + item.totalPriceCents, 0), items: state.draftItems, image: state.draftImage, imageName: state.draftImageName, fileType: state.draftFileType, rawText: $("#rawText").value, createdAt: new Date().toISOString() };
  try { row.id = await dbAdd(row); state.receipts.push(row); localStorage.setItem("wochenkauf-backup-pending", "true"); resetCapture(); showToast("Einkauf gespeichert. Datensicherung empfohlen."); goTo("history"); } catch { showToast("Der Einkauf konnte nicht gespeichert werden."); }
}

function fileToDataUrl(blob) { return new Promise((resolve, reject) => { if (!blob) return resolve(null); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }); }
function dataUrlToBlob(dataUrl) { if (!dataUrl) return null; const parts = dataUrl.split(","); const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg"; const bytes = atob(parts[1]); const array = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i); return new Blob([array], { type: mime }); }

async function exportBackup() {
  try {
    const receipts = await Promise.all(state.receipts.map(async (row) => ({ ...row, image: await fileToDataUrl(row.image) })));
    const payload = { app: "Wocheneinkauf", version: 2, exportedAt: new Date().toISOString(), receipts, settings: { location: $("#locationInput").value, theme: document.documentElement.dataset.theme } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Wocheneinkauf-Sicherung-${today()}.json`; link.click(); URL.revokeObjectURL(link.href);
    const stamp = new Date().toLocaleString("de-DE"); localStorage.setItem("wochenkauf-last-backup", stamp); localStorage.setItem("wochenkauf-last-backup-at", new Date().toISOString()); localStorage.setItem("wochenkauf-backup-pending", "false"); renderAnalysis(); showToast("Vollständige Sicherung wurde erstellt.");
  } catch { showToast("Datensicherung konnte nicht erstellt werden."); }
}

async function importBackup(file) {
  try {
    const payload = JSON.parse(await file.text()); if (payload.app !== "Wocheneinkauf" || !Array.isArray(payload.receipts)) throw new Error("invalid");
    const rows = payload.receipts.map((row) => ({ ...row, image: dataUrlToBlob(row.image) })); await dbClearAndImport(rows); state.receipts = await dbGetAll(); if (payload.settings?.location) { $("#locationInput").value = payload.settings.location; localStorage.setItem("wochenkauf-location", payload.settings.location); } if (payload.settings?.theme) applyTheme(payload.settings.theme); localStorage.setItem("wochenkauf-backup-pending", "false"); localStorage.setItem("wochenkauf-last-backup", new Date().toLocaleString("de-DE")); localStorage.setItem("wochenkauf-last-backup-at", new Date().toISOString()); renderAnalysis(); showToast(`${rows.length} Einkäufe einschließlich Bondateien wiederhergestellt.`);
  } catch { showToast("Die Sicherungsdatei ist ungültig oder beschädigt."); }
}

function applyTheme(theme) {
  const selected = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selected; localStorage.setItem("wochenkauf-theme", selected);
  $("#themeBtn").textContent = selected === "dark" ? "☀" : "☾";
  $("#themeBtn").title = selected === "dark" ? "Light Mode" : "Dark Mode";
  document.querySelector('meta[name="theme-color"]').content = selected === "dark" ? "#080808" : "#155eef";
}

function bindEvents() {
  $$(".nav-btn").forEach((button) => button.addEventListener("click", () => goTo(button.dataset.view)));
  document.addEventListener("click", async (event) => {
    const go = event.target.closest("[data-go]"); if (go) goTo(go.dataset.go);
    const remove = event.target.closest(".delete-receipt"); if (remove && confirm("Diesen Einkauf endgültig löschen?")) { await dbDelete(Number(remove.dataset.id)); state.receipts = state.receipts.filter((row) => row.id !== Number(remove.dataset.id)); localStorage.setItem("wochenkauf-backup-pending", "true"); renderHistory(); showToast("Einkauf gelöscht. Neue Sicherung empfohlen."); }
  });
  $("#dropZone").addEventListener("click", () => $("#receiptFile").click()); $("#dropZone").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") $("#receiptFile").click(); });
  $("#dropZone").addEventListener("dragover", (event) => event.preventDefault()); $("#dropZone").addEventListener("drop", (event) => { event.preventDefault(); selectImage(event.dataTransfer.files[0]); });
  $("#chooseFileBtn").addEventListener("click", () => $("#receiptFile").click()); $("#receiptFile").addEventListener("change", (event) => selectImage(event.target.files[0])); $("#chooseUploadBtn").addEventListener("click", () => $("#uploadFile").click()); $("#uploadFile").addEventListener("change", (event) => selectImage(event.target.files[0])); $("#ocrBtn").addEventListener("click", runOcr);
  $("#parseBtn").addEventListener("click", () => { state.draftItems = parseReceiptText($("#rawText").value); renderDraftItems(); showToast(`${state.draftItems.length} Artikel übernommen.`); });
  $("#itemList").addEventListener("input", (event) => { const row = event.target.closest(".item-row"); if (!row) return; const index = Number(row.dataset.index); if (event.target.classList.contains("draft-name")) { state.draftItems[index].name = event.target.value; state.draftItems[index].category = categoryFor(event.target.value); row.querySelector("small").textContent = state.draftItems[index].category; } if (event.target.classList.contains("price-input")) state.draftItems[index].totalPriceCents = Math.round((Number(event.target.value.replace(",", ".")) || 0) * 100); $("#captureTotal").textContent = money(state.draftItems.reduce((sum, item) => sum + item.totalPriceCents, 0)); });
  $("#itemList").addEventListener("click", (event) => { const button = event.target.closest(".delete-draft"); if (!button) return; const index = Number(button.closest(".item-row").dataset.index); state.draftItems.splice(index, 1); renderDraftItems(); });
  $("#addItemBtn").addEventListener("click", () => { $("#newItemName").value = ""; $("#newItemQty").value = "1"; $("#newItemPrice").value = ""; $("#itemDialog").showModal(); });
  $("#closeItemDialog").addEventListener("click", () => $("#itemDialog").close());
  $("#itemForm").addEventListener("submit", (event) => { event.preventDefault(); const name = $("#newItemName").value.trim(); if (!name) return; state.draftItems.push({ name, quantity: Number($("#newItemQty").value) || 1, totalPriceCents: Math.round((Number($("#newItemPrice").value) || 0) * 100), category: categoryFor(name) }); $("#itemDialog").close(); renderDraftItems(); });
  $("#saveBtn").addEventListener("click", saveReceipt); $("#periodSelect").addEventListener("change", renderAnalysis); $("#exportBtn").addEventListener("click", exportBackup); $("#importBtn").addEventListener("click", () => $("#importFile").click()); $("#importFile").addEventListener("change", (event) => event.target.files[0] && importBackup(event.target.files[0]));
  const savedLocation = localStorage.getItem("wochenkauf-location"); if (savedLocation) $("#locationInput").value = savedLocation; $("#locationInput").addEventListener("change", (event) => localStorage.setItem("wochenkauf-location", event.target.value.trim()));
  $("#themeBtn").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); state.installPrompt = event; });
  $("#installBtn").addEventListener("click", async () => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) return showToast("Wocheneinkauf ist bereits als App installiert.");
    if (state.installPrompt) { state.installPrompt.prompt(); const result = await state.installPrompt.userChoice; state.installPrompt = null; if (result.outcome === "accepted") $("#installBtn").classList.add("hidden"); return; }
    $("#installDialog").showModal();
  });
  $("#closeInstallDialog").addEventListener("click", () => $("#installDialog").close());
  $("#closeInstallDialogBottom").addEventListener("click", () => $("#installDialog").close());
  window.addEventListener("appinstalled", () => { $("#installBtn").classList.add("hidden"); showToast("Wocheneinkauf wurde installiert."); });
}

async function init() {
  $("#dateInput").value = today(); bindEvents(); applyTheme(document.documentElement.dataset.theme); renderDraftItems(); await loadAll();
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) $("#installBtn").classList.add("hidden");
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}

init();
