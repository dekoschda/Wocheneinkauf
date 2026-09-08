"use strict";

const DB_NAME = "wochenkauf-pwa";
const DB_VERSION = 1;
const STORE = "receipts";
const CATEGORY_WORDS = {
  "Rabatte": ["rabatt","coupon","gutschein","ersparnis","gespart","preisnachlass","aktion"],
  "Pfand & Rückgabe": ["pfand","leergut","flaschenrückgabe","dosenrückgabe"],
  "Baby & Kind": ["windel","babynahrung","babybrei","folgemilch","feuchttücher","schnuller","baby"],
  "Tierbedarf": ["tierfutter","hundefutter","katzenfutter","katzenstreu","leckerlis","vogelstreu","heimtier"],
  "Körperpflege": ["shampoo","duschgel","zahnpasta","zahnbürste","deo","deodorant","rasierer","creme","lotion","kosmetik","tampon","binde","seife"],
  "Reinigung & Waschen": ["waschmittel","weichspüler","spülmittel","reiniger","putzmittel","entkalker","geschirrspül","spülmaschinen","fleckenentferner"],
  "Haushalt & Verbrauchsartikel": ["küchenrolle","küchenpapier","toilettenpapier","taschentücher","backpapier","alufolie","frischhaltefolie","müllbeutel","serviette","schwamm","batterie","kerze"],
  "Vegetarisch & Vegan": ["tofu","vegan","vegetar","fleischersatz","pflanzendrink","haferdrink","sojadrink","mandeldrink","hafermilch","sojamilch","mandelmilch","seitan","tempeh"],
  "Obst & Gemüse": ["apfel","äpfel","banane","tomate","gurke","salat","kartoffel","zwiebel","paprika","beeren","gemüse","obst","karotte","möhre","zucchini","brokkoli","blumenkohl","pilz","orange","mandarine","zitrone","traube","birne"],
  "Milchprodukte & Eier": ["milch","käse","joghurt","quark","butter","sahne","skyr","mozzarella","frischkäse","schmand","kefir","pudding","ei ","eier"],
  "Brot & Backwaren": ["brot","brötchen","toast","baguette","croissant","brezel","backware","kuchen","torte"],
  "Frühstück": ["müsli","cornflakes","haferflocken","marmelade","honig","kaffee","espresso","kakao","tee ","schwarztee","grüntee","kräutertee"],
  "Fleisch & Wurst": ["hähnchen","fleisch","hack","wurst","schinken","salami","schnitzel","steak","bratwurst","pute","rind","schwein","speck"],
  "Fisch & Meeresfrüchte": ["lachs","fisch","thunfisch","garnelen","hering","makrele","forelle","meeresfrüchte","shrimps"],
  "Tiefkühlprodukte": ["tk ","tiefkühl","tiefgefroren","eiscreme","speiseeis","fischstäbchen"],
  "Fertiggerichte": ["fertiggericht","instant","mikrowelle","dosensuppe","tütensuppe","ravioli","lasagne","pizza","flammenkuchen","nudelsalat","kartoffelsalat"],
  "Nudeln, Reis & Getreide": ["nudel","spaghetti","penne","reis","couscous","bulgur","quinoa","getreide","grieß"],
  "Saucen & Gewürze": ["ketchup","mayonnaise","senf","sauce","soße","gewürz","salz","pfeffer","kräuter","brühe","dressing","essig"],
  "Backen & Zutaten": ["mehl","zucker","backpulver","hefe","vanillezucker","speisestärke","kakaopulver","kuvertüre","tortenguss","backmischung"],
  "Konserven & Vorräte": ["konserve","dose ","dosentomate","bohnen","linsen","kichererbse","mais","öl","olivenöl","sonnenblumenöl","passata","tomatenmark"],
  "Süßigkeiten & Snacks": ["schokolade","chips","keks","bonbon","gummi","fruchtgummi","nüsse","erdnüsse","cracker","popcorn","riegel"],
  "Alkoholfreie Getränke": ["alkoholfrei","wasser","saft","cola","limonade","getränk","schorle","energy","eistee","smoothie"],
  "Alkoholische Getränke": ["bier","wein","sekt","prosecco","spirituose","whisky","whiskey","wodka","vodka","likör","gin","rum"],
};
const CATEGORY_NAMES = [...Object.keys(CATEGORY_WORDS), "Nicht zugeordnet"];

const state = { receipts: [], draftItems: [], draftImage: null, draftImageName: "", draftFileType: "", installPrompt: null, activeReceiptId: null, receiptObjectUrl: "" };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (cents) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format((Number(cents) || 0) / 100);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const today = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const itemKey = (name) => String(name || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9äöüß]+/g, " ").trim();
const getCategoryRules = () => { try { return JSON.parse(localStorage.getItem("wochenkauf-category-rules") || "{}"); } catch { return {}; } };
const categoryFor = (name) => { const lower = String(name || "").toLowerCase().trim(); const learned = getCategoryRules()[itemKey(name)]; if (CATEGORY_NAMES.includes(learned)) return learned; const matches = Object.entries(CATEGORY_WORDS).flatMap(([category, words]) => words.filter((word) => lower === word.trim() || lower.includes(word)).map((word) => ({ category, length: word.trim().length }))).sort((a, b) => b.length - a.length); return matches[0]?.category || "Nicht zugeordnet"; };
const categoryOptions = (selected) => CATEGORY_NAMES.map((name) => `<option value="${esc(name)}"${name === selected ? " selected" : ""}>${esc(name)}</option>`).join("");
function rememberCategory(name, category) { if (!name || !category || category === "Nicht zugeordnet") return; const rules = getCategoryRules(); rules[itemKey(name)] = category; localStorage.setItem("wochenkauf-category-rules", JSON.stringify(rules)); }
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
async function dbPut(value) {
  const db = await openDb();
  return new Promise((resolve, reject) => { const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(value); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
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
    container.innerHTML = state.draftItems.map((item, index) => `<div class="item-row" data-index="${index}"><div class="item-info"><input class="draft-name" value="${esc(item.name)}" aria-label="Artikelname"><select class="draft-category" aria-label="Kategorie für ${esc(item.name)}">${categoryOptions(item.category || categoryFor(item.name))}</select></div><input class="price-input" inputmode="decimal" value="${(item.totalPriceCents / 100).toFixed(2).replace(".", ",")}" aria-label="Preis"><button class="icon-button danger delete-draft" type="button" aria-label="Artikel entfernen">×</button></div>`).join("");
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
  list.innerHTML = rows.map((row) => { const products = row.items.filter((item) => item.totalPriceCents > 0 && !["Rabatte", "Pfand & Rückgabe"].includes(item.category)); return `<article class="history-card"><div class="history-main"><div class="store-avatar">${row.fileType === "application/pdf" ? "PDF" : "🧾"}</div><div class="history-title"><strong>${esc(row.store)}</strong><span>${new Date(`${row.date}T12:00:00`).toLocaleDateString("de-DE")} · ${products.length} Artikel${row.fileType === "application/pdf" ? " · PDF-Bon" : ""}</span></div><strong class="history-total">${money(row.totalCents)}</strong></div><div class="history-items">${row.items.slice(0, 5).map((item) => `<span>${esc(item.name)}</span>`).join("")}${row.items.length > 5 ? `<span>+${row.items.length - 5}</span>` : ""}</div><div class="history-actions"><button class="text-button view-receipt" data-id="${row.id}" type="button">Bon ansehen</button><button class="text-button delete-receipt" data-id="${row.id}" type="button">Einkauf löschen</button></div></article>`; }).join("");
}

function receiptDate(row) { return new Date(`${row.date}T12:00:00`); }
function periodData() {
  const value = $("#periodSelect").value; const now = new Date(); let start = null;
  if (value === "week") { start = new Date(now); start.setHours(0, 0, 0, 0); const day = (start.getDay() + 6) % 7; start.setDate(start.getDate() - day); }
  if (value === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (value === "90") { start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 89); }
  if (value === "year") start = new Date(now.getFullYear(), 0, 1);
  if (!start) return { value, current: state.receipts, previous: [], start: null };
  const elapsed = now.getTime() - start.getTime(); const previousEnd = new Date(start.getTime() - 1); const previousStart = new Date(previousEnd.getTime() - elapsed);
  return { value, start, current: state.receipts.filter((row) => receiptDate(row) >= start && receiptDate(row) <= now), previous: state.receipts.filter((row) => receiptDate(row) >= previousStart && receiptDate(row) <= previousEnd) };
}

function likelySameItem(a, b) {
  if (a === b) return true; if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  if ((a.match(/\d+/g) || []).join("|") !== (b.match(/\d+/g) || []).join("|")) return false;
  if (a.length === b.length) { const differences = [...a].filter((char, index) => char !== b[index]).length; if (differences <= 1) return true; for (let i = 0; i < a.length - 1; i++) if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(0, i) === b.slice(0, i) && a.slice(i + 2) === b.slice(i + 2)) return true; return false; }
  const shorter = a.length < b.length ? a : b; const longer = a.length < b.length ? b : a; let offset = 0; for (let i = 0; i < longer.length; i++) { if (shorter[i - offset] !== longer[i] && ++offset > 1) return false; } return true;
}

function aggregateItems(receipts) {
  const map = new Map();
  [...receipts].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((row) => row.items.filter((item) => item.totalPriceCents > 0 && !["Rabatte", "Pfand & Rückgabe"].includes(item.category)).forEach((item) => {
    const rawKey = itemKey(item.name); const key = [...map.keys()].find((known) => likelySameItem(known, rawKey)) || rawKey; const quantity = Math.max(Number(item.quantity) || 1, 0.01); const unitPrice = Math.round(item.totalPriceCents / quantity); const old = map.get(key) || { name: item.name, quantity: 0, spent: 0, count: 0, firstPrice: unitPrice, lastPrice: unitPrice, minPrice: unitPrice, minStore: row.store, lastStore: row.store };
    old.quantity += quantity; old.spent += item.totalPriceCents; old.count += 1; old.lastPrice = unitPrice; old.lastStore = row.store; if (unitPrice < old.minPrice) { old.minPrice = unitPrice; old.minStore = row.store; } map.set(key, old);
  }));
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

function renderTrend(rows, periodValue) {
  const buckets = new Map();
  [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((row) => {
    const date = receiptDate(row); let key; let label;
    if (periodValue === "week") { key = row.date; label = date.toLocaleDateString("de-DE", { weekday: "short" }); }
    else if (["month", "90"].includes(periodValue)) { const monday = new Date(date); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); key = monday.toISOString().slice(0, 10); label = monday.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }); }
    else { key = row.date.slice(0, 7); label = date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }); }
    const entry = buckets.get(key) || { key, label, value: 0 }; entry.value += row.totalCents; buckets.set(key, entry);
  });
  const data = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)); const container = $("#spendingTrend");
  if (!data.length) { container.innerHTML = '<div class="empty"><strong>Noch kein Verlauf</strong><span>Nach gespeicherten Einkäufen erscheint hier die Entwicklung deiner Ausgaben.</span></div>'; return; }
  const width = 640; const height = 220; const padX = 34; const padY = 24; const min = Math.min(0, ...data.map((point) => point.value)); const max = Math.max(0, ...data.map((point) => point.value)); const range = max - min || 1;
  const points = data.map((point, index) => ({ ...point, x: data.length === 1 ? width / 2 : padX + index * (width - padX * 2) / (data.length - 1), y: padY + (max - point.value) * (height - padY * 2) / range }));
  const zeroY = padY + max * (height - padY * 2) / range; const line = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  container.innerHTML = `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ausgabenverlauf"><line x1="${padX}" y1="${zeroY}" x2="${width - padX}" y2="${zeroY}" class="trend-zero"></line><polyline points="${line}" class="trend-line"></polyline>${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" class="trend-point"><title>${esc(point.label)}: ${money(point.value)}</title></circle>`).join("")}<text x="${padX}" y="${height - 3}" class="trend-label">${esc(data[0].label)}</text><text x="${width - padX}" y="${height - 3}" text-anchor="end" class="trend-label">${esc(data.at(-1).label)}</text></svg><div class="trend-summary"><span>${esc(data.at(-1).label)}</span><strong>${money(data.at(-1).value)}</strong></div>`;
}

function renderAnalysis() {
  const period = periodData(); const rows = period.current; const allItems = rows.flatMap((row) => row.items); const total = rows.reduce((sum, row) => sum + row.totalCents, 0); const previousTotal = period.previous.reduce((sum, row) => sum + row.totalCents, 0);
  const discounts = allItems.filter((item) => item.category === "Rabatte" && item.totalPriceCents < 0).reduce((sum, item) => sum + Math.abs(item.totalPriceCents), 0); const pfandPaid = allItems.filter((item) => item.category === "Pfand & Rückgabe" && item.totalPriceCents > 0).reduce((sum, item) => sum + item.totalPriceCents, 0); const pfandReturned = allItems.filter((item) => item.category === "Pfand & Rückgabe" && item.totalPriceCents < 0).reduce((sum, item) => sum + Math.abs(item.totalPriceCents), 0);
  const comparison = period.start ? previousTotal ? `${Math.abs(Math.round((total - previousTotal) / previousTotal * 100))} % ${total <= previousTotal ? "weniger" : "mehr"} als zuvor` : "Kein Vergleichswert im vorherigen Zeitraum" : "Gesamter gespeicherter Zeitraum";
  $("#metrics").innerHTML = `<div class="metric featured"><span>Ausgaben nach Abzügen</span><strong>${money(total)}</strong><small>${comparison}</small></div><div class="metric"><span>Einkäufe</span><strong>${rows.length}</strong><small>${new Set(rows.map((row) => row.store.toLowerCase())).size} Händler</small></div><div class="metric"><span>Ø pro Einkauf</span><strong>${rows.length ? money(Math.round(total / rows.length)) : money(0)}</strong><small>Durchschnitt</small></div><div class="metric"><span>Abzüge</span><strong>${money(discounts + pfandReturned)}</strong><small>Rabatte und Pfandrückgabe</small></div>`;
  renderTrend(rows, period.value);
  const productItems = allItems.filter((item) => item.totalPriceCents > 0 && !["Rabatte", "Pfand & Rückgabe"].includes(item.category)); const categories = new Map(); productItems.forEach((item) => { const category = item.category === "Sonstiges" || !item.category ? categoryFor(item.name) : item.category; categories.set(category, (categories.get(category) || 0) + item.totalPriceCents); }); const sortedCategories = [...categories.entries()].sort((a, b) => b[1] - a[1]); const maxCategory = sortedCategories[0]?.[1] || 1;
  $("#categoryChart").innerHTML = sortedCategories.length ? sortedCategories.map(([name, value]) => `<div><div class="bar-label"><span>${esc(name)}</span><strong>${money(value)}</strong></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Math.round(value / maxCategory * 100))}%"></div></div></div>`).join("") : '<div class="empty"><strong>Noch keine Wareneinkäufe</strong><span>Rabatte und Pfand werden getrennt ausgewertet.</span></div>';
  $("#adjustmentSummary").innerHTML = `<div class="adjustment-card"><span>Rabatte und Gutscheine</span><strong>− ${money(discounts)}</strong><small>vom Einkaufswert abgezogen</small></div><div class="adjustment-card"><span>Pfand bezahlt</span><strong>${money(pfandPaid)}</strong><small>bei gekauften Getränken</small></div><div class="adjustment-card"><span>Pfand zurück</span><strong>− ${money(pfandReturned)}</strong><small>durch Leergutrückgabe</small></div><div class="adjustment-card"><span>Pfandsaldo</span><strong>${money(pfandPaid - pfandReturned)}</strong><small>bezahlt minus zurückerhalten</small></div>`;
  const top = aggregateItems(rows).slice(0, 8); $("#topItems").innerHTML = top.length ? top.map((item, index) => `<div class="top-row"><span class="rank">${index + 1}</span><div><strong>${esc(item.name)}</strong><small>${item.quantity.toLocaleString("de-DE")}× · Ø ${money(Math.round(item.spent / item.quantity))} · günstigster Preis ${money(item.minPrice)} bei ${esc(item.minStore)}</small></div><strong>${money(item.lastPrice)}</strong></div>`).join("") : '<div class="empty"><strong>Noch keine Artikel</strong><span>Deine Favoriten werden automatisch ermittelt.</span></div>';
  const priceItems = aggregateItems(rows).filter((item) => item.count > 1).slice(0, 6); $("#priceInsights").innerHTML = priceItems.length ? priceItems.map((item) => { const change = item.firstPrice ? Math.round((item.lastPrice - item.firstPrice) / item.firstPrice * 100) : 0; return `<div class="price-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.lastStore)} · zuletzt ${money(item.lastPrice)}</small></div><span class="${change > 0 ? "price-up" : change < 0 ? "price-down" : ""}">${change > 0 ? "+" : ""}${change} %</span></div>`; }).join("") : '<div class="empty"><strong>Noch kein Preisvergleich</strong><span>Ein Artikel muss mindestens zweimal gekauft worden sein.</span></div>';
  const unassigned = new Map(); productItems.filter((item) => (item.category === "Sonstiges" || item.category === "Nicht zugeordnet" || !item.category) && categoryFor(item.name) === "Nicht zugeordnet").forEach((item) => { const key = itemKey(item.name); const entry = unassigned.get(key) || { name: item.name, count: 0 }; entry.count += 1; unassigned.set(key, entry); });
  $("#unassignedItems").innerHTML = unassigned.size ? [...unassigned.entries()].map(([key, item]) => `<div class="unassigned-row"><div><strong>${esc(item.name)}</strong><small>${item.count} Position${item.count === 1 ? "" : "en"}</small></div><select class="unassigned-category" data-key="${esc(key)}" aria-label="Kategorie für ${esc(item.name)}"><option value="">Kategorie wählen</option>${CATEGORY_NAMES.filter((name) => name !== "Nicht zugeordnet").map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}</select></div>`).join("") : '<div class="empty compact-empty"><strong>Alles zugeordnet</strong><span>Es gibt im gewählten Zeitraum keine ungeklärten Artikel.</span></div>';
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
  container.innerHTML = items.map((item) => { const slug = offerSlug(item.name); return `<article class="offer-card"><div class="offer-card-head"><div><span class="buy-count">${item.quantity.toLocaleString("de-DE")}× gekauft</span><h3>${esc(item.name)}</h3><p>Zuletzt ${money(item.lastPrice)} bei ${esc(item.lastStore)} · bisher günstigster Preis ${money(item.minPrice)}</p></div><span>✨</span></div><div class="offer-links"><a class="offer-link" href="https://www.kaufda.de/Angebote/${encodeURIComponent(slug)}" target="_blank" rel="noopener"><span><strong>kaufDA</strong><small>Mit deinem letzten Preis vergleichen</small></span><b>↗</b></a><a class="offer-link" href="https://www.marktguru.de/c/${encodeURIComponent(slug)}" target="_blank" rel="noopener"><span><strong>marktguru</strong><small>Aktuelle Händlerangebote</small></span><b>↗</b></a></div></article>`; }).join("");
}

function receiptEditorRows(items) {
  return items.map((item) => `<div class="receipt-edit-row"><div class="receipt-edit-main"><input class="receipt-item-name" value="${esc(item.name)}" aria-label="Artikelname"><select class="receipt-item-category" aria-label="Kategorie">${categoryOptions(item.category || categoryFor(item.name))}</select></div><input class="receipt-item-quantity" type="number" min="0.01" step="0.01" value="${Number(item.quantity) || 1}" aria-label="Menge"><input class="receipt-item-price" inputmode="decimal" value="${(item.totalPriceCents / 100).toFixed(2).replace(".", ",")}" aria-label="Preis"><button class="icon-button danger delete-receipt-item" type="button" aria-label="Artikel entfernen">×</button></div>`).join("");
}

function closeReceiptDialog() {
  if (state.receiptObjectUrl) URL.revokeObjectURL(state.receiptObjectUrl);
  state.receiptObjectUrl = ""; state.activeReceiptId = null; $("#receiptDialog").close();
}

async function renderStoredPdf(file, viewer, fallbackUrl) {
  try {
    const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs"; const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; const pages = document.createElement("div"); pages.className = "stored-pdf-pages";
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 5); pageNumber++) { const page = await pdf.getPage(pageNumber); const viewport = page.getViewport({ scale: 1.35 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height; await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise; pages.appendChild(canvas); }
    viewer.innerHTML = ""; viewer.appendChild(pages); if (pdf.numPages > 5) viewer.insertAdjacentHTML("beforeend", `<p class="privacy-note">Die Vorschau zeigt die ersten 5 von ${pdf.numPages} Seiten. Über „Originalbon herunterladen“ ist die vollständige PDF verfügbar.</p>`);
  } catch { viewer.innerHTML = `<iframe class="stored-pdf" src="${fallbackUrl}" title="Gespeicherter Kassenbon als PDF"></iframe>`; }
}

async function openReceiptDialog(id) {
  const row = state.receipts.find((receipt) => receipt.id === Number(id)); if (!row) return;
  state.activeReceiptId = row.id; $("#editReceiptStore").value = row.store; $("#editReceiptDate").value = row.date; $("#receiptEditorItems").innerHTML = receiptEditorRows(row.items);
  const viewer = $("#storedReceiptViewer"); const download = $("#downloadReceiptBtn"); viewer.innerHTML = ""; download.classList.add("hidden");
  if (row.image instanceof Blob) {
    state.receiptObjectUrl = URL.createObjectURL(row.image); download.classList.remove("hidden");
    if (row.fileType === "application/pdf" || row.image.type === "application/pdf") viewer.innerHTML = '<div class="empty"><strong>PDF wird geöffnet …</strong><span>Die Seiten werden für die Handyansicht vorbereitet.</span></div>';
    else viewer.innerHTML = `<img class="stored-image" src="${state.receiptObjectUrl}" alt="Gespeicherter Kassenbon">`;
  } else viewer.innerHTML = '<div class="empty"><strong>Keine Bondatei vorhanden</strong><span>Bei diesem älteren Eintrag wurde nur die Artikelliste gespeichert.</span></div>';
  $("#receiptDialog").showModal();
  if (row.image instanceof Blob && (row.fileType === "application/pdf" || row.image.type === "application/pdf")) await renderStoredPdf(row.image, viewer, state.receiptObjectUrl);
}

function addReceiptEditorItem() {
  const wrapper = document.createElement("div"); wrapper.innerHTML = receiptEditorRows([{ name: "", quantity: 1, totalPriceCents: 0, category: "Nicht zugeordnet" }]); $("#receiptEditorItems").appendChild(wrapper.firstElementChild);
}

async function saveReceiptEdits() {
  const row = state.receipts.find((receipt) => receipt.id === state.activeReceiptId); if (!row) return;
  const items = [...$("#receiptEditorItems").querySelectorAll(".receipt-edit-row")].map((element) => { const name = element.querySelector(".receipt-item-name").value.trim(); const category = element.querySelector(".receipt-item-category").value; const quantity = Math.max(Number(element.querySelector(".receipt-item-quantity").value) || 1, 0.01); const totalPriceCents = Math.round((Number(element.querySelector(".receipt-item-price").value.replace(",", ".")) || 0) * 100); if (name) rememberCategory(name, category); return { name, category, quantity, totalPriceCents }; }).filter((item) => item.name);
  const store = $("#editReceiptStore").value.trim(); const date = $("#editReceiptDate").value; if (!store || !date || !items.length) return showToast("Bitte Händler, Datum und mindestens einen Artikel eintragen.");
  row.store = store; row.date = date; row.items = items; row.totalCents = items.reduce((sum, item) => sum + item.totalPriceCents, 0); row.updatedAt = new Date().toISOString();
  try { await dbPut(row); localStorage.setItem("wochenkauf-backup-pending", "true"); closeReceiptDialog(); renderHistory(); showToast("Einkauf wurde aktualisiert."); } catch { showToast("Die Änderungen konnten nicht gespeichert werden."); }
}

function downloadStoredReceipt() {
  const row = state.receipts.find((receipt) => receipt.id === state.activeReceiptId); if (!row?.image || !state.receiptObjectUrl) return;
  const link = document.createElement("a"); link.href = state.receiptObjectUrl; link.download = row.imageName || `Bon-${row.date}.${row.fileType === "application/pdf" ? "pdf" : "jpg"}`; link.click();
}

async function loadAll() {
  try {
    state.receipts = await dbGetAll(); const changed = [];
    state.receipts.forEach((row) => { let rowChanged = false; row.items = Array.isArray(row.items) ? row.items : []; row.items.forEach((item) => { if (!item.category || !CATEGORY_NAMES.includes(item.category)) { item.category = categoryFor(item.name); rowChanged = true; } }); if (rowChanged) { row.totalCents = row.items.reduce((sum, item) => sum + item.totalPriceCents, 0); changed.push(dbPut(row)); } });
    if (changed.length) await Promise.all(changed); renderHistory();
  } catch { showToast("Die gespeicherten Einkäufe konnten nicht geladen werden."); }
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
    const payload = { app: "Wocheneinkauf", version: 3, exportedAt: new Date().toISOString(), receipts, settings: { location: $("#locationInput").value, theme: document.documentElement.dataset.theme, categoryRules: getCategoryRules() } };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Wocheneinkauf-Sicherung-${today()}.json`; link.click(); URL.revokeObjectURL(link.href);
    const stamp = new Date().toLocaleString("de-DE"); localStorage.setItem("wochenkauf-last-backup", stamp); localStorage.setItem("wochenkauf-last-backup-at", new Date().toISOString()); localStorage.setItem("wochenkauf-backup-pending", "false"); renderAnalysis(); showToast("Vollständige Sicherung wurde erstellt.");
  } catch { showToast("Datensicherung konnte nicht erstellt werden."); }
}

async function importBackup(file) {
  try {
    const payload = JSON.parse(await file.text()); if (payload.app !== "Wocheneinkauf" || !Array.isArray(payload.receipts)) throw new Error("invalid");
    if (payload.settings?.categoryRules) localStorage.setItem("wochenkauf-category-rules", JSON.stringify(payload.settings.categoryRules));
    const rows = payload.receipts.map((row) => ({ ...row, items: (row.items || []).map((item) => ({ ...item, category: !item.category || !CATEGORY_NAMES.includes(item.category) ? categoryFor(item.name) : item.category })), image: dataUrlToBlob(row.image) }));
    rows.forEach((row) => { row.totalCents = row.items.reduce((sum, item) => sum + item.totalPriceCents, 0); }); await dbClearAndImport(rows); state.receipts = await dbGetAll();
    if (payload.settings?.location) { $("#locationInput").value = payload.settings.location; localStorage.setItem("wochenkauf-location", payload.settings.location); } if (payload.settings?.theme) applyTheme(payload.settings.theme); localStorage.setItem("wochenkauf-backup-pending", "false"); localStorage.setItem("wochenkauf-last-backup", new Date().toLocaleString("de-DE")); localStorage.setItem("wochenkauf-last-backup-at", new Date().toISOString()); renderAnalysis(); renderHistory(); showToast(`${rows.length} Einkäufe einschließlich Bondateien wiederhergestellt.`);
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
    const view = event.target.closest(".view-receipt"); if (view) openReceiptDialog(view.dataset.id);
    const remove = event.target.closest(".delete-receipt"); if (remove && confirm("Diesen Einkauf endgültig löschen?")) { await dbDelete(Number(remove.dataset.id)); state.receipts = state.receipts.filter((row) => row.id !== Number(remove.dataset.id)); localStorage.setItem("wochenkauf-backup-pending", "true"); renderHistory(); showToast("Einkauf gelöscht. Neue Sicherung empfohlen."); }
  });
  $("#dropZone").addEventListener("click", () => $("#receiptFile").click()); $("#dropZone").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") $("#receiptFile").click(); });
  $("#dropZone").addEventListener("dragover", (event) => event.preventDefault()); $("#dropZone").addEventListener("drop", (event) => { event.preventDefault(); selectImage(event.dataTransfer.files[0]); });
  $("#chooseFileBtn").addEventListener("click", () => $("#receiptFile").click()); $("#receiptFile").addEventListener("change", (event) => selectImage(event.target.files[0])); $("#chooseUploadBtn").addEventListener("click", () => $("#uploadFile").click()); $("#uploadFile").addEventListener("change", (event) => selectImage(event.target.files[0])); $("#ocrBtn").addEventListener("click", runOcr);
  $("#parseBtn").addEventListener("click", () => { state.draftItems = parseReceiptText($("#rawText").value); renderDraftItems(); showToast(`${state.draftItems.length} Artikel übernommen.`); });
  $("#itemList").addEventListener("input", (event) => { const row = event.target.closest(".item-row"); if (!row) return; const index = Number(row.dataset.index); if (event.target.classList.contains("draft-name")) { state.draftItems[index].name = event.target.value; state.draftItems[index].category = categoryFor(event.target.value); row.querySelector(".draft-category").value = state.draftItems[index].category; } if (event.target.classList.contains("draft-category")) { state.draftItems[index].category = event.target.value; rememberCategory(state.draftItems[index].name, event.target.value); } if (event.target.classList.contains("price-input")) state.draftItems[index].totalPriceCents = Math.round((Number(event.target.value.replace(",", ".")) || 0) * 100); $("#captureTotal").textContent = money(state.draftItems.reduce((sum, item) => sum + item.totalPriceCents, 0)); });
  $("#itemList").addEventListener("click", (event) => { const button = event.target.closest(".delete-draft"); if (!button) return; const index = Number(button.closest(".item-row").dataset.index); state.draftItems.splice(index, 1); renderDraftItems(); });
  $("#addItemBtn").addEventListener("click", () => { $("#newItemName").value = ""; $("#newItemQty").value = "1"; $("#newItemPrice").value = ""; $("#itemDialog").showModal(); });
  $("#closeItemDialog").addEventListener("click", () => $("#itemDialog").close());
  $("#itemForm").addEventListener("submit", (event) => { event.preventDefault(); const name = $("#newItemName").value.trim(); if (!name) return; state.draftItems.push({ name, quantity: Number($("#newItemQty").value) || 1, totalPriceCents: Math.round((Number($("#newItemPrice").value) || 0) * 100), category: categoryFor(name) }); $("#itemDialog").close(); renderDraftItems(); });
  $("#saveBtn").addEventListener("click", saveReceipt); $("#periodSelect").addEventListener("change", renderAnalysis); $("#exportBtn").addEventListener("click", exportBackup); $("#importBtn").addEventListener("click", () => $("#importFile").click()); $("#importFile").addEventListener("change", (event) => event.target.files[0] && importBackup(event.target.files[0]));
  $("#closeReceiptDialog").addEventListener("click", closeReceiptDialog); $("#saveReceiptEditsBtn").addEventListener("click", saveReceiptEdits); $("#downloadReceiptBtn").addEventListener("click", downloadStoredReceipt); $("#receiptAddItemBtn").addEventListener("click", addReceiptEditorItem);
  $("#receiptEditorItems").addEventListener("click", (event) => { const remove = event.target.closest(".delete-receipt-item"); if (remove) remove.closest(".receipt-edit-row").remove(); });
  $("#receiptDialog").addEventListener("close", () => { if (state.receiptObjectUrl) URL.revokeObjectURL(state.receiptObjectUrl); state.receiptObjectUrl = ""; state.activeReceiptId = null; });
  $("#unassignedItems").addEventListener("change", async (event) => { if (!event.target.classList.contains("unassigned-category") || !event.target.value) return; const key = event.target.dataset.key; const category = event.target.value; const changed = []; let exampleName = ""; state.receipts.forEach((row) => { let rowChanged = false; row.items.forEach((item) => { if (itemKey(item.name) === key) { item.category = category; exampleName ||= item.name; rowChanged = true; } }); if (rowChanged) changed.push(row); }); try { rememberCategory(exampleName, category); await Promise.all(changed.map((row) => dbPut(row))); localStorage.setItem("wochenkauf-backup-pending", "true"); renderAnalysis(); showToast("Kategorie wurde gespeichert."); } catch { showToast("Kategorie konnte nicht gespeichert werden."); } });
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
