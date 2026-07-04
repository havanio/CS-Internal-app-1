# Hướng dẫn: Import dữ liệu đầu kỳ từ một project Netlify khác

> Runbook chi tiết để **sao chép toàn bộ dữ liệu đầu kỳ (nội dung + ảnh)** từ một
> project Netlify (NGUỒN) sang một project Netlify khác (ĐÍCH).
> Áp dụng khi: bàn giao source cho người khác dựng, tách môi trường (staging/prod),
> hoặc nhân bản dữ liệu sang site mới.

---

## 0. TL;DR (cho người vội)

```bash
# 1. Lấy source về + cài
git clone <repo> && cd <repo> && npm install
netlify login

# 2. (Chỉ khi cần refresh) Export dữ liệu từ project NGUỒN vào ./seed
BASE=https://<project-nguon>.netlify.app npm run seed:export

# 3. Deploy repo lên project ĐÍCH + đặt mật khẩu admin
#    ⚠️ ĐỌC KỸ MỤC 4 trước khi chạy env:set / deploy khi có nhiều site!
netlify unlink && netlify link --id <SITE_ID_DICH>
netlify status | grep "Site Id"        # BẮT BUỘC xác nhận đúng site đích
netlify env:set CMS_PASSWORD "<mat-khau-cua-ban>"
netlify deploy --prod                  # deploy + áp env

# 4. Nạp dữ liệu + ảnh vào Blobs của project ĐÍCH
BASE=https://<project-dich>.netlify.app CMS_PASSWORD="<mat-khau-cua-ban>" npm run seed:import

# 5. Verify
curl -s https://<project-dich>.netlify.app/api/data | python3 -c "import json,sys;print(len(json.load(sys.stdin)['items']),'mục')"
```

---

## 1. Nguyên lý — vì sao phải làm bước này

Dữ liệu của app nằm **2 chỗ khác nhau về tính di động**:

| # | Dữ liệu | Lưu ở | Đi theo source code (git)? |
|---|---|---|---|
| 1 | Nội dung (text 135+ mục) | `netlify/functions/content.seed.json` (trong repo) | ✅ Có — tự seed khi Blobs rỗng |
| 2 | **Ảnh** | **Netlify Blobs** — kho **riêng của từng site** | ❌ **KHÔNG** — không nằm trong repo |

**Điểm mấu chốt:** Netlify Blobs là kho lưu trữ **gắn với một site Netlify cụ thể**. Khi
bạn deploy repo lên site mới, site mới có Blobs **rỗng** → ảnh (imageUrl dạng
`/api/img/<key>`) sẽ **404** vì key đó chỉ tồn tại trong Blobs của site cũ.

→ Vì vậy cần **bộ `seed/`** (đóng gói content + file ảnh vào repo) + script `seed:import`
để **upload lại ảnh vào Blobs của site đích** và viết content trỏ đúng key mới.

```
Project NGUỒN                     Repo (git)                    Project ĐÍCH
┌───────────────┐   export    ┌──────────────┐    import   ┌───────────────┐
│ Blobs:        │ ──────────▶ │ seed/        │ ──────────▶ │ Blobs:        │
│  content      │             │  content.json│             │  content (mới)│
│  images/*     │             │  images/*    │             │  images/* mới │
└───────────────┘             └──────────────┘             └───────────────┘
     (nguồn)              (đi theo git, portable)              (đích)
```

---

## 2. Chuẩn bị

| # | Cần | Ghi chú |
|---|---|---|
| 1 | Node.js ≥ 18 | Script dùng `fetch`/`FormData` native (Node 22 khuyến nghị) |
| 2 | `netlify-cli` | `npm install` trong repo đã có sẵn (devDependency) |
| 3 | Đăng nhập Netlify | `netlify login` **hoặc** `export NETLIFY_AUTH_TOKEN=<token>` |
| 4 | Quyền vào **cả 2** project (nguồn + đích) | Cùng 1 tài khoản/team là tiện nhất |
| 5 | **Mật khẩu admin** (`CMS_PASSWORD`) của project đích | Do bạn tự đặt cho site đích |

Lấy `SITE_ID`: chạy `netlify sites:list`, hoặc mở dashboard site → URL có dạng
`app.netlify.com/projects/<ten-site>` → vào **Project configuration** xem *Site ID*.

---

## 3. Quy trình đầy đủ (A → Z)

### Bước 1 — Export dữ liệu từ project NGUỒN → `seed/`

> Bỏ qua bước này nếu repo đã có sẵn thư mục `seed/` mới (đã commit). Chỉ chạy khi
> muốn **cập nhật snapshot** theo dữ liệu mới nhất của project nguồn.

```bash
BASE=https://<project-nguon>.netlify.app npm run seed:export
```

Kết quả:
- `seed/content.json` — toàn bộ mục, ảnh được lưu dưới dạng tham chiếu `seed:<tên-file>`.
- `seed/images/<tên-file>` — mọi ảnh, tải trực tiếp từ Blobs của nguồn.

Kiểm tra nhanh:
```bash
ls seed/images | wc -l                                   # số ảnh
python3 -c "import json;print(json.load(open('seed/content.json'))['count'],'mục')"
```

### Bước 2 — Deploy repo lên project ĐÍCH

> ⚠️ Nếu máy đang link sang site khác, xem **Mục 4 + 5** để không deploy nhầm.

```bash
netlify unlink                       # gỡ link cũ (nếu có)
netlify link --id <SITE_ID_DICH>     # link sang site đích
netlify status | grep "Site Id"      # BẮT BUỘC: xác nhận đúng SITE_ID_DICH
netlify deploy --prod --message "Initial deploy"
```

### Bước 3 — Đặt mật khẩu admin (`CMS_PASSWORD`) cho project ĐÍCH

```bash
netlify env:set CMS_PASSWORD "<mat-khau-cua-ban>"
netlify deploy --prod --message "Apply CMS_PASSWORD"   # redeploy để function nhận env
```

> **Vì sao phải redeploy:** function đọc `process.env.CMS_PASSWORD` lúc chạy; đổi env
> xong cần một bản deploy mới để chắc chắn function dùng giá trị mới. Nếu không,
> bước import có thể bị **401**.

### Bước 4 — Import dữ liệu + ảnh vào project ĐÍCH

```bash
BASE=https://<project-dich>.netlify.app \
CMS_PASSWORD="<mat-khau-cua-ban>" \
npm run seed:import
```

Script sẽ:
1. Upload từng file trong `seed/images/` lên Blobs của site đích (`POST /api/upload`) → nhận key mới.
2. Thay `seed:<file>` trong content bằng URL `/api/img/<key-moi>`.
3. Ghi toàn bộ content vào site đích (`POST /api/save`).

Log kết thúc phải là: `IMPORTED <n> items + <m> images -> <url>  ok=true`

### Bước 5 — Verify

```bash
# đếm mục + kiểm mọi ảnh serve được
python3 - <<'PY'
import json, urllib.request
BASE = "https://<project-dich>.netlify.app"
d = json.load(urllib.request.urlopen(f"{BASE}/api/data"))
imgs = [i["imageUrl"] for i in d["items"] if str(i.get("imageUrl","")).startswith("/api/img/")]
ok = sum(1 for u in imgs if urllib.request.urlopen(BASE+u, timeout=20).status == 200)
print(f"{len(d['items'])} mục | ảnh serve OK: {ok}/{len(imgs)}")
PY
```
Mở `https://<project-dich>.netlify.app` (app) và `/admin` (đăng nhập bằng `CMS_PASSWORD`)
để nhìn tận mắt.

---

## 4. ⚠️ CẠM BẪY QUAN TRỌNG (đọc trước khi thao tác nhiều site)

Đây là các lỗi **đã gặp thật** — làm sai có thể **đổi nhầm mật khẩu / deploy nhầm lên site prod**:

| # | Cạm bẫy | Sự thật | Cách tránh |
|---|---|---|---|
| 1 | `netlify link --id X` khi đã có link | **KHÔNG override** — nó chỉ báo "đã link" và **giữ link cũ** | Luôn `netlify unlink` **trước**, rồi mới `link --id X` |
| 2 | `netlify env:set` / `netlify deploy` | Luôn nhắm vào **site đang link**, không phải site trong `BASE` | **Xác nhận link** bằng `netlify status \| grep "Site Id"` trước mỗi lệnh ghi |
| 3 | Đổi `env` mà không redeploy | Function có thể vẫn dùng giá trị cũ | Redeploy sau khi `env:set` |
| 4 | `BASE=` trong lệnh import ≠ site đang link | `BASE` chỉ dùng cho **script node** (import/export). CLI (`deploy`,`env`) **KHÔNG** đọc `BASE` | Đừng nhầm 2 cơ chế: script dùng `BASE`, CLI dùng **link** |

**Quy tắc vàng:** trước mọi `env:set` hoặc `deploy`, chạy:
```bash
netlify status | grep "Site Id"     # rồi ĐỐI CHIẾU với site bạn định thao tác
```

---

## 5. Làm việc với nhiều site an toàn — mẫu "unlink → link → verify"

Copy nguyên khối này mỗi khi cần chuyển site, thay `TARGET_ID`:

```bash
TARGET_ID=<site-id-muc-tieu>
netlify unlink
netlify link --id "$TARGET_ID"
CUR=$(netlify status | grep -i "Site Id" | grep -oE "[0-9a-f-]{36}")
if [ "$CUR" = "$TARGET_ID" ]; then
  echo "✅ Đã link đúng $TARGET_ID — an toàn thao tác env/deploy"
else
  echo "❌ Link SAI ($CUR) — DỪNG LẠI, đừng chạy env:set/deploy"
fi
```

Xong việc, nhớ **link về lại site chính**:
```bash
netlify unlink && netlify link --id <SITE_ID_CHINH>
```

> Cách khác (không đổi link): `netlify deploy --prod --site <SITE_ID>` deploy thẳng vào
> 1 site cụ thể. Nhưng `env:set` thì không có cờ site ổn định → vẫn nên dùng mẫu link ở trên.

---

## 6. Troubleshooting

| # | Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|---|
| 1 | App có text nhưng **ảnh trống/404** | Chưa chạy `seed:import` (ảnh vẫn trỏ Blobs site cũ qua auto-seed) | Chạy Bước 4 |
| 2 | `seed:import` báo **FAIL ... 401** khi upload | `CMS_PASSWORD` truyền vào **khác** env trên site đích | Kiểm `env:set` đúng site chưa + đã redeploy chưa; truyền đúng `CMS_PASSWORD` |
| 3 | Login `/admin` site đích **sai mật khẩu** | Env `CMS_PASSWORD` site đích khác cái đang gõ | Set lại `env:set CMS_PASSWORD` (đúng site) + redeploy |
| 4 | `seed:import` báo **MISSING seed/images/...** | Thiếu file ảnh trong bundle | Chạy lại Bước 1 (export) từ nguồn còn ảnh |
| 5 | Export báo `GET /api/data -> 4xx/5xx` | Sai `BASE` hoặc site nguồn chưa deploy | Kiểm URL nguồn |
| 6 | Ảnh serve trả **415/400** | File không phải ảnh hợp lệ / >10MB | Kiểm file trong `seed/images/` |

---

## 7. Tham chiếu — scripts & lệnh

| Lệnh | File | Việc |
|---|---|---|
| `npm run seed:export` | `scripts/seed-export.mjs` | Chụp content + ảnh từ **`BASE`** (site nguồn) → `seed/` |
| `npm run seed:import` | `scripts/seed-import.mjs` | Nạp `seed/` vào **`BASE`** (site đích), cần `CMS_PASSWORD` |
| `npm run build:seed` | `scripts/build-seed.mjs` | (Lịch sử) tạo `content.seed.json` từ Google Sheet gốc — không cần cho luồng này |

**Biến môi trường script đọc:**

| Biến | Dùng cho | Bắt buộc |
|---|---|---|
| `BASE` | export + import | ✅ (URL site nguồn/đích) |
| `CMS_PASSWORD` | import | ✅ (mật khẩu admin site đích) |
| `PWFILE` | import (thay `CMS_PASSWORD`) | tuỳ chọn — đường dẫn file chứa mật khẩu |

**API mà script gọi (đều thuộc chính site Netlify, không có bên thứ ba):**
`GET /api/data` · `GET /api/img/:key` · `POST /api/upload` · `POST /api/save`
(2 cái sau cần header `x-cms-password`).

---

## 8. Ví dụ thực tế (đã kiểm chứng)

Import từ project nguồn `ttmi-cs-internal` sang site test mới `ttmi-cs-seedtest`:

```bash
# export từ nguồn
BASE=https://ttmi-cs-internal.netlify.app npm run seed:export
#  -> seed/: 136 mục + 15 ảnh

# chuẩn bị site đích
netlify unlink && netlify link --id 4112aa28-e183-4f3f-b156-b60711ba6b5d
netlify status | grep "Site Id"          # xác nhận đúng
netlify env:set CMS_PASSWORD "seedtest123"
netlify deploy --prod

# import
BASE=https://ttmi-cs-seedtest.netlify.app CMS_PASSWORD="seedtest123" npm run seed:import
#  -> IMPORTED 136 items + 15 images ... ok=true

# verify -> 136 mục | ảnh serve OK: 15/15
```
