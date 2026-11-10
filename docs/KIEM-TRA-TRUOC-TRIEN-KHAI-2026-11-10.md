# Kiểm tra nội dung và khả năng ghép production - 10/11/2026

## Kết luận

Chưa đủ điều kiện đưa nguyên bản local lên production. Đã có đủ 18 tình huống, đã sửa văn phong theo mẫu đang dùng; nhưng bản local bám PDF dự thảo và có các điều chỉnh nghiệp vụ khác Google Sheets. Code production mới và dữ liệu production đã được tải riêng để đối chiếu, chưa được ghép vào bản thử.

## Nguồn đối chiếu

- Google Sheets “Đề xuất chính sách TuTiMi”, tab Trang tính1, A1:D30, đọc lại ngày 10/11/2026.
- PDF “Tutimi_Du-thao-chinh-sach-hau-mai_2026-11-07.pdf”, 6 trang. PDF ghi rõ là dự thảo, có bổ sung đề xuất và điểm cần chốt; không tự coi các điều chỉnh trong PDF là thay thế chính sách Sheets đã được duyệt.
- Dữ liệu thực từ `/api/data` của production ngày 10/11/2026: 196 mục, 173 đang hiển thị, 23 lưu trữ; updatedAt 2026-11-07T03:06:35.047Z.
- Code tham chiếu `havanio/CS-Internal-app`, commit `02132b6`: bốn file JS/CSS chính của trang đọc và admin khớp hoàn toàn với file đang phục vụ trên production tại thời điểm kiểm tra. Chưa có xác nhận commit triển khai của các hàm máy chủ.

## 1. Nội dung và nhóm mục

Đủ 18 tình huống tương ứng bảng nguồn. Bản thử gom Thanh toán và Khuyến mãi thành một nhóm; chuyển Nước bị đổ từ Giao hàng sang Chất lượng. Đây là thay đổi tổ chức tra cứu, chưa phải giữ nguyên toàn bộ nhóm trong bảng gốc.

| Nội dung | Google Sheets | Bản local / PDF dự thảo | Đánh giá |
| --- | --- | --- | --- |
| Sai món, sai/thiếu topping, sai đá, hết món | Tặng topping kèm phương án xử lý | Đưa quà thành đề xuất; mẫu chat riêng chỉ dùng sau khi được duyệt | Đủ quyền lợi trong nội dung tham khảo nhưng thêm điều kiện duyệt, chưa khớp nguyên bản |
| Sai đá nhưng khách vẫn dùng được | Hoàn 50% giá trị đơn | Đề xuất 50% món, cả đơn khi ảnh hưởng cả đơn | Thay đổi cơ sở tính hoàn, cần chốt |
| Mùi/vị lạ; vật thể lạ | Hoàn 100%; có hỗ trợ món khác nếu khách muốn, chưa nói rõ có cộng dồn hay không | Chọn hoàn hoặc đổi; vừa hoàn vừa đổi phải duyệt ngoại lệ | Bổ sung diễn giải quyền lợi chưa được xác nhận |
| Lỗi lặp lại; thiếu vật dụng; trễ hẹn | Có voucher 50% hoặc 30% theo từng trường hợp | Voucher được ghi là đề xuất, chưa có mẫu hứa phát hành khi chưa chốt cơ chế | Có nội dung nhưng chưa vận hành như quyền lợi đã áp dụng |
| Sai công thức/định lượng | Làm lại hoặc voucher 50% | Làm lại/hoàn; voucher là phần thêm | Thay đổi quan hệ giữa các phương án, cần chốt |
| Sai size, sai ghi chú, giao sai, hết món, thiếu ưu đãi | Phương án trong bảng nguồn | Bổ sung giao lại, hoàn theo chính sách cũ hoặc hủy/hoàn/chênh lệch để giữ lựa chọn cho khách | Một phần theo xác nhận giữ hoàn và ưu tiên giao lại; các diễn giải mới vẫn cần phân biệt với nguồn gốc |

Mẫu xin số momo/STK giữ nguyên câu đang dùng. Thông tin giao lại lấy theo mẫu hiện hành và bổ sung thời gian tiện nhận. Tách báo đang kiểm tra với kết quả, tránh khẳng định lỗi hay hứa chắc không tái diễn. Các mức và điều kiện trong bản thử cần được chốt theo một nguồn nghiệp vụ duy nhất trước khi chuyển sang áp dụng.

## 2. Trạng thái code và dữ liệu

| Thành phần | Đã tải về | Đã dùng trong bản local đang chạy |
| --- | --- | --- |
| Code mới hơn khớp phần giao diện production | Có, ở thư mục `CS-Internal-app-production-source` | Chưa |
| Bản sao 196 mục production, gồm cả lưu trữ | Có, trong thư mục bỏ qua commit `.local-preview` | Chưa |
| 18 chính sách và chức năng hậu mãi mới | Có | Có |

Local hiện có 154 mục: 136 mục từ dữ liệu mẫu cũ và 18 chính sách dự thảo. So theo ID, local thiếu 66 ID hiện có trên production; đồng thời có 6 ID cũ không còn ở production nên không thể chỉ lấy chênh lệch tổng số 60 làm số mục thiếu. Khác biệt ở những ID trùng có cả nội dung, đường dẫn ảnh và metadata, không diễn giải toàn bộ là thay đổi lời chat.

### Rủi ro cụ thể chưa xử lý

- Bản thử chưa kế thừa đầy đủ chức năng admin mới: sắp xếp, lưu trữ và các điều khiển mới của production.
- Local đang kiểm tra trường `archived`, trong khi production dùng `archivedAt`. Chép thẳng 196 mục vào local cũ có thể làm hiện lại mục đã lưu trữ.
- Hàm lưu trong repo nhận cả danh sách rồi thay toàn bộ nội dung. Nếu nạp/lưu danh sách cũ lên production thì có thể ghi đè dữ liệu mới.
- Giữ trường lạ khi sửa một mục chỉ bảo vệ metadata của mục đã nạp; không bảo vệ các mục bị thiếu khỏi danh sách lưu toàn bộ.

### Điều kiện cần trước triển khai

1. Dùng code mới khớp production làm nền và ghép riêng chức năng hậu mãi, giữ các tính năng hiện hành.
2. Dùng bản sao dữ liệu mới nhất để thử; giữ nguyên ID, thứ tự, archive và metadata. Ảnh production phải được xử lý đúng trong môi trường local.
3. Chốt nguồn nghiệp vụ và các khác biệt nêu trên; bổ sung đúng 18 mục mới, không import toàn bộ bộ dữ liệu mẫu.
4. Kiểm tra đối chiếu trước/sau: toàn bộ 196 mục cũ giữ nguyên, 23 mục lưu trữ vẫn lưu trữ, chỉ thêm chính sách mới theo phạm vi được duyệt.
5. Sao lưu và đọc lại production ngay trước thao tác ghi; xác minh phiên bản máy chủ và tránh ghi đè thay đổi phát sinh sau bản sao hiện tại.

Lần rà này chỉ đọc nguồn và lưu báo cáo kiểm tra trên máy. Chưa sửa production, chưa ghép code mới và chưa thay bản dữ liệu local đang dùng.
