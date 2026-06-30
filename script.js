const sheetConfig = {
  id: "1_brDqDzZl13Sn1YlU2wMnBNAywG86fEVQ4pN0qeLlPQ",
  gid: "0"
};

const storageKeys = {
  notes: "supportHubNotes",
  sheetCache: "supportHubSheetCache"
};

const initialUrlState = readUrlState();
let canSyncUrl = false;
const defaultFilters = {
  brand: initialUrlState.brand || "TUTIMI",
  type: "script",
  query: "",
  status: "all",
  category: ""
};

const state = {
  brand: defaultFilters.brand,
  type: initialUrlState.type || defaultFilters.type,
  query: initialUrlState.query || defaultFilters.query,
  status: initialUrlState.status || defaultFilters.status,
  category: initialUrlState.category || defaultFilters.category,
  items: Array.isArray(supportData) ? [...supportData] : [],
  notes: readStoredJson(storageKeys.notes, []),
  imageWarnings: []
};

const typeLabels = {
  all: "TẤT CẢ",
  script: "KỊCH BẢN CHAT",
  promotion: "CTKM",
  store: "CỬA HÀNG",
  menu: "MENU",
  note: "GHI CHÚ KHÁC"
};

const today = new Date();
today.setHours(0, 0, 0, 0);

const elements = {
  search: document.querySelector("#searchInput"),
  storeSearchSection: document.querySelector("#storeSearchSection"),
  brandFilters: document.querySelector("#brandFilters"),
  typeFilters: document.querySelector("#typeFilters"),
  categoryFilters: document.querySelector("#categoryFilters"),
  status: document.querySelector("#statusFilter"),
  results: document.querySelector("#results"),
  empty: document.querySelector("#emptyState"),
  summary: document.querySelector("#resultSummary"),
  currentView: document.querySelector("#currentView"),
  stats: document.querySelector("#stats"),
  toast: document.querySelector("#toast"),
  noteForm: document.querySelector("#noteForm"),
  noteTitle: document.querySelector("#noteTitle"),
  noteBody: document.querySelector("#noteBody"),
  clearButton: document.querySelector("#clearButton"),
  exportButton: document.querySelector("#exportButton"),
  dataSource: document.querySelector("#dataSource"),
  imageWarningBanner: document.querySelector("#imageWarningBanner")
};

if (elements.search) elements.search.value = state.query;
if (elements.status) elements.status.value = state.status;

function readStoredJson(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return fallbackValue;

    const parsedValue = JSON.parse(rawValue);
    return parsedValue ?? fallbackValue;
  } catch (error) {
    console.warn(`Could not read ${key} from localStorage`, error);
    return fallbackValue;
  }
}

function writeStoredJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not write ${key} to localStorage`, error);
    return false;
  }
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const allowedStatuses = new Set(["all", "active", "upcoming", "expired"]);
  const type = normalizeContentType(params.get("type"));
  const status = params.get("status");

  return {
    brand: (params.get("brand") || "").trim(),
    type: getTypes().includes(type) ? type : "",
    category: (params.get("category") || "").trim(),
    query: (params.get("q") || "").trim(),
    status: allowedStatuses.has(status) ? status : ""
  };
}

function applyUrlState(nextState = initialUrlState) {
  if (nextState.brand) state.brand = nextState.brand;
  if (nextState.type) state.type = nextState.type;
  state.category = nextState.category || "";
  state.query = nextState.query || "";
  state.status = nextState.status || "all";

  if (elements.search) elements.search.value = state.query;
  if (elements.status) elements.status.value = state.status;
}

function syncUrlState() {
  if (!canSyncUrl) return;

  const params = new URLSearchParams();

  if (state.brand) params.set("brand", state.brand);
  if (state.type && state.type !== "script") params.set("type", state.type);
  if (state.category) params.set("category", state.category);
  if (state.status !== "all" && state.type === "promotion") params.set("status", state.status);
  if (state.query && state.type === "store") params.set("q", state.query);

  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function getAllItems() {
  return [...state.items, ...state.notes];
}

function getBrands() {
  return [...new Set(state.items.map((item) => item.brand).filter(Boolean))];
}

function getTypes() {
  return ["script", "promotion", "store", "menu"];
}

function ensureDefaultFilters() {
  const brands = getBrands();
  const preferredBrand = brands.find((brand) => slugify(brand) === "tutimi");
  if (!brands.includes(state.brand)) {
    state.brand = preferredBrand || brands[0] || "";
  }

  if (!getTypes().includes(state.type)) {
    state.type = "script";
  }
}

function getCategorySourceItems() {
  return getAllItems().filter((item) => {
    const brandMatch = item.brand === state.brand;
    const typeMatch = item.type === state.type;

    return brandMatch && typeMatch;
  });
}

function getCategories() {
  return [
    ...new Set(
      getCategorySourceItems()
        .map((item) => item.category)
        .filter(Boolean)
    )
  ].sort((first, second) => first.localeCompare(second));
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getBrandClass(brand) {
  return `brand-${slugify(brand) || "general"}`;
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeContentType(value) {
  const type = slugify(value);
  const aliases = {
    chatscript: "script",
    chatscripts: "script",
    scripts: "script",
    promos: "promotion",
    promotions: "promotion",
    stores: "store",
    locations: "store",
    menus: "menu"
  };

  return aliases[type.replace(/-/g, "")] || type || "script";
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const knownHeaders = new Set([
    "id",
    "type",
    "brand",
    "category",
    "title",
    "content",
    "phone",
    "managername",
    "managerphone",
    "storephone1",
    "storephone2",
    "address",
    "hours",
    "notes",
    "startdate",
    "enddate",
    "channels",
    "tags",
    "imageurl",
    "imagelabel",
    "updatedat"
  ]);
  const [headers = [], ...records] = rows;
  const normalizedHeaders = headers.map((header) => {
    const normalized = slugify(header).replace(/-/g, "");
    const firstToken = slugify(String(header).trim().split(/\s+/)[0]).replace(/-/g, "");

    return knownHeaders.has(firstToken) ? firstToken : normalized;
  });

  return records
    .filter((record) => record.some((cellValue) => cellValue.trim()))
    .map((record) =>
      normalizedHeaders.reduce((entry, header, index) => {
        entry[header] = (record[index] || "").trim();
        return entry;
      }, {})
    );
}

function buildItemFromSheetRow(row, index) {
  const item = {
    id: slugify(row.id) || slugify(`${row.type}-${row.brand}-${row.title}`) || `sheet-item-${index + 1}`,
    type: normalizeContentType(row.type),
    brand: row.brand || "General",
    title: row.title || "Untitled",
    tags: splitList(row.tags)
  };

  [
    "category",
    "content",
    "phone",
    "managerName",
    "managerPhone",
    "storePhone1",
    "storePhone2",
    "address",
    "hours",
    "notes",
    "startDate",
    "endDate",
    "imageUrl",
    "imageLabel",
    "updatedAt"
  ].forEach((field) => {
    const key = field.toLowerCase();
    if (row[key]) item[field] = row[key];
  });

  const channels = splitList(row.channels);
  if (channels.length) item.channels = channels;

  return item;
}

function parseSheetDate(value, endOfDay = false) {
  if (!value) return null;

  const normalizedValue = String(value).trim();
  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function formatCacheTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function saveSheetCache(items) {
  writeStoredJson(storageKeys.sheetCache, {
    items,
    savedAt: new Date().toISOString()
  });
}

function readSheetCache() {
  const cachedValue = readStoredJson(storageKeys.sheetCache, null);
  if (!cachedValue || !Array.isArray(cachedValue.items) || !cachedValue.items.length) {
    return null;
  }

  return {
    items: cachedValue.items,
    savedAt: cachedValue.savedAt || ""
  };
}

async function loadSheetData() {
  const url = `https://docs.google.com/spreadsheets/d/${sheetConfig.id}/gviz/tq?tqx=out:csv&gid=${sheetConfig.gid}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Sheet returned ${response.status}`);

    const rows = parseCsv(await response.text());
    const sheetItems = rows
      .map(buildItemFromSheetRow)
      .filter((item) => item.brand && item.type && (item.title !== "Untitled" || item.content || item.address || item.imageUrl));
    if (!sheetItems.length) throw new Error("Sheet has no usable rows");

    state.items = sheetItems;
    saveSheetCache(sheetItems);
    elements.dataSource.textContent = `Loaded ${sheetItems.length} items from Google Sheets`;
  } catch (error) {
    const cachedSheet = readSheetCache();
    if (cachedSheet) {
      state.items = cachedSheet.items;
      const cachedTime = formatCacheTimestamp(cachedSheet.savedAt);
      elements.dataSource.textContent = cachedTime
        ? `Using cached sheet data from ${cachedTime}`
        : "Using cached sheet data";
    } else {
      elements.dataSource.textContent = "Using fallback data. Check Google Sheet sharing or publishing settings.";
    }
    console.warn("Google Sheet load failed:", error);
  }

  applyUrlState();
  canSyncUrl = true;
  renderFilters();
  renderResults();
}

function getPromotionStatus(item) {
  if (item.type !== "promotion") return "";

  const start = parseSheetDate(item.startDate);
  const end = parseSheetDate(item.endDate, true);

  if (start && today < start) return "upcoming";
  if (end && today > end) return "expired";
  return "active";
}

function itemMatchesQuery(item) {
  if (!state.query) return true;

  const searchable = [
    item.brand,
    item.type,
    item.category,
    item.title,
    item.content,
    item.phone,
    item.managerName,
    item.managerPhone,
    item.storePhone1,
    item.storePhone2,
    item.address,
    item.hours,
    item.notes,
    item.imageUrl,
    item.startDate,
    item.endDate,
    ...(item.tags || []),
    ...(item.channels || [])
  ]
    .map(normalize)
    .join(" ");

  return searchable.includes(normalize(state.query));
}

function getStorePhones(item) {
  return [item.storePhone1, item.storePhone2].filter(Boolean);
}

function getManagerPhone(item) {
  return item.managerPhone || "";
}

function getManagerName(item) {
  return item.managerName || "";
}

function getLegacyStorePhone(item) {
  return item.phone && !item.managerPhone && !getStorePhones(item).length ? item.phone : "";
}

function getFilteredItems() {
  return getAllItems().filter((item) => {
    const brandMatch = item.brand === state.brand;
    const typeMatch = item.type === state.type;
    const categoryMatch = !state.category || item.category === state.category;
    const queryMatch = state.type !== "store" || itemMatchesQuery(item);
    const statusMatch =
      state.status === "all" || item.type !== "promotion" || getPromotionStatus(item) === state.status;

    return brandMatch && typeMatch && categoryMatch && queryMatch && statusMatch;
  });
}

function syncSelectedCategories() {
  const availableCategories = new Set(getCategories());
  if (state.category && !availableCategories.has(state.category)) {
    state.category = "";
  }
}

function renderFilters() {
  ensureDefaultFilters();
  syncSelectedCategories();

  elements.brandFilters.innerHTML = getBrands()
    .map(
      (brand) => `
        <button class="filter-button ${state.brand === brand ? "is-active" : ""}" type="button" data-brand="${escapeHtml(brand)}">
          ${escapeHtml(brand)}
        </button>
      `
    )
    .join("");

  elements.typeFilters.innerHTML = getTypes()
    .map(
      (type) => `
        <button class="filter-button ${state.type === type ? "is-active" : ""}" type="button" data-type="${type}">
          ${typeLabels[type]}
        </button>
      `
    )
    .join("");

  const categories = getCategories();
  elements.categoryFilters.innerHTML = categories.length
    ? categories
        .map(
          (category) => `
            <button class="filter-button ${state.category === category ? "is-active" : ""}" type="button" data-category="${escapeHtml(category)}">
              ${escapeHtml(category)}
            </button>
          `
        )
        .join("")
    : `<p class="checkbox-empty">No categories for this view.</p>`;
}

function renderStats(items) {
  if (!elements.stats) return;

  const allItems = getAllItems();
  const activePromos = allItems.filter((item) => item.type === "promotion" && getPromotionStatus(item) === "active");
  const scripts = allItems.filter((item) => item.type === "script");
  const stores = allItems.filter((item) => item.type === "store");

  elements.stats.innerHTML = [
    ["Results", items.length],
    ["Scripts", scripts.length],
    ["Stores", stores.length],
    ["Active Promos", activePromos.length]
  ]
    .map(
      ([label, value]) => `
        <div class="stat">
          <strong>${value}</strong>
          <span>${label}</span>
        </div>
      `
    )
    .join("");
}

function getCopyText(item) {
  if (item.type === "store") {
    const managerName = getManagerName(item);
    const managerPhone = getManagerPhone(item);
    const storePhones = getStorePhones(item);
    const legacyPhone = getLegacyStorePhone(item);
    const phoneLines = [
      managerName ? `Manager: ${managerName}` : "",
      managerPhone ? `Manager phone: ${managerPhone}` : "",
      storePhones.length ? `Store phone: ${storePhones.join(" / ")}` : "",
      legacyPhone ? `Phone: ${legacyPhone}` : ""
    ].filter(Boolean);

    return [
      item.title,
      ...phoneLines,
      item.address ? `Address: ${item.address}` : "",
      item.hours ? `Hours: ${item.hours}` : "",
      item.notes ? `Notes: ${item.notes}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (item.type === "promotion") {
    return `${item.title}\n${item.content}\nValid: ${item.startDate} to ${item.endDate}\nChannels: ${(item.channels || []).join(", ")}`;
  }

  return item.content || item.notes || item.title;
}

function getGoogleDriveFileId(url) {
  const filePathMatch = String(url).match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (filePathMatch) return filePathMatch[1];

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes("drive.google.com")) return "";
    return parsedUrl.searchParams.get("id") || "";
  } catch {
    return "";
  }
}

function getDisplayImageUrl(imageUrl) {
  if (!imageUrl) return "";
  const driveFileId = getGoogleDriveFileId(imageUrl);
  if (driveFileId) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFileId)}=w2400`;
  }

  return imageUrl;
}

function getAbsoluteImageUrl(imageUrl) {
  const displayUrl = getDisplayImageUrl(imageUrl);
  if (!displayUrl) return "";

  try {
    return new URL(displayUrl, window.location.href).href;
  } catch {
    return "";
  }
}

function getImageIssue(item) {
  if (!item.imageUrl) return null;

  const rawUrl = String(item.imageUrl).trim();
  if (!rawUrl) return null;

  if (rawUrl.includes("drive.google.com") && !getGoogleDriveFileId(rawUrl)) {
    return `${item.title}: link Google Drive không đúng định dạng`;
  }

  if (!getAbsoluteImageUrl(rawUrl)) {
    return `${item.title}: link hình ảnh không hợp lệ`;
  }

  return null;
}

function updateImageWarnings() {
  state.imageWarnings = state.items.map(getImageIssue).filter(Boolean);

  if (!elements.imageWarningBanner) return;

  if (!state.imageWarnings.length) {
    elements.imageWarningBanner.hidden = true;
    elements.imageWarningBanner.textContent = "";
    return;
  }

  const previewWarnings = state.imageWarnings.slice(0, 3).join(" | ");
  const remainingCount = state.imageWarnings.length - 3;
  elements.imageWarningBanner.textContent =
    remainingCount > 0
      ? `${state.imageWarnings.length} mục hình ảnh cần kiểm tra: ${previewWarnings} | +${remainingCount} mục nữa`
      : `${state.imageWarnings.length} mục hình ảnh cần kiểm tra: ${previewWarnings}`;
  elements.imageWarningBanner.hidden = false;
}

function renderItemImage(item) {
  const imageUrl = getDisplayImageUrl(item.imageUrl);

  if (!imageUrl) {
    return item.type === "menu" ? `<div class="menu-preview">${escapeHtml(item.imageLabel || "Menu image")}</div>` : "";
  }

  return `
    <figure class="card-image">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />
    </figure>
  `;
}

function renderMeta(item) {
  const rows = [];
  const managerName = getManagerName(item);
  const storePhones = getStorePhones(item);
  const legacyPhone = getLegacyStorePhone(item);

  if (item.category) rows.push(["Category", item.category]);
  if (managerName) rows.push(["Manager", managerName]);
  if (item.managerPhone) rows.push(["Manager Phone", item.managerPhone]);
  if (storePhones.length) rows.push(["Store Phone", storePhones.join(" / ")]);
  if (legacyPhone) rows.push(["Phone", legacyPhone]);
  if (item.address) rows.push(["Address", item.address]);
  if (item.hours) rows.push(["Hours", item.hours]);
  if (item.startDate && item.endDate) rows.push(["Valid", `${item.startDate} to ${item.endDate}`]);
  if (item.channels) rows.push(["Channels", item.channels.join(", ")]);
  if (item.updatedAt) rows.push(["Updated", item.updatedAt]);

  if (!rows.length) return "";

  return `
    <div class="meta-list">
      ${rows.map(([label, value]) => `<span><strong>${label}:</strong> ${escapeHtml(value)}</span>`).join("")}
    </div>
  `;
}

function renderCard(item) {
  const promoStatus = getPromotionStatus(item);
  const tags = (item.tags || []).slice(0, 4);
  const imageUrl = getDisplayImageUrl(item.imageUrl);
  const copyLabel = imageUrl ? "Copy Image" : item.type === "store" ? "Copy Info" : "Copy";
  const typeClass = escapeHtml(slugify(item.type));
  const brandClass = escapeHtml(getBrandClass(item.brand));
  const typeLabel = escapeHtml(typeLabels[item.type] || item.type);
  const managerName = getManagerName(item);
  const managerPhone = getManagerPhone(item);
  const storePhones = getStorePhones(item);
  const legacyPhone = getLegacyStorePhone(item);

  return `
    <article class="content-card ${brandClass}">
      <div class="card-topline">
        <div class="badge-row">
          <span class="badge ${typeClass}">${typeLabel}</span>
          <span class="badge brand-badge ${brandClass}">${escapeHtml(item.brand)}</span>
          ${promoStatus ? `<span class="badge ${promoStatus}">${escapeHtml(promoStatus)}</span>` : ""}
        </div>
      </div>

      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="card-body">${escapeHtml(item.content || item.notes || "")}</div>
      </div>

      ${item.type === "menu" || item.type === "promotion" ? renderItemImage(item) : ""}
      ${renderMeta(item)}

      ${
        tags.length
          ? `<div class="badge-row">${tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}</div>`
          : ""
      }

      <div class="card-actions">
        <button type="button" ${imageUrl ? `data-copy-image="${escapeHtml(item.id)}"` : `data-copy="${escapeHtml(item.id)}"`}>${copyLabel}</button>
        ${imageUrl ? `<button class="secondary" type="button" data-copy="${escapeHtml(item.id)}">Copy Info</button>` : ""}
        ${imageUrl ? `<button class="secondary" type="button" data-copy-image-link="${escapeHtml(item.id)}">Copy Link</button>` : ""}
        ${imageUrl ? `<button class="secondary" type="button" data-open-image="${escapeHtml(item.id)}">Open Image</button>` : ""}
        ${imageUrl ? `<a class="button secondary" href="${escapeHtml(imageUrl)}" download>Download</a>` : ""}
        ${item.type === "note" ? `<button class="secondary" type="button" data-delete-note="${escapeHtml(item.id)}">Delete</button>` : ""}
        ${managerPhone ? `<button class="secondary" type="button" data-copy-manager-phone="${escapeHtml(item.id)}">Copy Manager</button>` : ""}
        ${storePhones.length ? `<button class="secondary" type="button" data-copy-store-phone="${escapeHtml(item.id)}">Copy Store Phone</button>` : ""}
        ${legacyPhone ? `<button class="secondary" type="button" data-copy-phone="${escapeHtml(item.id)}">Copy Phone</button>` : ""}
      </div>
    </article>
  `;
}

function groupItemsByCategory(items) {
  return items.reduce((groups, item) => {
    const category = item.category || "Uncategorized";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
    return groups;
  }, new Map());
}

function renderScriptTable(items) {
  const groups = groupItemsByCategory(items);

  return `
    <div class="script-table" role="table" aria-label="Chat scripts grouped by category">
      ${[...groups]
        .map(
          ([category, scripts]) => `
            <section class="script-group" role="rowgroup">
              <div class="script-category" role="rowheader">
                <strong>${escapeHtml(category)}</strong>
                <span>${scripts.length} script${scripts.length === 1 ? "" : "s"}</span>
              </div>
              <div class="script-rows">
                ${scripts
                  .map(
                    (script) => `
                      <article class="script-row" role="row" data-copy-row="${escapeHtml(script.id)}" title="Click to copy">
                        <div class="script-copy" role="cell">
                          <h3>${escapeHtml(script.title)}</h3>
                          <p>${escapeHtml(script.content || script.notes || "")}</p>
                        </div>
                        <div class="script-action" role="cell">
                          <button type="button" data-copy="${escapeHtml(script.id)}">Copy</button>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function renderResults() {
  const items = getFilteredItems();
  const useScriptTable = state.type === "script" || (items.length > 0 && items.every((item) => item.type === "script"));
  const brandClass = getBrandClass(state.brand);

  if (elements.status) elements.status.hidden = state.type !== "promotion";
  if (elements.storeSearchSection) elements.storeSearchSection.hidden = state.type !== "store";
  elements.results.dataset.brand = brandClass;
  elements.results.classList.remove("brand-tutimi", "brand-sekai", "brand-dhi", "brand-general");
  elements.results.classList.add(brandClass);
  elements.results.classList.toggle("is-script-table", useScriptTable);
  elements.results.innerHTML = useScriptTable ? renderScriptTable(items) : items.map(renderCard).join("");
  elements.empty.hidden = items.length > 0;
  elements.summary.textContent = `${items.length} result${items.length === 1 ? "" : "s"} found`;
  elements.currentView.textContent = typeLabels[state.type];
  renderStats(items);
  updateImageWarnings();
  syncUrlState();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 1800);
}

async function copyToClipboard(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("Copy failed. Select the text manually.");
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function imageToCanvas(image) {
  const maxClipboardImageSide = 2400;
  const scale = Math.min(1, maxClipboardImageSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not convert image"));
      }
    }, "image/png");
  });
}

async function imageToPngBlob(url) {
  const image = await loadImage(url);
  return canvasToPngBlob(imageToCanvas(image));
}

function copyImageAsHtml(image, title) {
  const selection = window.getSelection();
  const previousRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  const temporaryCopyArea = document.createElement("div");
  try {
    const dataUrl = imageToCanvas(image).toDataURL("image/png");
    const html = `<img src="${dataUrl}" alt="${escapeHtml(title)}">`;
    const copyHandler = (event) => {
      event.preventDefault();
      event.clipboardData.setData("text/html", html);
      event.clipboardData.setData("text/plain", title);
    };

    temporaryCopyArea.contentEditable = "true";
    temporaryCopyArea.style.position = "fixed";
    temporaryCopyArea.style.left = "-9999px";
    temporaryCopyArea.style.top = "0";
    temporaryCopyArea.innerHTML = html;
    document.body.appendChild(temporaryCopyArea);

    const range = document.createRange();
    range.selectNodeContents(temporaryCopyArea);
    selection?.removeAllRanges();
    selection?.addRange(range);

    document.addEventListener("copy", copyHandler, { once: true });
    const copied = document.execCommand("copy");
    document.removeEventListener("copy", copyHandler);
    return copied;
  } catch (error) {
    console.warn("HTML image copy failed", error);
    return false;
  } finally {
    temporaryCopyArea.remove();
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) selection.addRange(previousRange);
    }
  }
}

async function copyImageToClipboard(url, title, imageElement) {
  const htmlCopied =
    imageElement?.complete && imageElement.naturalWidth ? copyImageAsHtml(imageElement, title) : false;

  if (!window.ClipboardItem || !navigator.clipboard?.write) {
    showToast(htmlCopied ? "Image copied" : "Image copy is not supported in this browser.");
    return;
  }

  try {
    const pngBlob = imageElement?.complete && imageElement.naturalWidth
      ? canvasToPngBlob(imageToCanvas(imageElement))
      : imageToPngBlob(url);
    const item = new ClipboardItem({
      "image/png": pngBlob,
    });
    await navigator.clipboard.write([item]);
    showToast("Image copied");
  } catch (error) {
    console.warn("Image copy failed", error);
    showToast(htmlCopied ? "Image copied" : "Image copy failed. Open the image and copy it manually.");
  }
}

function saveNotes() {
  writeStoredJson(storageKeys.notes, state.notes);
}

function resetFilters() {
  state.brand = defaultFilters.brand;
  state.type = defaultFilters.type;
  state.query = defaultFilters.query;
  state.status = defaultFilters.status;
  state.category = defaultFilters.category;
  if (elements.search) elements.search.value = "";
  if (elements.status) elements.status.value = "all";
  renderFilters();
  renderResults();
}

function bindEvents() {
  elements.search?.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderResults();
  });

  elements.brandFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand]");
    if (!button) return;
    state.brand = button.dataset.brand;
    syncSelectedCategories();
    renderFilters();
    renderResults();
  });

  elements.typeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    state.type = button.dataset.type;
    if (state.type !== "store") {
      state.query = "";
      if (elements.search) elements.search.value = "";
    }
    syncSelectedCategories();
    renderFilters();
    renderResults();
  });

  elements.categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = state.category === button.dataset.category ? "" : button.dataset.category;
    renderFilters();
    renderResults();
  });

  elements.status?.addEventListener("change", (event) => {
    state.status = event.target.value;
    renderResults();
  });

  elements.results.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy]");
    const copyRow = event.target.closest("[data-copy-row]");
    const copyImageButton = event.target.closest("[data-copy-image]");
    const copyImageLinkButton = event.target.closest("[data-copy-image-link]");
    const openImageButton = event.target.closest("[data-open-image]");
    const phoneButton = event.target.closest("[data-copy-phone]");
    const managerPhoneButton = event.target.closest("[data-copy-manager-phone]");
    const storePhoneButton = event.target.closest("[data-copy-store-phone]");
    const deleteButton = event.target.closest("[data-delete-note]");
    const itemId =
      copyButton?.dataset.copy ||
      copyRow?.dataset.copyRow ||
      copyImageButton?.dataset.copyImage ||
      copyImageLinkButton?.dataset.copyImageLink ||
      openImageButton?.dataset.openImage ||
      phoneButton?.dataset.copyPhone ||
      managerPhoneButton?.dataset.copyManagerPhone ||
      storePhoneButton?.dataset.copyStorePhone ||
      deleteButton?.dataset.deleteNote;
    const item = getAllItems().find((entry) => entry.id === itemId);

    if (!item) return;

    if (deleteButton) {
      state.notes = state.notes.filter((note) => note.id !== item.id);
      saveNotes();
      showToast("Local note deleted");
      renderResults();
      return;
    }

    if (copyImageLinkButton) {
      copyToClipboard(getAbsoluteImageUrl(item.imageUrl), "Image link copied");
      return;
    }

    if (openImageButton) {
      window.open(getAbsoluteImageUrl(item.imageUrl), "_blank", "noopener");
      return;
    }

    if (copyImageButton) {
      const imageElement = copyImageButton.closest(".content-card")?.querySelector(".card-image img");
      copyImageToClipboard(getDisplayImageUrl(item.imageUrl), item.title, imageElement);
      return;
    }

    if (phoneButton) {
      copyToClipboard(item.phone, "Phone number copied");
      return;
    }

    if (managerPhoneButton) {
      copyToClipboard(getManagerPhone(item), "Manager phone copied");
      return;
    }

    if (storePhoneButton) {
      copyToClipboard(getStorePhones(item).join("\n"), "Store phone copied");
      return;
    }

    copyToClipboard(getCopyText(item), "Content copied");
  });

  elements.noteForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = {
      id: `note-${Date.now()}`,
      type: "note",
      brand: state.brand || "General",
      title: elements.noteTitle.value.trim(),
      content: elements.noteBody.value.trim(),
      tags: ["local note"],
      updatedAt: new Date().toISOString().slice(0, 10)
    };

    state.notes.unshift(note);
    saveNotes();
    elements.noteForm.reset();
    showToast("Local note saved");
    renderFilters();
    renderResults();
  });

  elements.clearButton.addEventListener("click", resetFilters);

  elements.exportButton?.addEventListener("click", () => {
    const payload = JSON.stringify(state.notes, null, 2);
    copyToClipboard(payload, "Local notes exported to clipboard");
  });
}

renderFilters();
renderResults();
bindEvents();
loadSheetData();
