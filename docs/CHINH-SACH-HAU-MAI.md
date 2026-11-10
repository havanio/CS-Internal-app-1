# Bản thử chính sách hậu mãi

## Chạy trên máy

`npm run preview:local`

- Tra cứu: http://127.0.0.1:8765/?brand=TUTIMI&type=policy&drafts=1
- Quản trị: http://127.0.0.1:8765/admin/ ; mật khẩu thử là `local`.
- Dữ liệu riêng nằm trong `.local-preview/content.json`, được bỏ qua khi commit.
- Lần chạy đầu nạp bộ dữ liệu mẫu trong repo và 18 tình huống dự thảo. Đây không phải bản sao dữ liệu mới nhất trên website đang chạy.
- Lưu tất cả chỉ ghi trên máy. Upload ảnh không bật trong bản thử. Không có yêu cầu tới API của website thật.
- Đặt lại dữ liệu thử: `npm run preview:local -- --reset` (dừng server trước).

## Thiết kế

Mỗi mục `type: policy` chứa một đối tượng `policy`:

- `resolution`, `refund`, `extra`, `verify`, `escalation`: nội dung nội bộ.
- `messages`: danh sách `{title, content}`, bấm trực tiếp vào câu chat hoặc nút copy chỉ lấy `content` của đúng mẫu. Có thể dùng Enter/Space khi câu chat được focus.
- `status`: `draft` hoặc `active`.
- `version`, `effectiveDate`: phiên bản và ngày hiệu lực.

Màn hình rộng dùng hai cột 45/55. Màn hình nhỏ xếp chính sách trước, mẫu chat sau. Chọn tình huống qua dropdown; lọc theo thương hiệu/danh mục. Bộ lọc và padding dùng chung bản gốc ở mọi loại nội dung, không đổi bố cục khi chuyển mục. Link cũ dùng q với tên tình huống được chuyển sang lựa chọn dropdown tương ứng. Bản dự thảo không hiển thị mặc định. Chính sách active có ngày hiệu lực trong tương lai chỉ thấy khi bật xem bản dự thảo, kèm nhãn Sắp áp dụng. Ngày áp dụng theo Asia/Ho_Chi_Minh.

Quản trị có trường riêng cho chính sách và từng mẫu chat, thêm/bỏ mẫu; yêu cầu phiên bản và ngày hiệu lực khi chọn áp dụng. Sửa mục đang có giữ các trường dữ liệu khác không được editor biết đến, tránh mất metadata của bản CMS mới hơn.

## Nội dung và phạm vi

18 tình huống lấy từ bảng “Đề xuất chính sách TuTiMi”, cùng quy tắc trong bản PDF dự thảo ngày 07/11/2026 và xác nhận giữ hoàn tiền, ưu tiên giao lại của người yêu cầu. Tất cả mẫu đi kèm đều là dự thảo để duyệt, không phải quyền lợi đã có hiệu lực. Điều kiện voucher, phạm vi tính hoàn và ngoại lệ vẫn cần chốt như PDF. Mẫu chat voucher chưa được đưa vào để tránh hứa quyền lợi chưa có cách sử dụng.

Không sửa seed hiện hành, API production, đăng nhập thật hay dữ liệu Netlify. File fixtures chỉ được server thử nạp. Trước triển khai thực tế phải xác định phiên bản live, sao lưu dữ liệu mới nhất và chỉ bổ sung các mục mới qua quy trình được duyệt; không import toàn bộ dữ liệu mẫu từ repo.

## Mẫu chat hiện hành

Đã đọc lại mẫu trên trang live ngày 09/11/2026: Ship/hoàn ly, Ship/hoàn topping, Hoàn tiền 1 phần, Ship lại, Hoàn tiền và Báo khách liên hệ thêm nếu phát sinh sự cố. Giữ cách xưng em/mình, xin thông tin theo từng dòng, lời nhờ xác nhận nhẹ nhàng. Mẫu hoàn tiền giữ nguyên câu xin số momo hoặc STK; chỉ lấy thông tin sau khi đã thống nhất khoản hoàn. Mức hoàn theo từng chính sách, không mang mức 30% của mẫu chung sang mọi tình huống.
