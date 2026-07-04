# TTMI · SK — CS Internal App

Static customer-service reference app **+ a mini admin CMS**, running entirely on
Netlify (Functions + Blobs). No Google Sheet, no external data at runtime.

- **App (đọc):** `/` — kịch bản chat, CTKM, cửa hàng, menu.
- **Admin CMS (sửa):** `/admin` — thêm/sửa/xoá nội dung + upload ảnh. Bảo vệ bằng 1 mật khẩu chung.
- **Dữ liệu + ảnh:** Netlify Blobs (kho riêng của mỗi site).

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `public/` | Frontend tĩnh (app + `admin/`) — thư mục publish |
| `netlify/functions/*.mjs` | API: `data`, `img`, `save`, `upload`, `login` |
| `netlify/functions/content.seed.json` | Seed nội dung tự nạp khi Blobs rỗng |
| `seed/` | **Bộ dữ liệu portable** (content + ảnh) để tái tạo ở site khác |
| `scripts/` | Công cụ seed/migrate |

## Chạy local

```bash
npm install
cp .env.example .env        # rồi điền CMS_PASSWORD
npm run dev                 # netlify dev (chạy Functions + Blobs local)
```

## Deploy lên một Netlify project MỚI (bàn giao)

> ### ⚠️ Deploy code XONG là CHƯA đủ — BẮT BUỘC 2 bước sau
> Deploy chỉ đưa **code** lên. Dữ liệu (ảnh) nằm ở Blobs của từng site nên phải nạp riêng:
>
> | # | Bước bắt buộc | Lệnh | Bỏ qua thì sao |
> |---|---|---|---|
> | 1 | **Set env `CMS_PASSWORD`** rồi **deploy lại** | `netlify env:set CMS_PASSWORD "<pw>"` + `netlify deploy --prod` | Không login được `/admin`, import bị **401** |
> | 2 | **Import dữ liệu đầu kỳ** | `BASE=<url> CMS_PASSWORD="<pw>" npm run seed:import` | Site **trống ảnh** (chỉ text, ảnh **404**) |
>
> 📖 Chi tiết từng bước + xử lý lỗi: **[docs/HUONG-DAN-IMPORT-DU-LIEU-DAU-KY.md](docs/HUONG-DAN-IMPORT-DU-LIEU-DAU-KY.md)**

Toàn bộ dữ liệu (text + ảnh) đi theo repo trong thư mục **`seed/`**, nạp bằng 1 lệnh:

```bash
# 1) Cài + link/tạo site Netlify của bạn
npm install
netlify login
netlify deploy --prod                    # tạo/deploy site của bạn

# 2) Đặt mật khẩu admin cho site
netlify env:set CMS_PASSWORD "<mật-khẩu-của-bạn>"
netlify deploy --prod                    # deploy lại để function nhận env

# 3) Nạp dữ liệu + ảnh vào Blobs của site
BASE=https://<site-của-bạn>.netlify.app \
CMS_PASSWORD="<mật-khẩu-của-bạn>" \
npm run seed:import
```

Xong — site mới có **đủ 135 mục + toàn bộ ảnh**, y hệt bản gốc.

## Seed bundle

| Lệnh | Việc |
|---|---|
| `npm run seed:import` | Nạp `seed/` vào Blobs của site đích (dùng khi bàn giao) |
| `BASE=<site-nguồn> npm run seed:export` | Chụp lại snapshot hiện tại của site nguồn vào `seed/` (content + ảnh) rồi commit |

> `seed/content.json` lưu ảnh dưới dạng tham chiếu `seed:<tên-file>`; `seed:import`
> upload file trong `seed/images/` lên Blobs rồi tự thay bằng URL `/api/img/<key>` mới.

## Env

| Biến | Ở đâu |
|---|---|
| `CMS_PASSWORD` | Local: file `.env` (gitignored). Prod: Netlify → *Site configuration → Environment variables* |
