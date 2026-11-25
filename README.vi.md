# CV Studio

CV Studio là ứng dụng web tạo và chỉnh sửa CV bằng tiếng Việt hoặc tiếng Anh. Bạn có thể xem trước bố cục và xuất PDF khổ A4.

[Dùng CV Studio](https://cv-studio-phi.vercel.app/)

## Tính năng

- Tạo CV từ mẫu theo ngành hoặc nhập từ PDF.
- Đổi bố cục, xem trước theo trang và xuất PDF A4.
- Lưu, so sánh phiên bản, sao lưu và khôi phục dữ liệu.
- Đối chiếu từ khóa với mô tả công việc và chia sẻ bản sao CV qua liên kết.

## Chạy trên máy

Cài Node.js 24 trở lên và npm. Chạy các lệnh sau từ thư mục dự án.

```sh
npm ci
npm test
npm run build
```

Bản dựng nằm trong thư mục `dist/`. Phục vụ thư mục đó bằng máy chủ HTTP tĩnh. Ví dụ, nếu có Python 3, chạy `python -m http.server 8000 --bind 127.0.0.1 --directory dist` rồi mở [localhost:8000](http://127.0.0.1:8000).

## Dữ liệu CV

Bản nháp và lịch sử phiên bản được lưu trong trình duyệt. Dùng nút **Sao lưu** nếu muốn giữ bản sao hoặc chuyển sang trình duyệt khác. Liên kết mới chỉ chứa nội dung CV chỉnh sửa đang hiển thị và bố cục, không chứa mục ẩn, mục trống, PDF gốc hay lịch sử phiên bản. Hãy xem trước phạm vi dữ liệu trước khi tạo liên kết. Bất kỳ ai có liên kết đều có thể đọc nội dung; dữ liệu không được mã hóa bảo mật. Liên kết cũ vẫn mở được nhưng có thể chứa mục ẩn theo định dạng cũ. Tệp sao lưu vẫn giữ đầy đủ bản nháp và các phiên bản đã lưu.

## Đóng góp

Bạn có thể mở issue để báo lỗi hoặc gửi pull request. Khi báo lỗi liên quan đến nhập hoặc xuất CV, hãy dùng dữ liệu giả trong tệp đính kèm.

## Giấy phép

Mã nguồn của dự án được phát hành theo [giấy phép MIT](LICENSE).
