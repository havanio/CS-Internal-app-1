# Checkpoint hậu mãi - 10/11/2026

## Phạm vi đã lưu

- Mục hậu mãi với hai cột chính sách và mẫu chat.
- Chọn tình huống bằng dropdown; bấm vào câu chat hoặc nút Sao chép để copy đúng câu.
- Giữ padding/bố cục bộ lọc gốc khi chuyển loại nội dung.
- Quản trị thêm/sửa chính sách và nhiều mẫu chat; giữ trường dữ liệu không được editor biết đến khi sửa mục cũ.
- Đủ 18 tình huống và các xác nhận nghiệp vụ ngày 10/11/2026 trong `CHOT-NGHIEP-VU-2026-11-10.md`.
- Bản thử và nội dung vẫn mang trạng thái dự thảo, chưa có ngày ban hành. Nội dung xác nhận mới ưu tiên hơn các báo cáo kiểm tra trước đó.
- Bộ kiểm tra: 12 kiểm tra tự động đã đạt, gồm chính sách, ngày hiệu lực, dropdown, quyền lợi đã chốt và copy đúng nội dung.

## Trạng thái production

Checkpoint này chưa được triển khai lên production và chưa phải bản ghép hoàn tất với code production mới.

Nền của nhánh vẫn là commit `d497c4d` từ repo ban đầu. Code giao diện production mới hơn khớp repo `havanio/CS-Internal-app` tại commit `02132b6`, đã tải riêng để đối chiếu ở thư mục `CS-Internal-app-production-source` cạnh checkout này.

Bản local đang dùng 136 mục mẫu cũ cộng 18 chính sách. Không dùng danh sách này để ghi đè dữ liệu production.

Dữ liệu production được sao lưu lại ngày 10/11/2026: 196 mục, gồm 23 mục lưu trữ. Bản sao đầy đủ và manifest kiểm tra nằm trong `.local-preview/`, được bỏ qua khi commit. Repo GitHub đang công khai, vì vậy checkpoint chỉ lưu code, mẫu chính sách và tài liệu; không đưa toàn bộ dữ liệu nội bộ production lên repo.

## Phần còn lại trước triển khai

1. Ghép chức năng trên nền code production mới, giữ sắp xếp, lưu trữ và các điều khiển hiện hành.
2. Dùng bản sao dữ liệu production mới nhất để thử; dùng đúng trường `archivedAt`.
3. Kiểm chứng toàn bộ mục cũ giữ nguyên ID, nội dung, thứ tự và metadata; chỉ bổ sung đúng 18 mục chính sách.
4. Xác minh quyền triển khai đúng Netlify site hiện tại và phiên bản hàm máy chủ, làm bản xem trước trước khi đưa lên production.
5. Trước thao tác ghi dữ liệu, sao lưu và đọc lại bản mới nhất; không chạy import seed hoặc dùng danh sách local cũ thay toàn bộ dữ liệu.

Khởi động bản thử riêng: `npm run preview:local`. Tất cả thao tác lưu của server thử chỉ ghi `.local-preview/content.json` trên máy.
