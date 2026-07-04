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
    promotion: "CTKM",
    store: "CỬA HÀNG",
    menu: "MENU",
    note: "GHI CHÚ KHÁC"
  };
  var BASE_BRANDS = ["TUTIMI", "SEKAI", "DHI"];

  /* ---- tiny helpers -------------------------------------------------- */
  var $ = function (sel) { return document.querySelector(sel); };

  var state = {
    items: [],
    updatedAt: null,
    dirty: false,
    editingIndex: null
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

  function slugify(s) {
    var out = (s || "").toString().toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return out || "item";
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

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function blankItem() {
    return {
      id: "", type: "script", brand: "", title: "", category: "", content: "",
      phone: "", managerName: "", managerPhone: "", storePhone1: "", storePhone2: "",
      address: "", hours: "", notes: "", startDate: "", endDate: "",
      imageUrl: "", imageLabel: "", tags: [], channels: []
    };
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
    var t = $("#filterType").value;
    var b = $("#filterBrand").value;
    var q = $("#searchInput").value.trim().toLowerCase();
    var rows = [];
    state.items.forEach(function (it, i) {
      if (t && it.type !== t) return;
      if (b && it.brand !== b) return;
      if (q) {
        var hay = [it.title, it.content, it.brand].map(function (x) {
          return (x || "").toLowerCase();
        }).join(" ");
        if (hay.indexOf(q) < 0) return;
      }
      rows.push({ it: it, i: i });
    });
    renderRows(rows);
    $("#resultSummary").textContent = rows.length + "/" + state.items.length + " mục";
    var empty = rows.length === 0;
    $("#emptyState").hidden = !empty;
    $("#tableWrap").hidden = empty;
  }

  function renderRows(rows) {
    $("#tableBody").innerHTML = rows.map(function (row) {
      var it = row.it;
      var thumb = it.imageUrl
        ? '<img class="thumb" src="' + esc(it.imageUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<span class="thumb-empty" aria-hidden="true">—</span>';
      var when = fmtDate(it.updatedAt || state.updatedAt);
      return "<tr>" +
        '<td class="cell-thumb">' + thumb + "</td>" +
        "<td><span class=\"badge " + esc(it.type) + "\">" + esc(typeLabel(it.type)) + "</span></td>" +
        '<td><span class="brand-chip" data-brand="' + esc(it.brand) + '">' + esc(it.brand || "—") + "</span></td>" +
        '<td class="cell-title"><strong>' + esc(it.title || "(chưa có tiêu đề)") + "</strong><small>" + esc(it.id || "") + "</small></td>" +
        "<td>" + esc(it.category || "—") + "</td>" +
        '<td class="cell-when">' + esc(when) + "</td>" +
        '<td><div class="row-actions">' +
          '<button class="row-btn" type="button" data-act="edit" data-index="' + row.i + '">Sửa</button>' +
          '<button class="row-btn danger" type="button" data-act="del" data-index="' + row.i + '">Xoá</button>' +
        "</div></td>" +
      "</tr>";
    }).join("");
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

  function openEditor(index) {
    state.editingIndex = (index == null ? null : index);
    var draft = index == null ? blankItem() : deepClone(state.items[index]);
    clearInvalid();
    refreshFilterOptions(); // make sure brand datalist is current
    fillForm(draft);
    $("#editorTitle").textContent = index == null ? "Thêm mới" : "Chỉnh sửa";
    lastFocus = document.activeElement;
    openDrawer();
    setTimeout(function () { $("#f_title").focus(); }, 80);
  }

  function closeEditor() {
    closeDrawer();
    state.editingIndex = null;
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
    $("#f_content").value = it.content || "";
    $("#f_tags").value = (it.tags || []).join(", ");
    $("#f_channels").value = (it.channels || []).join(", ");
    $("#f_imageUrl").value = it.imageUrl || "";
    $("#f_imageLabel").value = it.imageLabel || "";
    $("#f_phone").value = it.phone || "";
    $("#f_managerName").value = it.managerName || "";
    $("#f_managerPhone").value = it.managerPhone || "";
    $("#f_storePhone1").value = it.storePhone1 || "";
    $("#f_storePhone2").value = it.storePhone2 || "";
    $("#f_address").value = it.address || "";
    $("#f_hours").value = it.hours || "";
    $("#f_notes").value = it.notes || "";
    $("#f_startDate").value = it.startDate || "";
    $("#f_endDate").value = it.endDate || "";
    updatePreview();
  }

  function readForm() {
    return {
      id: $("#f_id").value.trim(),
      type: $("#f_type").value,
      brand: $("#f_brand").value.trim(),
      title: $("#f_title").value.trim(),
      category: $("#f_category").value.trim(),
      content: $("#f_content").value,
      tags: parseList($("#f_tags").value),
      channels: parseList($("#f_channels").value),
      imageUrl: $("#f_imageUrl").value.trim(),
      imageLabel: $("#f_imageLabel").value.trim(),
      phone: $("#f_phone").value.trim(),
      managerName: $("#f_managerName").value.trim(),
      managerPhone: $("#f_managerPhone").value.trim(),
      storePhone1: $("#f_storePhone1").value.trim(),
      storePhone2: $("#f_storePhone2").value.trim(),
      address: $("#f_address").value.trim(),
      hours: $("#f_hours").value.trim(),
      notes: $("#f_notes").value,
      startDate: $("#f_startDate").value,
      endDate: $("#f_endDate").value
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

  function clearInvalid() {
    var els = document.querySelectorAll(".is-invalid");
    for (var i = 0; i < els.length; i++) els[i].classList.remove("is-invalid");
  }

  function onEditorSubmit(e) {
    e.preventDefault();
    var isNew = state.editingIndex == null;
    var item = readForm();

    clearInvalid();
    var problems = [];
    if (!item.title) problems.push(["#f_title", "Tiêu đề"]);
    if (!item.brand) problems.push(["#f_brand", "Brand"]);
    if (!item.type) problems.push(["#f_type", "Loại"]);
    if (problems.length) {
      problems.forEach(function (p) { markInvalid($(p[0])); });
      toast("Vui lòng nhập: " + problems.map(function (p) { return p[1]; }).join(", "), "error");
      $(problems[0][0]).focus();
      return;
    }

    item.id = ensureUniqueId(item.id || slugify(item.title), isNew ? -1 : state.editingIndex);
    item.updatedAt = new Date().toISOString();

    if (isNew) state.items.push(item);
    else state.items[state.editingIndex] = item;

    markDirty();
    render();
    closeEditor();
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
    API.save(state.items).then(function (res) {
      state.dirty = false;
      if (res && res.updatedAt) state.updatedAt = res.updatedAt;
      btn.innerHTML = prevHtml;
      updateSaveBtn();
      updateDataSource();
      var count = (res && res.count != null) ? res.count : state.items.length;
      toast("Đã lưu " + count + " mục.");
    }).catch(function (e) {
      btn.innerHTML = prevHtml;
      updateSaveBtn();
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
    showLogin();
  }

  /* ---- wiring -------------------------------------------------------- */
  function bind() {
    $("#loginForm").addEventListener("submit", onLogin);
    $("#saveAllBtn").addEventListener("click", saveAll);
    $("#logoutBtn").addEventListener("click", logout);
    $("#addBtn").addEventListener("click", function () { openEditor(null); });
    $("#loadRetry").addEventListener("click", loadData);

    $("#filterType").addEventListener("change", applyFilters);
    $("#filterBrand").addEventListener("change", applyFilters);
    $("#searchInput").addEventListener("input", applyFilters);

    // table row actions (event delegation)
    $("#tableBody").addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("button[data-act]");
      if (!btn) return;
      var i = parseInt(btn.getAttribute("data-index"), 10);
      if (btn.getAttribute("data-act") === "edit") openEditor(i);
      else deleteItem(i);
    });

    // editor
    $("#editorForm").addEventListener("submit", onEditorSubmit);
    $("#editorCancel").addEventListener("click", closeEditor);
    $("#editorClose").addEventListener("click", closeEditor);
    $("#editorOverlay").addEventListener("click", closeEditor);

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
        closeEditor();
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
