/* =========================================================================
   Admin CMS — vanilla JS (no framework, no build).
   Talks to the Netlify functions:
     POST /api/login   { password }               -> { ok:true } | 401
     GET  /api/data                                -> { items, updatedAt }
     POST /api/save    { items }  (x-cms-password) -> { ok, count, updatedAt }
     POST /api/upload  FormData:file (x-cms-pw)    -> { ok, key, url }
     GET  /api/img/:key                            -> image bytes
   Auth: single shared password kept in sessionStorage (key "cms_pw").
   ========================================================================= */
(function () {
  "use strict";

  var PW_KEY = "cms_pw";
  var TYPE_LABELS = {
    script: "KỊCH BẢN CHAT",
    policy: "CHÍNH SÁCH HẬU MÃI",
    promotion: "CTKM",
    store: "CỬA HÀNG",
    menu: "MENU",
    note: "GHI CHÚ KHÁC"
  };
  var BASE_BRANDS = ["TUTIMI", "SEKAI", "DHI"];
  var TYPE_INTROS = {
    policy: { title: "Chính sách hậu mãi", copy: "Quy định xử lý và mẫu chat gửi khách." },
    script: {
      title: "Kịch bản chat",
      copy: "Dùng cho nội dung tư vấn/chăm sóc khách hàng. Cần brand, tiêu đề và nội dung script."
    },
    promotion: {
      title: "Promotion / CTKM",
      copy: "Dùng cho chương trình khuyến mãi. Nên có nội dung mô tả hoặc hình ảnh, và có thể thêm thời gian áp dụng."
    },
    menu: {
      title: "Menu / hình ảnh bán hàng",
      copy: "Dùng cho menu, banner, ảnh sản phẩm. Nên có hình ảnh hoặc nội dung mô tả để người nhận biết cần điền gì."
    },
    store: {
      title: "Thông tin cửa hàng",
      copy: "Dùng cho địa chỉ, liên hệ vận hành, quản lý và giờ mở cửa. Cần ít nhất một đầu mối liên hệ hoặc địa chỉ."
    },
    note: {
      title: "Ghi chú khác",
      copy: "Dùng cho nội dung ghi chú nội bộ hoặc các mục ngoài 3 nhóm chính."
    }
  };
  var TYPE_BADGES = {
    policy: "Hậu mãi",
    script: "Script",
    promotion: "Promotion",
    menu: "Menu",
    store: "Store",
    note: "Note"
  };
  var TYPE_UI = {
    policy: {titlePlaceholder: "VD: Sai món / Thiếu món", categoryPlaceholder: "VD: Đơn và món", promoSectionTitle: "Chính sách"},
    script: {
      titlePlaceholder: "VD: Chào khách / Kịch bản xác nhận đơn",
      categoryPlaceholder: "VD: 1. Tiếp nhận",
      promoSectionTitle: "Promotion / Menu"
    },
    promotion: {
      titlePlaceholder: "VD: CTKM tháng 7 / Mua 1 tặng 1",
      categoryPlaceholder: "VD: CTKM theo tháng",
      promoSectionTitle: "Thông tin CTKM"
    },
    menu: {
      titlePlaceholder: "VD: Menu đồ uống / Menu combo trưa",
      categoryPlaceholder: "VD: Menu chính",
      promoSectionTitle: "Thông tin Menu"
    },
    store: {
      titlePlaceholder: "VD: TUTIMI Nguyễn Trãi",
      categoryPlaceholder: "VD: Khu vực miền Nam",
      promoSectionTitle: "Promotion / Menu"
    },
    note: {
      titlePlaceholder: "VD: Lưu ý vận hành / Ghi chú nội bộ",
      categoryPlaceholder: "VD: Nội bộ",
      promoSectionTitle: "Promotion / Menu"
    }
  };

  /* ---- tiny helpers -------------------------------------------------- */
  var $ = function (sel) { return document.querySelector(sel); };

  var state = {
    items: [],
    updatedAt: null,
    loadedUpdatedAt: null,
    dirty: false,
    editingIndex: null,
    editorInitial: null
  };
  var lastFocus = null;
  var toastTimer = null;

  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function typeLabel(t) { return TYPE_LABELS[t] || (t || "").toUpperCase() || "—"; }

  function parseList(str) {
    return (str || "")
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function normalizeText(s) {
    return (s || "").toString().toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  }

  function slugify(s) {
    var out = normalizeText(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return out || "item";
  }

  function parseHoursValue(value) {
    var raw = (value || "").toString().trim();
    if (!raw) return { allDay: false, open: "", close: "", raw: "" };
    if (/^(24\/7|24h|cả ngày|ca ngay)$/i.test(raw)) {
      return { allDay: true, open: "", close: "", raw: "24/7" };
    }
    var match = raw.match(/(\d{1,2})[:h](\d{2})\s*(?:-|–|—|đến|toi|to)\s*(\d{1,2})[:h](\d{2})/i);
    if (!match) return { allDay: false, open: "", close: "", raw: raw };
    return {
      allDay: false,
      open: match[1].padStart(2, "0") + ":" + match[2],
      close: match[3].padStart(2, "0") + ":" + match[4],
      raw: raw
    };
  }

  function buildSelectOptions(values, placeholder) {
    return '<option value="">' + placeholder + '</option>' + values.map(function (value) {
      return '<option value="' + value + '">' + value + '</option>';
    }).join("");
  }

  function initHoursSelectOptions() {
    var hours = [];
    for (var h = 1; h <= 23; h++) hours.push(String(h).padStart(2, "0"));
    var closeHours = hours.concat(["24"]);
    var hourOptions = buildSelectOptions(hours, "HH");
    var closeHourOptions = buildSelectOptions(closeHours, "HH");
    var minuteOptions = buildSelectOptions(["00", "30"], "MM");
    $("#f_hoursOpenHour").innerHTML = hourOptions;
    $("#f_hoursCloseHour").innerHTML = closeHourOptions;
    $("#f_hoursOpenMinute").innerHTML = minuteOptions;
    $("#f_hoursCloseMinute").innerHTML = minuteOptions;
  }

  function setTimeSelects(prefix, value) {
    var parts = (value || "").split(":");
    $("#" + prefix + "Hour").value = parts[0] || "";
    $("#" + prefix + "Minute").value = parts[1] || "";
  }

  function getTimeSelectValue(prefix) {
    var hour = $("#" + prefix + "Hour").value;
    var minute = $("#" + prefix + "Minute").value;
    return hour && minute ? hour + ":" + minute : "";
  }

  function setHoursControls(value) {
    var parsed = parseHoursValue(value);
    var hoursInput = $("#f_hours");
    hoursInput.value = parsed.raw;
    hoursInput.dataset.preserveRaw = "";
    setTimeSelects("f_hoursOpen", parsed.open);
    setTimeSelects("f_hoursClose", parsed.close);
    if (parsed.raw && !parsed.allDay && (!parsed.open || !parsed.close || getTimeSelectValue("f_hoursOpen") !== parsed.open || getTimeSelectValue("f_hoursClose") !== parsed.close)) {
      hoursInput.dataset.preserveRaw = "1";
    }
    $("#f_hoursAllDay").checked = parsed.allDay;
    updateHoursValue();
  }

  function updateHoursValue() {
    var allDay = $("#f_hoursAllDay").checked;
    var openHour = $("#f_hoursOpenHour");
    var openMinute = $("#f_hoursOpenMinute");
    var closeHour = $("#f_hoursCloseHour");
    var closeMinute = $("#f_hoursCloseMinute");
    var openValue = getTimeSelectValue("f_hoursOpen");
    var closeValue = getTimeSelectValue("f_hoursClose");
    var picker = $(".hours-picker");
    openHour.disabled = allDay;
    openMinute.disabled = allDay;
    closeHour.disabled = allDay;
    if (closeHour.value === "24") closeMinute.value = "00";
    closeMinute.disabled = allDay || closeHour.value === "24";
    if (picker) picker.classList.toggle("is-all-day", allDay);
    if (allDay) {
      $("#f_hours").value = "24/7";
      return;
    }
    if (openValue && closeValue) {
      $("#f_hours").value = openValue + " - " + closeValue;
    } else if (!openHour.value && !openMinute.value && !closeHour.value && !closeMinute.value) {
      if ($("#f_hours").dataset.preserveRaw === "1") return;
      $("#f_hours").value = "";
    } else {
      if ($("#f_hours").dataset.preserveRaw === "1") return;
      $("#f_hours").value = "";
    }
  }

  function onHoursControlChange() {
    $("#f_hours").dataset.preserveRaw = "";
    updateHoursValue();
  }

  function fmtDateTime(x) {
    if (!x) return "—";
    try {
      return new Date(x).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return String(x); }
  }

  function fmtDate(x) {
    if (!x) return "—";
    try { return new Date(x).toLocaleDateString("vi-VN"); }
    catch (e) { return String(x); }
  }

  function parseDateValue(value, endOfDay) {
    if (!value) return null;
    var raw = String(value).trim();
    var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var date = null;
    if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    else if (dmy) date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    else date = new Date(raw);
    if (!date || Number.isNaN(date.getTime())) return null;
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
    return date;
  }

  function getPromotionStatus(item) {
    if (!item || item.type !== "promotion") return "";
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = parseDateValue(item.startDate, false);
    var end = parseDateValue(item.endDate, true);
    if (start && today < start) return "upcoming";
    if (end && today > end) return "expired";
    return "active";
  }

  function promotionStatusLabel(status) {
    return {
      active: "Đang áp dụng",
      upcoming: "Sắp áp dụng",
      expired: "Đã hết hạn",
      archived: "Đã ẩn"
    }[status] || "";
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function normalizeDateValue(value) {
    if (!value) return "";
    var raw = String(value).trim();
    var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return raw;
    var dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      var dd = dmy[1].padStart(2, "0");
      var mm = dmy[2].padStart(2, "0");
      return dmy[3] + "-" + mm + "-" + dd;
    }
    var parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  }

  function isArchived(item) {
    return Boolean(item && item.archivedAt);
  }

  function isSoftArchivable(item) {
    return Boolean(item) && (item.type === "promotion" || item.type === "menu" || item.type === "policy");
  }

  function comparableEditorItem(item) {
    return {
      policy: item.policy || null,
      id: item.id || "",
      type: item.type || "",
      brand: item.brand || "",
      title: item.title || "",
      category: item.category || "",
      content: item.content || "",
      tags: item.tags || [],
      channels: item.channels || [],
      imageUrl: item.imageUrl || "",
      imageLabel: item.imageLabel || "",
      managerName: item.managerName || "",
      managerPhone: item.managerPhone || "",
      storePhone1: item.storePhone1 || "",
      storePhone2: item.storePhone2 || "",
      address: item.address || "",
      hours: item.hours || "",
      notes: item.notes || "",
      startDate: item.startDate || "",
      endDate: item.endDate || ""
    };
  }

  function isEditorDirty() {
    if (!$("#editorPanel").classList.contains("is-open") || !state.editorInitial) return false;
    return JSON.stringify(comparableEditorItem(readForm())) !== JSON.stringify(state.editorInitial);
  }

  function blankItem() {
    return {
      id: "", type: "script", brand: "", title: "", category: "", content: "",
      phone: "", managerName: "", managerPhone: "", storePhone1: "", storePhone2: "",
      address: "", hours: "", notes: "", startDate: "", endDate: "",
      imageUrl: "", imageLabel: "", tags: [], channels: []
    };
  }

  function currentType() {
    return ($("#f_type") && $("#f_type").value) || "script";
  }

  function getTypeIntro(type) {
    return TYPE_INTROS[type] || TYPE_INTROS.script;
  }

  function getTypeUI(type) {
    return TYPE_UI[type] || TYPE_UI.script;
  }

  function setContentInputs(value) {
    var next = value || "";
    if ($("#f_content")) $("#f_content").value = next;
    if ($("#f_promoContent")) $("#f_promoContent").value = next;
  }

  function syncContentMirrors(sourceId) {
    var source = $(sourceId);
    var target = sourceId === "#f_content" ? $("#f_promoContent") : $("#f_content");
    if (!source || !target) return;
    target.value = source.value;
  }

  function updateTypeUI() {
    var type = currentType();
    var intro = getTypeIntro(type);
    var typeUI = getTypeUI(type);
    var showBody = type === "script" || type === "note";
    var showPromo = type === "promotion" || type === "menu";
    var showPromoDates = type === "promotion";
    var showStore = type === "store";
    var showCategory = type === "policy" || type === "script" || type === "promotion" || type === "menu";
    var bodyTitle = type === "note" ? "Ghi chú nội dung" : "Nội dung script";

    $("#policyEditor").hidden = type !== "policy";
    $("#grpBodySection").hidden = !showBody;
    $("#grpPromoSection").hidden = !showPromo;
    $("#f_promoDatesTitleField").hidden = !showPromoDates;
    $("#f_startDateField").hidden = !showPromoDates;
    $("#f_endDateField").hidden = !showPromoDates;
    $("#grpStoreSection").hidden = !showStore;
    $("#f_categoryField").hidden = !showCategory;
    $("#grpBody").textContent = bodyTitle;
    $("#grpImg").textContent = typeUI.promoSectionTitle;
    $("#f_title").placeholder = typeUI.titlePlaceholder;
    $("#f_category").placeholder = typeUI.categoryPlaceholder;
    $("#editorPanel").setAttribute("data-type", type);
    $("#editorTypeBadge").textContent = TYPE_BADGES[type] || "Item";
    $("#editorTypeIntroTitle").textContent = intro.title;
    $("#editorTypeIntroCopy").textContent = intro.copy;

    document.querySelectorAll("[data-required-for]").forEach(function (el) {
      var types = (el.getAttribute("data-required-for") || "").split(/\s+/);
      el.hidden = types.indexOf(type) < 0;
    });
  }

  /* ---- auth ---------------------------------------------------------- */
  function getPw() { try { return sessionStorage.getItem(PW_KEY); } catch (e) { return null; } }
  function setPw(pw) { try { sessionStorage.setItem(PW_KEY, pw); } catch (e) {} }
  function clearPw() { try { sessionStorage.removeItem(PW_KEY); } catch (e) {} }

  function authHeaders() {
    var pw = getPw();
    return pw ? { "x-cms-password": pw } : {};
  }

  /* ---- API layer ----------------------------------------------------- */
  function httpErr(status) {
    var e = new Error("HTTP " + status);
    e.status = status;
    return e;
  }

  var API = {
    login: function (password) {
      return fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password })
      }).then(function (r) {
        if (r.status === 401) return { ok: false };
        if (!r.ok) throw httpErr(r.status);
        return r.json();
      });
    },
    data: function () {
      return fetch("/api/data", { headers: authHeaders() }).then(function (r) {
        if (!r.ok) throw httpErr(r.status);
        return r.json();
      });
    },
    save: function (items) {
      return fetch("/api/save", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
        body: JSON.stringify({ items: items })
      }).then(function (r) {
        if (!r.ok) throw httpErr(r.status);
        return r.json();
      });
    },
    upload: function (file) {
      var fd = new FormData();
      fd.append("file", file);
      // NOTE: do not set Content-Type — browser adds multipart boundary.
      return fetch("/api/upload", { method: "POST", headers: authHeaders(), body: fd })
        .then(function (r) {
          if (!r.ok) throw httpErr(r.status);
          return r.json();
        });
    }
  };

  /* ---- view switching ------------------------------------------------ */
  function showLogin() {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    setTimeout(function () { $("#loginPw").focus(); }, 30);
  }

  function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
  }

  function handleAuthExpired() {
    clearPw();
    showLogin();
    showLoginError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  /* ---- toast --------------------------------------------------------- */
  function toast(msg, type) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.remove("success", "error");
    el.classList.add(type === "error" ? "error" : "success", "is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 3400);
  }

  /* ---- header / dirty ------------------------------------------------ */
  function setDataSource(txt) { $("#dataSource").textContent = txt; }

  function updateDataSource() {
    setDataSource(state.items.length + " mục • Cập nhật lần cuối: " + fmtDateTime(state.updatedAt));
  }

  function updateSaveBtn() {
    var b = $("#saveAllBtn");
    b.disabled = !state.dirty;
    b.classList.toggle("is-dirty", state.dirty);
  }

  function markDirty() { state.dirty = true; updateSaveBtn(); }

  function showLoadError(show, msg) {
    var box = $("#loadError");
    if (show) {
      $("#loadErrorMsg").textContent = msg || "Không tải được dữ liệu.";
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }

  /* ---- data load ----------------------------------------------------- */
  function loadData() {
    showLoadError(false);
    setDataSource("Đang tải dữ liệu…");
    return API.data().then(function (d) {
      state.items = Array.isArray(d && d.items) ? d.items : [];
      state.updatedAt = (d && d.updatedAt) || null;
      state.loadedUpdatedAt = state.updatedAt;
      state.dirty = false;
      updateSaveBtn();
      render();
    }).catch(function (e) {
      if (e.status === 401) { handleAuthExpired(); return; }
      showLoadError(true, "Không tải được dữ liệu (" + (e.message || "lỗi mạng") + "). Kiểm tra kết nối rồi thử lại.");
      setDataSource("Lỗi tải dữ liệu.");
      render(); // still render (empty) so the shell is usable
    });
  }

  /* ---- render list --------------------------------------------------- */
  function render() {
    refreshFilterOptions();
    $("#filterStatus").parentElement.hidden = $("#filterType").value !== "promotion";
    applyFilters();
    updateDataSource();
  }

  function refreshFilterOptions() {
    var sel = $("#filterBrand");
    var cur = sel.value;
    var brands = uniqueSorted(state.items.map(function (it) { return it.brand; }).filter(Boolean));
    sel.innerHTML = '<option value="">Tất cả brand</option>' +
      brands.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + "</option>"; }).join("");
    sel.value = brands.indexOf(cur) >= 0 ? cur : "";

    // brand datalist for the editor (existing + base brands)
    var all = uniqueSorted(brands.concat(BASE_BRANDS));
    $("#brandList").innerHTML = all.map(function (b) {
      return '<option value="' + esc(b) + '"></option>';
    }).join("");
  }

  function uniqueSorted(arr) {
    var seen = {};
    var out = [];
    arr.forEach(function (v) { if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    out.sort(function (a, b) { return a.localeCompare(b, "vi"); });
    return out;
  }

  function applyFilters() {
    var result = getFilteredRows();
    var rows = result.rows;
    renderRows(rows);
    $("#resultSummary").textContent =
      rows.length + "/" + state.items.length + " mục" + (result.archivedHiddenCount ? " • " + result.archivedHiddenCount + " mục lưu trữ đang ẩn" : "");
    var empty = rows.length === 0;
    $("#emptyState").hidden = !empty;
    $("#tableWrap").hidden = empty;
  }

  function getFilteredRows() {
    var t = $("#filterType").value;
    var b = $("#filterBrand").value;
    var s = t === "promotion" ? $("#filterStatus").value : "";
    var q = normalizeText($("#searchInput").value);
    var showArchived = $("#showArchived").checked;
    var rows = [];
    var archivedHiddenCount = 0;
    state.items.forEach(function (it, i) {
      if (!showArchived && isArchived(it)) {
        archivedHiddenCount += 1;
        return;
      }
      if (t && it.type !== t) return;
      if (b && it.brand !== b) return;
      if (s) {
        if (s === "archived") {
          if (!isArchived(it)) return;
        } else if (it.type !== "promotion" || getPromotionStatus(it) !== s) {
          return;
        }
      }
      if (q) {
        var hay = [it.title, it.content, it.brand, it.address].map(function (x) {
          return normalizeText(x);
        }).join(" ");
        if (hay.indexOf(q) < 0) return;
      }
      rows.push({ it: it, i: i });
    });
    return { rows: rows, archivedHiddenCount: archivedHiddenCount };
  }

  function renderRows(rows) {
    $("#tableBody").innerHTML = rows.map(function (row) {
      var it = row.it;
      var pos = rows.indexOf(row);
      var canMoveUp = pos > 0;
      var canMoveDown = pos < rows.length - 1;
      var archived = isArchived(it);
      var promoStatus = !archived ? getPromotionStatus(it) : "";
      var actionBtn = isSoftArchivable(it)
        ? (archived
          ? '<button class="row-btn" type="button" data-act="restore" data-index="' + row.i + '">Khôi phục</button>'
          : '<button class="row-btn warn" type="button" data-act="archive" data-index="' + row.i + '">' + (it.type === "promotion" ? "Ẩn CTKM" : "Lưu trữ") + '</button>')
        : '<button class="row-btn danger" type="button" data-act="del" data-index="' + row.i + '">Xoá</button>';
      var thumb = it.imageUrl
        ? '<img class="thumb" src="' + esc(it.imageUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<span class="thumb-empty" aria-hidden="true">—</span>';
      var when = fmtDate(it.updatedAt || state.updatedAt);
      return "<tr" + (archived ? ' class="is-archived"' : "") + ">" +
        '<td class="cell-thumb">' + thumb + "</td>" +
        "<td><span class=\"badge " + esc(it.type) + "\">" + esc(typeLabel(it.type)) + "</span>" +
          (promoStatus ? ' <span class="badge ' + esc(promoStatus) + '">' + esc(promotionStatusLabel(promoStatus)) + "</span>" : "") +
          (archived ? ' <span class="badge">LƯU TRỮ</span>' : "") +
        "</td>" +
        '<td><span class="brand-chip" data-brand="' + esc(it.brand) + '">' + esc(it.brand || "—") + "</span></td>" +
        '<td class="cell-title"><strong>' + esc(it.title || "(chưa có tiêu đề)") + "</strong><small>" + esc(it.id || "") + "</small></td>" +
        "<td>" + esc(it.category || "—") + "</td>" +
        '<td class="cell-when">' + esc(when) + "</td>" +
        '<td><div class="row-actions">' +
          '<div class="order-actions" role="group" aria-label="Sắp xếp">' +
            '<button class="row-btn icon-row-btn" type="button" data-act="moveTop" data-index="' + row.i + '" title="Đưa lên đầu danh sách lọc" aria-label="Đưa lên đầu danh sách lọc"' + (canMoveUp ? "" : " disabled") + '>⇈</button>' +
            '<button class="row-btn icon-row-btn" type="button" data-act="moveUp" data-index="' + row.i + '" title="Đưa lên một dòng" aria-label="Đưa lên một dòng"' + (canMoveUp ? "" : " disabled") + '>↑</button>' +
            '<button class="row-btn icon-row-btn" type="button" data-act="moveDown" data-index="' + row.i + '" title="Đưa xuống một dòng" aria-label="Đưa xuống một dòng"' + (canMoveDown ? "" : " disabled") + '>↓</button>' +
            '<button class="row-btn icon-row-btn" type="button" data-act="moveBottom" data-index="' + row.i + '" title="Đưa xuống cuối danh sách lọc" aria-label="Đưa xuống cuối danh sách lọc"' + (canMoveDown ? "" : " disabled") + '>⇊</button>' +
          "</div>" +
          '<button class="row-btn" type="button" data-act="edit" data-index="' + row.i + '">Sửa</button>' +
          actionBtn +
        "</div></td>" +
      "</tr>";
    }).join("");
  }

  function insertItemRelativeToTarget(sourceIndex, targetIndex, afterTarget) {
    if (sourceIndex === targetIndex) return false;
    var item = state.items[sourceIndex];
    var target = state.items[targetIndex];
    if (!item || !target) return false;
    state.items.splice(sourceIndex, 1);
    var nextTargetIndex = state.items.indexOf(target);
    if (nextTargetIndex < 0) return false;
    state.items.splice(nextTargetIndex + (afterTarget ? 1 : 0), 0, item);
    return true;
  }

  function moveFilteredItem(index, action) {
    var rows = getFilteredRows().rows;
    var pos = -1;
    rows.forEach(function (row, i) {
      if (row.i === index) pos = i;
    });
    if (pos < 0 || rows.length < 2) return;

    var moved = false;
    if (action === "moveTop" && pos > 0) {
      moved = insertItemRelativeToTarget(index, rows[0].i, false);
    } else if (action === "moveUp" && pos > 0) {
      moved = insertItemRelativeToTarget(index, rows[pos - 1].i, false);
    } else if (action === "moveDown" && pos < rows.length - 1) {
      moved = insertItemRelativeToTarget(index, rows[pos + 1].i, true);
    } else if (action === "moveBottom" && pos < rows.length - 1) {
      moved = insertItemRelativeToTarget(index, rows[rows.length - 1].i, true);
    }

    if (!moved) return;
    markDirty();
    render();
    toast("Đã đổi thứ tự (chưa lưu). Nhấn 💾 Lưu tất cả để lưu.");
  }

  /* ---- editor drawer ------------------------------------------------- */
  function openDrawer() {
    $("#editorOverlay").classList.add("is-open");
    $("#editorOverlay").setAttribute("aria-hidden", "false");
    $("#editorPanel").classList.add("is-open");
    $("#editorPanel").setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    $("#editorOverlay").classList.remove("is-open");
    $("#editorOverlay").setAttribute("aria-hidden", "true");
    $("#editorPanel").classList.remove("is-open");
    $("#editorPanel").setAttribute("aria-hidden", "true");
  }

  function openEditor(index, presetType) {
    state.editingIndex = (index == null ? null : index);
    var draft = index == null ? blankItem() : deepClone(state.items[index]);
    if (index == null && presetType) draft.type = presetType;
    clearInvalid();
    refreshFilterOptions(); // make sure brand datalist is current
    fillForm(draft);
    state.editorInitial = comparableEditorItem(draft);
    $("#editorTitle").textContent = index == null ? "Thêm mới" : "Chỉnh sửa";
    lastFocus = document.activeElement;
    openDrawer();
    setTimeout(function () { $("#f_title").focus(); }, 80);
  }

  function closeEditor(force) {
    if (force !== true && isEditorDirty() && !window.confirm("Bạn có thay đổi chưa lưu cho mục này. Đóng lại và bỏ các thay đổi?")) return;
    closeDrawer();
    state.editingIndex = null;
    state.editorInitial = null;
    if (lastFocus && lastFocus.focus) {
      var el = lastFocus;
      setTimeout(function () { try { el.focus(); } catch (e) {} }, 0);
    }
  }

  function fillForm(it) {
    $("#f_id").value = it.id || "";
    $("#f_type").value = it.type || "script";
    $("#f_brand").value = it.brand || "";
    $("#f_title").value = it.title || "";
    $("#f_category").value = it.category || "";
    setContentInputs(it.content || "");
    $("#f_tags").value = (it.tags || []).join(", ");
    $("#f_channels").value = (it.channels || []).join(", ");
    $("#f_imageUrl").value = it.imageUrl || "";
    $("#f_imageLabel").value = it.imageLabel || "";
    $("#f_managerName").value = it.managerName || "";
    $("#f_managerPhone").value = it.managerPhone || "";
    $("#f_storePhone1").value = it.storePhone1 || "";
    $("#f_storePhone2").value = it.storePhone2 || "";
    $("#f_address").value = it.address || "";
    setHoursControls(it.hours || "");
    $("#f_notes").value = it.notes || "";
    $("#f_startDate").value = normalizeDateValue(it.startDate);
    $("#f_endDate").value = normalizeDateValue(it.endDate);
    var policy = it.policy || {};
    ["status", "version", "effectiveDate", "resolution", "refund", "extra", "verify", "escalation"].forEach(function (key) {
      $("#p_" + key).value = policy[key] || (key === "status" ? "draft" : "");
    });
    $("#policyMessageFields").innerHTML = "";
    (Array.isArray(policy.messages) && policy.messages.length ? policy.messages : [{title:"",content:""}]).forEach(addMessageField);
    updateTypeUI();
    updatePreview();
  }

  var messageSequence = 0;
  function addMessageField(message) {
    var id = ++messageSequence;
    var field = document.createElement("div");
    field.className = "policy-message-field";
    field.innerHTML = '<label class="field-label" for="message-title-' + id + '">Tên bước / phương án</label><input id="message-title-' + id + '" data-message-title placeholder="VD: Đề nghị giao lại" value="' + esc(message.title || "") + '" /><label class="field-label" for="message-content-' + id + '">Câu chat được sao chép</label><textarea id="message-content-' + id + '" data-message-content rows="5">' + esc(message.content || "") + '</textarea><button type="button" class="row-btn" data-remove-message>Bỏ mẫu này</button>';
    $("#policyMessageFields").appendChild(field);
  }

  function readPolicyForm() {
    var result = {};
    ["status", "version", "effectiveDate", "resolution", "refund", "extra", "verify", "escalation"].forEach(function (key) { result[key] = $("#p_" + key).value.trim(); });
    result.messages = Array.from(document.querySelectorAll(".policy-message-field")).map(function (field) {
      return {title: field.querySelector("[data-message-title]").value.trim(), content: field.querySelector("[data-message-content]").value.trim()};
    }).filter(function (message) { return message.title || message.content; });
    return result;
  }

  function readForm() {
    var type = $("#f_type").value;
    updateHoursValue();
    return {
      id: $("#f_id").value.trim(),
      type: type,
      ...(type === "policy" ? {policy: readPolicyForm()} : {}),
      brand: $("#f_brand").value.trim(),
      title: $("#f_title").value.trim(),
      category: $("#f_category").value.trim(),
      content: (type === "promotion" || type === "menu" ? $("#f_promoContent").value : $("#f_content").value),
      tags: parseList($("#f_tags").value),
      channels: parseList($("#f_channels").value),
      imageUrl: $("#f_imageUrl").value.trim(),
      imageLabel: $("#f_imageLabel").value.trim(),
      phone: "",
      managerName: $("#f_managerName").value.trim(),
      managerPhone: $("#f_managerPhone").value.trim(),
      storePhone1: $("#f_storePhone1").value.trim(),
      storePhone2: $("#f_storePhone2").value.trim(),
      address: $("#f_address").value.trim(),
      hours: $("#f_hours").value.trim(),
      notes: $("#f_notes").value,
      startDate: type === "promotion" ? $("#f_startDate").value : "",
      endDate: type === "promotion" ? $("#f_endDate").value : ""
    };
  }

  function ensureUniqueId(id, exceptIndex) {
    var base = id || "item";
    var candidate = base;
    var n = 2;
    var taken = {};
    state.items.forEach(function (it, i) {
      if (i !== exceptIndex && it.id) taken[it.id] = 1;
    });
    while (taken[candidate]) { candidate = base + "-" + n; n++; }
    return candidate;
  }

  function markInvalid(el) {
    if (!el) return;
    el.classList.add("is-invalid");
    el.addEventListener("input", function once() {
      el.classList.remove("is-invalid");
      el.removeEventListener("input", once);
    });
  }

  function requestCloseEditor(force) {
    if (force === true) {
      closeEditor(true);
      return;
    }
    // Defer confirm out of the current keyboard/click event so Esc doesn't
    // immediately dismiss the browser confirm dialog.
    setTimeout(function () {
      closeEditor(false);
    }, 0);
  }

  function clearInvalid() {
    var els = document.querySelectorAll(".is-invalid");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("is-invalid");
  }

  function getStoreContactValue(item) {
    return [
      item.address,
      item.managerPhone,
      item.storePhone1,
      item.storePhone2
    ].join("").trim();
  }

  function onEditorSubmit(e) {
    e.preventDefault();
    var isNew = state.editingIndex == null;
    var item = readForm();
    var type = item.type;

    clearInvalid();
    var problems = [];
    if (!item.title) problems.push(["#f_title", "Tiêu đề"]);
    if (!item.brand) problems.push(["#f_brand", "Brand"]);
    if (!item.type) problems.push(["#f_type", "Loại"]);
    if ((type === "script" || type === "note") && !item.content.trim()) {
      problems.push(["#f_content", type === "script" ? "Nội dung script" : "Nội dung ghi chú"]);
    }
    if ((type === "promotion" || type === "menu") && !item.content.trim() && !item.imageUrl) {
      problems.push(["#f_promoContent", "Nội dung mô tả hoặc hình ảnh"]);
    }
    if (type === "store" && !getStoreContactValue(item)) {
      problems.push(["#f_address", "Ít nhất một thông tin cửa hàng hoặc liên hệ"]);
    }
    if (item.startDate && item.endDate && item.startDate > item.endDate) {
      problems.push(["#f_startDate", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc"]);
      problems.push(["#f_endDate", "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu"]);
    }
    if (item.type === "policy") {
      item.policy = readPolicyForm();
      if (!item.policy.resolution) problems.push(["#p_resolution", "Ưu tiên xử lý"]);
      if (!item.category) problems.push(["#f_category", "Danh mục"]);
      if (!item.policy.messages.length || item.policy.messages.some(function (message) { return !message.title || !message.content; })) {
        toast("Mỗi chính sách cần ít nhất một mẫu chat có tên và nội dung đầy đủ.", "error");
        return;
      }
      if (item.policy.status === "active") {
        if (!item.policy.version) problems.push(["#p_version", "Phiên bản"]);
        if (!item.policy.effectiveDate) problems.push(["#p_effectiveDate", "Ngày hiệu lực"]);
      }
    }
    if (problems.length) {
      problems.forEach(function (p) { markInvalid($(p[0])); });
      toast("Vui lòng nhập: " + problems.map(function (p) { return p[1]; }).join(", "), "error");
      $(problems[0][0]).focus();
      return;
    }

    item.id = ensureUniqueId(item.id || slugify(item.title), isNew ? -1 : state.editingIndex);
    item.updatedAt = new Date().toISOString();

    if (isNew) state.items.push(item);
    else {
      if (item.type === "policy") item.policy = Object.assign({}, state.items[state.editingIndex].policy || {}, item.policy);
      state.items[state.editingIndex] = Object.assign({}, state.items[state.editingIndex], item);
    }

    markDirty();
    render();
    state.editorInitial = comparableEditorItem(item);
    closeEditor(true);
    toast((isNew ? "Đã thêm" : "Đã cập nhật") + " mục (chưa lưu). Nhấn 💾 Lưu tất cả để lưu.");
  }

  function deleteItem(index) {
    var it = state.items[index];
    if (!it) return;
    var name = it.title || it.id || "mục này";
    if (!window.confirm('Xoá "' + name + '"?\n(Chỉ áp dụng sau khi bấm "Lưu tất cả".)')) return;
    state.items.splice(index, 1);
    markDirty();
    render();
    toast("Đã xoá (chưa lưu). Nhấn 💾 Lưu tất cả để lưu.");
  }

  function archiveItem(index) {
    var it = state.items[index];
    if (!it || !isSoftArchivable(it) || isArchived(it)) return;
    var name = it.title || it.id || "mục này";
    if (!window.confirm('Lưu trữ "' + name + '"?\nMục sẽ bị ẩn khỏi app nhưng vẫn có thể khôi phục sau.')) return;
    it.archivedAt = new Date().toISOString();
    it.updatedAt = it.archivedAt;
    markDirty();
    render();
    toast("Đã chuyển vào lưu trữ (chưa lưu).");
  }

  function restoreItem(index) {
    var it = state.items[index];
    if (!it || !isSoftArchivable(it) || !isArchived(it)) return;
    delete it.archivedAt;
    it.updatedAt = new Date().toISOString();
    markDirty();
    render();
    toast("Đã khôi phục mục (chưa lưu).");
  }

  /* ---- image upload -------------------------------------------------- */
  function updatePreview() {
    var url = $("#f_imageUrl").value.trim();
    var wrap = $("#imgPreview");
    var img = $("#imgPreviewImg");
    if (url) {
      img.src = url;
      wrap.classList.add("show");
    } else {
      img.removeAttribute("src");
      wrap.classList.remove("show");
    }
  }

  function validateImage(file) {
    if (!file.type || file.type.indexOf("image/") !== 0) {
      toast("Chỉ chấp nhận tệp ảnh.", "error");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Ảnh vượt quá 10MB.", "error");
      return false;
    }
    return true;
  }

  function handleImageFile(file) {
    if (!file || !validateImage(file)) return;
    uploadImage(file);
  }

  function uploadImage(file) {
    var dz = $("#dropzone");
    var label = dz.querySelector(".dz-main");
    var prevHtml = label.innerHTML;
    dz.classList.add("is-loading");
    label.textContent = "Đang tải ảnh lên…";
    API.upload(file).then(function (res) {
      if (res && res.url) {
        $("#f_imageUrl").value = res.url;
        updatePreview();
        toast("Đã tải ảnh lên.");
      } else {
        throw new Error("phản hồi không hợp lệ");
      }
    }).catch(function (e) {
      if (e.status === 401) { handleAuthExpired(); }
      else toast("Tải ảnh thất bại: " + (e.message || "lỗi mạng"), "error");
    }).then(function () {
      dz.classList.remove("is-loading");
      label.innerHTML = prevHtml;
    });
  }

  /* ---- save all ------------------------------------------------------ */
  function saveAll() {
    if (!state.dirty) return;
    var btn = $("#saveAllBtn");
    var prevHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Đang lưu…";
    API.data().then(function (serverData) {
      var serverUpdatedAt = (serverData && serverData.updatedAt) || null;
      if (serverUpdatedAt !== state.loadedUpdatedAt) {
        showLoadError(true, "Dữ liệu trên server đã thay đổi từ nơi khác. Vui lòng tải lại trước khi lưu để tránh ghi đè.");
        toast("Không thể lưu vì dữ liệu trên server đã thay đổi. Vui lòng tải lại.", "error");
        throw new Error("__version_conflict__");
      }
      return API.save(state.items);
    }).then(function (res) {
      state.dirty = false;
      if (res && res.updatedAt) state.updatedAt = res.updatedAt;
      state.loadedUpdatedAt = state.updatedAt;
      btn.innerHTML = prevHtml;
      updateSaveBtn();
      updateDataSource();
      var count = (res && res.count != null) ? res.count : state.items.length;
      toast("Đã lưu " + count + " mục.");
    }).catch(function (e) {
      btn.innerHTML = prevHtml;
      updateSaveBtn();
      if (e && e.message === "__version_conflict__") return;
      if (e.status === 401) { toast("Phiên hết hạn.", "error"); handleAuthExpired(); }
      else toast("Lưu thất bại: " + (e.message || "lỗi mạng"), "error");
    });
  }

  /* ---- login / logout ------------------------------------------------ */
  function showLoginError(msg) {
    var el = $("#loginError");
    el.textContent = msg;
    el.hidden = false;
  }

  function onLogin(e) {
    e.preventDefault();
    var pw = $("#loginPw").value;
    $("#loginError").hidden = true;
    var btn = $("#loginSubmit");
    var prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Đang đăng nhập…";
    API.login(pw).then(function (res) {
      if (res && res.ok) {
        setPw(pw);
        $("#loginPw").value = "";
        showApp();
        loadData();
      } else {
        showLoginError("Sai mật khẩu.");
        $("#loginPw").value = "";
        $("#loginPw").focus();
      }
    }).catch(function () {
      showLoginError("Không kết nối được máy chủ. Vui lòng thử lại.");
    }).then(function () {
      btn.disabled = false;
      btn.textContent = prev;
    });
  }

  function logout() {
    if (state.dirty && !window.confirm("Có thay đổi chưa lưu. Đăng xuất và bỏ các thay đổi?")) return;
    clearPw();
    state.items = [];
    state.dirty = false;
    state.updatedAt = null;
    state.loadedUpdatedAt = null;
    state.editorInitial = null;
    showLogin();
  }

  /* ---- wiring -------------------------------------------------------- */
  function bind() {
    $("#addPolicyMessage").addEventListener("click", function () { addMessageField({}); });
    $("#policyMessageFields").addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-message]");
      if (button) button.closest(".policy-message-field").remove();
    });
    $("#addPolicyBtn").addEventListener("click", function () { openEditor(null, "policy"); });

    $("#loginForm").addEventListener("submit", onLogin);
    $("#saveAllBtn").addEventListener("click", saveAll);
    $("#logoutBtn").addEventListener("click", logout);
    $("#addScriptBtn").addEventListener("click", function () { openEditor(null, "script"); });
    $("#addPromoBtn").addEventListener("click", function () { openEditor(null, "promotion"); });
    $("#addMenuBtn").addEventListener("click", function () { openEditor(null, "menu"); });
    $("#addStoreBtn").addEventListener("click", function () { openEditor(null, "store"); });
    $("#loadRetry").addEventListener("click", function () {
      if (state.dirty && !window.confirm("Tải lại sẽ bỏ các thay đổi chưa lưu. Tiếp tục?")) return;
      loadData();
    });

    $("#filterType").addEventListener("change", applyFilters);
    $("#filterBrand").addEventListener("change", applyFilters);
    $("#filterStatus").addEventListener("change", applyFilters);
    $("#searchInput").addEventListener("input", applyFilters);
    $("#showArchived").addEventListener("change", applyFilters);

    // table row actions (event delegation)
    $("#tableBody").addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("button[data-act]");
      if (!btn) return;
      var i = parseInt(btn.getAttribute("data-index"), 10);
      var act = btn.getAttribute("data-act");
      if (act === "edit") openEditor(i);
      else if (act === "archive") archiveItem(i);
      else if (act === "restore") restoreItem(i);
      else if (act === "moveTop" || act === "moveUp" || act === "moveDown" || act === "moveBottom") moveFilteredItem(i, act);
      else deleteItem(i);
    });

    // editor
    $("#editorForm").addEventListener("submit", onEditorSubmit);
    $("#editorCancel").addEventListener("click", function () { requestCloseEditor(false); });
    $("#editorClose").addEventListener("click", function () { requestCloseEditor(false); });
    $("#editorOverlay").addEventListener("click", function () { requestCloseEditor(false); });
    $("#f_type").addEventListener("change", updateTypeUI);
    $("#f_content").addEventListener("input", function () { syncContentMirrors("#f_content"); });
    $("#f_promoContent").addEventListener("input", function () { syncContentMirrors("#f_promoContent"); });
    $("#f_hoursOpenHour").addEventListener("change", onHoursControlChange);
    $("#f_hoursOpenMinute").addEventListener("change", onHoursControlChange);
    $("#f_hoursCloseHour").addEventListener("change", onHoursControlChange);
    $("#f_hoursCloseMinute").addEventListener("change", onHoursControlChange);
    $("#f_hoursAllDay").addEventListener("change", onHoursControlChange);

    // image controls
    var dz = $("#dropzone");
    var fileInput = $("#fileInput");
    dz.addEventListener("click", function () { fileInput.click(); });
    dz.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) handleImageFile(f);
      e.target.value = "";
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("is-drag"); });
    });
    ["dragleave", "dragend"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { if (e.target === dz) dz.classList.remove("is-drag"); });
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      dz.classList.remove("is-drag");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleImageFile(f);
    });
    $("#f_imageUrl").addEventListener("input", updatePreview);
    $("#clearImgBtn").addEventListener("click", function () {
      $("#f_imageUrl").value = "";
      updatePreview();
    });

    // keyboard: Esc closes editor, Ctrl/Cmd+S saves
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $("#editorPanel").classList.contains("is-open")) {
        e.preventDefault();
        requestCloseEditor(false);
      }
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === "s") {
        if (!$("#appView").hidden) { e.preventDefault(); saveAll(); }
      }
    });

    // warn on unload if unsaved
    window.addEventListener("beforeunload", function (e) {
      if (state.dirty) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  /* ---- boot ---------------------------------------------------------- */
  function init() {
    initHoursSelectOptions();
    bind();
    if (getPw()) {
      showApp();
      loadData();
    } else {
      showLogin();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
