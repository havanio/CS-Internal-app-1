# Tutimi Signature — CTKM tra cứu CSKH

Nguồn: thông báo tổng hợp và 7 hình được chia sẻ trong nhóm Zalo DÙNG XONG XOÁ ngày 11/11/2026. Phạm vi: 146 Bình Lợi, P. Bình Lợi Trung, TP.HCM. Hình được lưu nguyên bản, không cắt hoặc sửa nội dung.

| Chương trình | Lịch xác nhận được từ nguồn |
| --- | --- |
| Mua thức uống tặng món tráng miệng đúng cặp | Từ 07/11/2026, đến khi có thông báo kết thúc |
| Hóa đơn từ 89K tặng bánh ngọt | Từ 07/11/2026, đến khi có thông báo kết thúc |
| Hóa đơn từ 259K tặng bình giữ nhiệt | Từ 07/11/2026, đến khi có thông báo kết thúc |
| Giảm 50% qua app, tối đa 100K | Khi tải app, còn hiệu lực trong thời gian app vận hành (người dùng xác nhận) |
| Combo sáng 29K | 07–08/11: 08:00–09:00; 09/11: 06:00–09:00. Từ 09/11 áp dụng hằng ngày, chưa có ngày kết thúc (người dùng xác nhận) |
| Voucher giấy giảm 50%, tối đa 200K | 07–30/11/2026 |
| Voucher giấy combo Matcha 99K (2 ly + 1 bánh ngọt) | 07–30/11/2026 |
| Voucher giấy hóa đơn 89K tặng ly nhựa | 07–30/11/2026 |
| Hóa đơn từ 59K tặng Bánh Mì Que Pate Phô Mai Chà Bông | 11–30/11/2026, 22:00–05:00 hằng ngày |

Không suy ra các khung giờ chưa có trong nguồn là 24/7. Không nhầm ưu đãi app với voucher giấy hoặc hai chương trình cùng mốc hóa đơn 89K. Voucher giấy cần còn nguyên vẹn, mỗi voucher 1 lần, không cộng dồn CTKM khác, trong thời hạn quy định. Các quyền lợi cộng dồn chưa được nguồn xác nhận không tự bổ sung.

Giao diện sắp theo ngày bắt đầu tăng dần; cùng ngày theo giờ bắt đầu nếu có. Ngày chưa xác nhận để cuối danh sách. Có tìm kiếm, lọc trạng thái/danh mục, trạng thái khung giờ Việt Nam, thông tin sản phẩm và điều kiện chi tiết, sao chép thông tin và mở hình gốc. Trang quản trị bổ sung ngày giờ theo giai đoạn, địa điểm, ưu đãi, điều kiện, đánh dấu chờ xác nhận và thời hạn đến khi có thông báo.

Cập nhật bổ sung theo ID còn thiếu; không nhập seed hoặc ghi đè danh sách CMS. Bản triển khai thử xác minh 223 mục = 214 mục production giữ nguyên + 9 CTKM, giữ nguyên 23 mục lưu trữ và updatedAt. Bản sao đầy đủ chỉ nằm trong .local-preview, không commit lên GitHub.

Nhánh phát hành được tạo từ code production 1bcfb33. Các thay đổi UI/câu chat hậu mãi đang thử trong checkout local không được ghép vào đợt phát hành CTKM này.

## Xác nhận bổ sung của người dùng ngày 11/11/2026

- Ưu đãi giảm 50% qua app: áp dụng khi tải app, còn hiệu lực trong thời gian app vận hành. Không tự gán ngày bắt đầu lịch sử.
- Combo 29K: từ 09/11/2026 áp dụng 06:00–09:00 hằng ngày, chưa có ngày kết thúc. Giữ lịch 07–08/11 (08:00–09:00) làm lịch sử.
- Bỏ hai nhãn cần xác nhận; trang quản trị hỗ trợ giai đoạn không có ngày kết thúc và hiệu lực theo vận hành app.
