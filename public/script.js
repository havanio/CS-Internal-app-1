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
  showDrafts: new URLSearchParams(window.location.search).get("drafts") === "1",
  policyId: initialUrlState.policyId || "",
  items: Array.isArray(supportData) ? [...supportData] : [],
  notes: readStoredJson(storageKeys.notes, []),
  imageWarnings: []
};

const typeLabels = {
  all: "TẤT CẢ",
  script: "KỊCH BẢN CHAT",
  policy: "CHÍNH SÁCH HẬU MÃI",
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
  const allowedStatuses = new Set(["all", "active", "upcoming", "expired", "verify"]);
  const type = normalizeContentType(params.get("type"));
  const status = params.get("status");

  return {
    brand: (params.get("brand") || "").trim(),
    type: getTypes().includes(type) ? type : "",
    category: (params.get("category") || "").trim(),
    policyId: (params.get("policy") || "").trim(),
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

  state.policyId = nextState.policyId || "";
  // Old shared links used q=<exact situation title>; migrate them to the dropdown.
  if (state.type === "policy" && state.query) {
    const legacy = state.items.find((item) => item.type === "policy" && item.brand === state.brand && item.title === state.query);
    if (!state.policyId && legacy) state.policyId = legacy.id;
    state.query = "";
  }

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
  if (state.query && ["store", "promotion"].includes(state.type)) params.set("q", state.query);

  if (state.type === "policy" && state.policyId) params.set("policy", state.policyId);
  if (state.type === "policy" && state.showDrafts) params.set("drafts", "1");
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
  return ["script", "policy", "promotion", "store", "menu"];
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
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
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
  const dmyMatch = normalizedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : dmyMatch
      ? new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]))
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

function formatDateYMD(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");

  return date.toISOString().slice(0, 10);
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
  // Data now comes from the Netlify CMS API (/api/data) instead of Google Sheets.
  // Items are already in the final internal shape, so no CSV parsing/normalizing
  // is needed here. The localStorage cache below is kept as an offline fallback.
  try {
    const response = await fetch("/api/data", { cache: "no-store" });
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const data = await response.json();
    document.querySelector("#localPreviewBanner").hidden = !data.localPreview;
    const items = Array.isArray(data.items) ? data.items.filter((item) => !item.archivedAt) : [];
    if (!items.length) throw new Error("No content items returned");

    state.items = items;
    saveSheetCache(items);
    elements.dataSource.textContent = `Đã tải ${items.length} mục`;
  } catch (error) {
    const cachedSheet = readSheetCache();
    if (cachedSheet) {
      state.items = cachedSheet.items;
      const cachedTime = formatCacheTimestamp(cachedSheet.savedAt);
      elements.dataSource.textContent = cachedTime
        ? `Đang dùng dữ liệu cache lúc ${cachedTime}`
        : "Đang dùng dữ liệu cache";
    } else {
      elements.dataSource.textContent = "Không tải được dữ liệu (kiểm tra /api/data).";
    }
    console.warn("Content load failed:", error);
  }

  applyUrlState();
  canSyncUrl = true;
  renderFilters();
  renderResults();
}

function vietnamMoment(at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const get = key => parts.find(p => p.type === key).value;
  return {date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
}
function promoTimeWindow(item, at = new Date()) {
  const p=item.promotion || {}, now=vietnamMoment(at);
  const schedule=p.schedule?.length ? p.schedule : [{startDate:item.startDate,endDate:item.endDate,startTime:p.startTime,endTime:p.endTime}];
  return schedule.some(w => {
    let day=now.date;
    const overnight=w.startTime && w.endTime && w.startTime>w.endTime;
    if(overnight && now.time<w.endTime) { const previous=new Date(now.date+'T00:00:00+07:00'); previous.setUTCDate(previous.getUTCDate()-1); day=vietnamMoment(previous).date; }
    if(w.startDate && day<w.startDate || w.endDate && day>w.endDate || item.endDate && now.date>item.endDate) return false;
    if(!w.startTime || !w.endTime) return true;
    return overnight ? now.time>=w.startTime || now.time<w.endTime : now.time>=w.startTime && now.time<w.endTime;
  });
}
function signaturePromoStatus(item, at = new Date()) {
  if(item.promotion?.needsConfirmation || !item.startDate) return 'verify';
  const day=vietnamMoment(at).date;
  if(day<item.startDate) return 'upcoming';
  if(item.endDate && day>item.endDate) return item.promotion?.awaitingContinuation ? 'verify' : 'expired';
  return 'active';
}
function promoDateLabel(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : value || ''; }
function promoPeriod(item) {
  if(!item.startDate) return 'Chưa xác nhận ngày bắt đầu / kết thúc';
  return promoDateLabel(item.startDate)+(item.endDate ? ' – '+promoDateLabel(item.endDate) : item.promotion?.untilNotice ? ' – Đến khi có thông báo kết thúc' : ' – Chưa nêu ngày kết thúc');
}
function renderSignaturePromotions(items) {
  let previous='';
  return `<p class="promotion-order-note">Sắp theo ngày bắt đầu áp dụng, từ sớm đến muộn. Kiểm tra trạng thái, khung giờ và điều kiện trước khi tư vấn. Giờ Việt Nam.</p>` + items.map(item => {
    const p=item.promotion || {}, status=getPromotionStatus(item), image=getDisplayImageUrl(item.imageUrl);
    const day=item.startDate || 'unconfirmed';
    const heading=day!==previous ? `<h3 class="promo-date-heading">${day==='unconfirmed' ? 'Chưa xác nhận lịch áp dụng' : 'Bắt đầu '+promoDateLabel(day)}</h3>` : ''; previous=day;
    const hours=p.schedule?.length ? p.schedule.map(w=>`${promoDateLabel(w.startDate)}${w.endDate!==w.startDate ? '–'+promoDateLabel(w.endDate) : ''}: ${w.startTime}–${w.endTime}`).join('\n') : p.startTime && p.endTime ? `${p.startTime}–${p.endTime}${p.startTime>p.endTime ? ' hôm sau' : ''} hằng ngày` : 'Nguồn chưa nêu khung giờ riêng';
    const windowLabel=status==='active' && (p.startTime || p.schedule?.length) ? `<span class="promo-window ${promoTimeWindow(item) ? 'in-window' : ''}">${promoTimeWindow(item) ? 'Trong khung giờ' : 'Ngoài khung giờ hiện tại'}</span>` : '';
    return `${heading}<article class="promo-entry" aria-label="${escapeHtml(item.title)}">
      <a class="promo-poster" href="${escapeHtml(image)}" target="_blank" rel="noopener" aria-label="Xem hình gốc: ${escapeHtml(item.title)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.imageLabel || item.title)}" loading="lazy" /></a>
      <div class="promo-info"><div class="badge-row"><span class="badge ${status==='verify' ? 'upcoming' : status}">${status==='active' ? 'Trong thời gian chương trình' : status==='verify' ? 'Cần xác nhận thời hạn' : getPromotionStatusLabel(status)}</span>${windowLabel}<span class="promo-kind">${escapeHtml(item.category)}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p class="promo-benefit">${escapeHtml(p.benefit || item.content)}</p>
      ${p.products?.length ? `<ul class="promo-products">${p.products.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}${item.category==='Voucher giấy' ? '<p class="promo-eligibility">Cần voucher giấy · Mỗi voucher dùng 1 lần · Không cộng dồn CTKM khác</p>' : ''}
      <dl class="promo-facts"><div><dt>Ngày áp dụng</dt><dd>${escapeHtml(promoPeriod(item))}</dd></div><div><dt>Khung giờ</dt><dd>${escapeHtml(hours)}</dd></div><div><dt>Địa điểm</dt><dd>${escapeHtml(p.location || '')}</dd></div></dl>
      ${p.dateNote ? `<p class="promo-note">${escapeHtml(p.dateNote)}</p>` : ''}${p.warning ? `<p class="promo-warning">${escapeHtml(p.warning)}</p>` : ''}
      <details class="promo-details"><summary>Sản phẩm & điều kiện chi tiết</summary>${p.products?.length ? `<ul>${p.products.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}${p.conditions?.length ? `<ul>${p.conditions.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p>Thông báo chưa nêu thêm điều kiện riêng.</p>'}</details>
      <div class="promo-actions"><button class="icon-button subtle" type="button" data-copy="${escapeHtml(item.id)}">Sao chép thông tin</button><a href="${escapeHtml(image)}" target="_blank" rel="noopener">Xem hình gốc</a></div></div></article>`;
  }).join('');
}

function getPromotionStatus(item) {
  if (item.promotion) return signaturePromoStatus(item);
  if (item.type !== "promotion") return "";

  const start = parseSheetDate(item.startDate);
  const end = parseSheetDate(item.endDate, true);

  if (start && today < start) return "upcoming";
  if (end && today > end) return "expired";
  return "active";
}

function getPromotionStatusLabel(status) {
  return {
    active: "Đang áp dụng",
    upcoming: "Sắp áp dụng",
    expired: "Đã hết hạn",
    verify: "Cần xác nhận"
  }[status] || "";
}

function getPromotionValidity(item) {
  if (item.type !== "promotion") return null;
  if (item.startDate && item.endDate) {
    return { label: "Áp dụng", value: `${item.startDate} đến ${item.endDate}` };
  }
  if (item.startDate) {
    return { label: "Áp dụng từ", value: item.startDate };
  }
  if (item.endDate) {
    return { label: "Đến hết", value: item.endDate };
  }
  return null;
}

function sortItemsForDisplay(items) {
  if (state.type !== "promotion") return items;
  if (state.brand === "TUTIMI SIGNATURE") return [...items].sort((a,b) => (a.startDate || "9999").localeCompare(b.startDate || "9999") || (a.promotion?.startTime || a.promotion?.schedule?.[0]?.startTime || "00:00").localeCompare(b.promotion?.startTime || b.promotion?.schedule?.[0]?.startTime || "00:00"));
  const rank = { active: 0, upcoming: 1, expired: 2, verify: 3 };
  return [...items].sort((a, b) => {
    const byStatus = rank[getPromotionStatus(a)] - rank[getPromotionStatus(b)];
    if (byStatus !== 0) return byStatus;
    return 0;
  });
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
    ...(item.promotion ? [JSON.stringify(item.promotion)] : []),
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
    const queryMatch = !["store", "promotion"].includes(state.type) || itemMatchesQuery(item);
    const statusMatch =
      state.status === "all" || item.type !== "promotion" || getPromotionStatus(item) === state.status;

    return !item.archivedAt && !item.archived && brandMatch && typeMatch && categoryMatch && queryMatch && statusMatch && (item.type !== "policy" || ((state.showDrafts || policyIsActive(item)) && (!state.policyId || item.id === state.policyId)));
  });
}

function renderPolicySelect() {
  const options = getAllItems().filter((item) => item.type === "policy" && !item.archivedAt && !item.archived && item.brand === state.brand && (!state.category || item.category === state.category) && (state.showDrafts || policyIsActive(item)));
  if (!options.some((item) => item.id === state.policyId)) state.policyId = "";
  const select = document.querySelector("#policySelect");
  select.innerHTML = '<option value="">Tất cả tình huống</option>' + options.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("");
  select.value = state.policyId;
  select.disabled = options.length === 0;
}

function syncSelectedCategories() {
  const availableCategories = new Set(getCategories());
  if (state.category && !availableCategories.has(state.category)) {
    state.category = "";
  }
}

function renderFilters() {
  ensureDefaultFilters();
  document.body.dataset.brand = getBrandClass(state.brand);
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
    : `<p class="checkbox-empty">Không có danh mục cho chế độ xem này.</p>`;
}

function policyIsActive(item) {
  const policy = item.policy || {};
  return policy.status === "active" && /^\d{4}-\d{2}-\d{2}$/.test(policy.effectiveDate || "") && policy.effectiveDate <= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function renderPolicies(items) {
  return items.map((item) => {
    const policy = item.policy || {};
    const blocks = [["Ưu tiên xử lý", policy.resolution], ["Phương án hoàn tiền", policy.refund], ["Hỗ trợ thêm", policy.extra], ["Cần kiểm tra", policy.verify], ["Chuyển quản lý / QC", policy.escalation]];
    const messages = Array.isArray(policy.messages) ? policy.messages : [];
    return `<article class="policy-card" aria-label="${escapeHtml(item.title)}">
      <header class="policy-card-head"><div><p class="policy-category">${escapeHtml(item.category || "Chính sách")}</p><h3>${escapeHtml(item.title)}</h3></div><div class="policy-version"><span class="badge ${policyIsActive(item) ? "active" : "upcoming"}">${policyIsActive(item) ? "Đang áp dụng" : policy.status === "active" ? "Sắp áp dụng" : "Dự thảo"}</span><small>${escapeHtml(policy.version || "Chưa có phiên bản")}${policy.effectiveDate ? " · Từ " + escapeHtml(policy.effectiveDate.split("-").reverse().join("/")) : " · Chưa có ngày hiệu lực"}</small></div></header>
      <div class="policy-columns"><section class="policy-rules" aria-label="Chính sách nội bộ"><h4>CHÍNH SÁCH NỘI BỘ</h4>${blocks.filter(([, body]) => body).map(([label, body]) => `<div class="policy-rule"><strong>${label}</strong><p>${escapeHtml(body)}</p></div>`).join("")}</section>
      <section class="policy-messages" aria-label="Mẫu chat gửi khách"><h4>MẪU CHAT GỬI KHÁCH</h4>${messages.length ? messages.map((message, index) => `<div class="policy-message"><div class="policy-message-head"><strong>${escapeHtml(message.title)}</strong><button type="button" class="icon-button" data-copy-policy="${escapeHtml(item.id)}" data-message-index="${index}" aria-label="Sao chép ${escapeHtml(message.title)} - ${escapeHtml(item.title)}">Sao chép</button></div><p class="policy-message-text" role="button" tabindex="0" data-copy-policy="${escapeHtml(item.id)}" data-message-index="${index}" aria-label="Sao chép câu chat: ${escapeHtml(message.title)} - ${escapeHtml(item.title)}" title="Bấm vào câu chat để sao chép">${escapeHtml(message.content)}</p></div>`).join("") : '<p class="muted">Chưa có mẫu chat cho tình huống này.</p>'}</section></div></article>`;
  }).join("");
}

function renderStats(items) {
  if (!elements.stats) return;

  const allItems = getAllItems();
  const activePromos = allItems.filter((item) => item.type === "promotion" && getPromotionStatus(item) === "active");
  const scripts = allItems.filter((item) => item.type === "script");
  const stores = allItems.filter((item) => item.type === "store");

  elements.stats.innerHTML = [
    ["Kết quả", items.length],
    ["Script", scripts.length],
    ["Cửa hàng", stores.length],
    ["CTKM đang áp dụng", activePromos.length]
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
  if(item.promotion) return item.content;
  if (item.type === "store") {
    const managerName = getManagerName(item);
    const managerPhone = getManagerPhone(item);
    const storePhones = getStorePhones(item);
    const legacyPhone = getLegacyStorePhone(item);
    const phoneLines = [
      managerName ? `Quản lý: ${managerName}` : "",
      managerPhone ? `SĐT quản lý: ${managerPhone}` : "",
      storePhones.length ? `SĐT cửa hàng: ${storePhones.join(" / ")}` : "",
      legacyPhone ? `Điện thoại: ${legacyPhone}` : ""
    ].filter(Boolean);

    return [
      item.title,
      ...phoneLines,
      item.address ? `Địa chỉ: ${item.address}` : "",
      item.hours ? `Giờ mở cửa: ${item.hours}` : "",
      item.notes ? `Ghi chú: ${item.notes}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (item.type === "promotion") {
    const validity = getPromotionValidity(item);
    return [
      item.title,
      item.content,
      validity ? `${validity.label}: ${validity.value}` : "",
      `Kênh áp dụng: ${(item.channels || []).join(", ")}`
    ].filter(Boolean).join("\n");
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

  if (item.category) rows.push(["Danh mục", item.category]);
  if (managerName) rows.push(["Quản lý", managerName]);
  if (item.managerPhone) rows.push(["SĐT quản lý", item.managerPhone]);
  if (storePhones.length) rows.push(["SĐT cửa hàng", storePhones.join(" / ")]);
  if (legacyPhone) rows.push(["Điện thoại", legacyPhone]);
  if (item.address) rows.push(["Địa chỉ", item.address]);
  if (item.hours) rows.push(["Giờ mở cửa", item.hours, "hours"]);
  const validity = getPromotionValidity(item);
  if (validity) rows.push([validity.label, validity.value]);
  if (item.channels && item.type !== "store") rows.push(["Kênh áp dụng", item.channels.join(", ")]);
  if (item.updatedAt && item.type !== "promotion" && item.type !== "store") rows.push(["Cập nhật", formatDateYMD(item.updatedAt)]);

  if (!rows.length) return "";

  return `
    <div class="meta-list">
      ${rows.map(([label, value, tone]) => `<span${tone ? ` class="meta-${tone}"` : ""}><strong>${label}:</strong> <em>${escapeHtml(value)}</em></span>`).join("")}
    </div>
  `;
}

function renderCard(item) {
  const promoStatus = getPromotionStatus(item);
  const tags = (item.tags || []).slice(0, 4);
  const imageUrl = getDisplayImageUrl(item.imageUrl);
  const copyLabel = imageUrl ? "Sao chép ảnh" : item.type === "store" ? "Sao chép địa chỉ" : "Sao chép";
  const typeClass = escapeHtml(slugify(item.type));
  const brandClass = escapeHtml(getBrandClass(item.brand));
  const typeLabel = escapeHtml(typeLabels[item.type] || item.type);
  const managerName = getManagerName(item);
  const managerPhone = getManagerPhone(item);
  const storePhones = getStorePhones(item);
  const legacyPhone = getLegacyStorePhone(item);
  const secondaryActions = [];

  if (imageUrl) {
    secondaryActions.push(`<button class="secondary" type="button" data-copy="${escapeHtml(item.id)}">Sao chép nội dung</button>`);
    secondaryActions.push(`<button class="secondary" type="button" data-copy-image-link="${escapeHtml(item.id)}">Sao chép link</button>`);
    secondaryActions.push(`<button class="secondary" type="button" data-open-image="${escapeHtml(item.id)}">Mở ảnh</button>`);
    secondaryActions.push(`<a class="button secondary" href="${escapeHtml(imageUrl)}" download>Tải xuống</a>`);
  }
  if (item.type === "note") {
    secondaryActions.push(`<button class="secondary" type="button" data-delete-note="${escapeHtml(item.id)}">Xoá</button>`);
  }
  if (managerPhone) {
    secondaryActions.push(`<button class="secondary" type="button" data-copy-manager-phone="${escapeHtml(item.id)}">Sao chép SĐT quản lý</button>`);
  }
  if (storePhones.length) {
    secondaryActions.push(`<button class="secondary" type="button" data-copy-store-phone="${escapeHtml(item.id)}">Sao chép SĐT cửa hàng</button>`);
  }
  if (legacyPhone) {
    secondaryActions.push(`<button class="secondary" type="button" data-copy-phone="${escapeHtml(item.id)}">Sao chép điện thoại</button>`);
  }

  return `
    <article class="content-card ${brandClass}">
      <div class="card-topline">
        <div class="badge-row">
          <span class="badge ${typeClass}">${typeLabel}</span>
          <span class="badge brand-badge ${brandClass}">${escapeHtml(item.brand)}</span>
          ${promoStatus ? `<span class="badge ${promoStatus}">${escapeHtml(getPromotionStatusLabel(promoStatus))}</span>` : ""}
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
        ${
          secondaryActions.length
            ? `<details class="card-actions-more">
                <summary>Tác vụ khác</summary>
                <div class="card-actions-menu">
                  ${secondaryActions.join("")}
                </div>
              </details>`
            : ""
        }
      </div>
    </article>
  `;
}

function groupItemsByCategory(items) {
  return items.reduce((groups, item) => {
    const category = item.category || "Chưa phân loại";
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
                          <button type="button" data-copy="${escapeHtml(script.id)}">Sao chép</button>
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
  if (state.type === "policy") renderPolicySelect();
  const items = sortItemsForDisplay(getFilteredItems());
  const useScriptTable = state.type === "script" || (items.length > 0 && items.every((item) => item.type === "script"));
  const brandClass = getBrandClass(state.brand);

  if (elements.status) elements.status.hidden = state.type !== "promotion";
  if (elements.storeSearchSection) elements.storeSearchSection.hidden = !["store", "promotion"].includes(state.type);
  document.querySelector("#searchLabel").textContent = state.type === "promotion" ? "Tìm chương trình khuyến mãi" : "Tìm cửa hàng";
  document.querySelector("#policySelectSection").hidden = state.type !== "policy";
  elements.search.placeholder = state.type === "promotion" ? "VD: 89K, bánh ngọt, voucher giấy, 50%…" : "Tên, địa chỉ, số điện thoại cửa hàng…";
  document.querySelector("#policyGuide").hidden = state.type !== "policy";
  document.querySelector("#policyPrinciples").hidden = state.type !== "policy";
  document.querySelector("#showPolicyDrafts").checked = state.showDrafts;
  document.querySelector("#policyDraftNotice").hidden = state.type !== "policy" || !state.showDrafts;
  elements.results.dataset.brand = brandClass;
  elements.results.classList.remove("brand-tutimi", "brand-sekai", "brand-dhi", "brand-general");
  elements.results.classList.add(brandClass);
  elements.results.classList.toggle("is-script-table", useScriptTable);
  elements.results.classList.toggle("is-policy-list", state.type === "policy");
  const signaturePromos = state.type === "promotion" && state.brand === "TUTIMI SIGNATURE";
  elements.results.classList.toggle("is-promotion-timeline", signaturePromos);
  elements.results.innerHTML = state.type === "policy" ? renderPolicies(items) : signaturePromos ? renderSignaturePromotions(items) : useScriptTable ? renderScriptTable(items) : items.map(renderCard).join("");
  elements.empty.hidden = items.length > 0;
  elements.summary.textContent = `${items.length} mục phù hợp`;
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
    showToast("Sao chép thất bại. Vui lòng chọn nội dung thủ công.");
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
  // Build the clipboard PNG by loading a FRESH image with crossOrigin="anonymous"
  // (imageToPngBlob) instead of reusing the displayed <img>. The rendered <img>
  // has no `crossorigin` attribute, so for cross-origin sources (e.g. jsDelivr or
  // Google Drive) it taints the canvas and canvas.toBlob() throws a SecurityError.
  // A fresh CORS load yields a clean canvas whenever the host sends
  // Access-Control-Allow-Origin (jsDelivr and lh3.googleusercontent.com both do).
  if (window.ClipboardItem && navigator.clipboard?.write) {
    try {
      // Pass the blob Promise straight to ClipboardItem so the write stays inside
      // the user gesture (required by Safari) while the image loads.
      const item = new ClipboardItem({ "image/png": imageToPngBlob(url) });
      await navigator.clipboard.write([item]);
      showToast("Đã sao chép ảnh");
      return;
    } catch (error) {
      console.warn("Image copy via Clipboard API failed", error);
      // fall through to the legacy fallback below
    }
  }

  // Legacy fallback: rich-text copy of the already-rendered image (works for
  // same-origin images and older browsers). Cross-origin images are tainted, so
  // if this also fails we ask the user to copy the image manually.
  const htmlCopied =
    imageElement?.complete && imageElement.naturalWidth ? copyImageAsHtml(imageElement, title) : false;
  showToast(htmlCopied ? "Đã sao chép ảnh" : "Sao chép ảnh thất bại. Hãy mở ảnh và sao chép thủ công.");
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
  state.showDrafts = false;
  state.policyId = "";
  if (elements.search) elements.search.value = "";
  if (elements.status) elements.status.value = "all";
  renderFilters();
  renderResults();
}

function bindEvents() {
  elements.results.addEventListener("keydown", (event) => {
    if (event.target.matches(".policy-message-text") && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.target.click();
    }
  });
  document.querySelector("#policySelect").addEventListener("change", (event) => {
    state.policyId = event.target.value;
    renderResults();
  });
  document.querySelector("#showPolicyDrafts").addEventListener("change", (event) => {
    state.showDrafts = event.target.checked;
    renderResults();
  });

  elements.search?.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderResults();
  });

  elements.brandFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand]");
    if (!button) return;
    state.brand = button.dataset.brand;
    if (state.brand === "TUTIMI SIGNATURE") { state.type = "promotion"; state.query = ""; state.status = "all"; if(elements.search) elements.search.value = ""; }
    syncSelectedCategories();
    renderFilters();
    renderResults();
  });

  elements.typeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-type]");
    if (!button) return;
    state.type = button.dataset.type;
    if (!["store", "promotion"].includes(state.type)) {
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
    const policyCopy = event.target.closest("[data-copy-policy]");
    if (policyCopy) {
      const item = getFilteredItems().find((entry) => entry.id === policyCopy.dataset.copyPolicy);
      const message = item?.policy?.messages?.[Number(policyCopy.dataset.messageIndex)];
      if (message?.content) copyToClipboard(message.content, "Đã sao chép câu chat");
      return;
    }

    const actionSummary = event.target.closest(".card-actions-more summary");
    if (actionSummary) {
      const actionMenu = actionSummary.parentElement;
      window.setTimeout(() => {
        if (!actionMenu?.open) return;
        elements.results.querySelectorAll(".card-actions-more[open]").forEach((menu) => {
          if (menu !== actionMenu) menu.removeAttribute("open");
        });
      }, 0);
      return;
    }

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
      showToast("Đã xoá ghi chú");
      renderResults();
      return;
    }

    if (copyImageLinkButton) {
      copyToClipboard(getAbsoluteImageUrl(item.imageUrl), "Đã sao chép link ảnh");
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
      copyToClipboard(item.phone, "Đã sao chép số điện thoại");
      return;
    }

    if (managerPhoneButton) {
      copyToClipboard(getManagerPhone(item), "Đã sao chép SĐT quản lý");
      return;
    }

    if (storePhoneButton) {
      copyToClipboard(getStorePhones(item).join("\n"), "Đã sao chép SĐT cửa hàng");
      return;
    }

    if (copyButton && item.type === "store") {
      copyToClipboard(item.address || "", "Đã sao chép địa chỉ");
      return;
    }

    copyToClipboard(getCopyText(item), "Đã sao chép nội dung");
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
    copyToClipboard(payload, "Đã sao chép ghi chú");
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".card-actions-more")) return;
    document.querySelectorAll(".card-actions-more[open]").forEach((menu) => menu.removeAttribute("open"));
  });
}

renderFilters();
renderResults();
bindEvents();
loadSheetData();
