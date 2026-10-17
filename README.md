# ことば日和 — JLPT Learning

Website luyện thi JLPT bằng HTML/CSS/JavaScript thuần, Supabase Auth và PostgreSQL.

## Tính năng trong bản đầu
- Đăng ký, đăng nhập, đăng xuất bằng Supabase Auth.
- Kho đề mẫu N1–N5 (mỗi cấp độ có 3 câu hỏi mẫu tự biên soạn).
- Chọn đáp án, điều hướng câu, nộp bài.
- Chấm điểm phía PostgreSQL bằng RPC `grade_jlpt_exam`; đáp án chuẩn không được gửi xuống frontend.
- Hiện đáp án, câu đúng/sai và giải thích.
- Lưu/xóa từ yêu thích theo tài khoản.
- Lịch sử kết quả theo tài khoản.
- Double-click từ tiếng Nhật để tra trong từ điển mẫu ở `js/app.js`.

## 1. Cấu hình Supabase
1. Tạo project tại https://supabase.com.
2. Vào SQL Editor → New query.
3. Mở `supabase.sql`, copy toàn bộ, dán vào SQL Editor và bấm Run.
4. Vào Project Settings / API hoặc Connect, copy Project URL và publishable key (hoặc anon key legacy).
5. Mở `js/config.js`, thay:
   - `https://YOUR_PROJECT_ID.supabase.co`
   - `YOUR_SUPABASE_PUBLISHABLE_KEY`
6. Không bao giờ dùng `service_role` hoặc secret key trong file frontend.

## 2. Thiết lập email xác nhận
Mặc định Supabase có thể yêu cầu xác nhận email khi đăng ký.
- Trong Supabase Dashboard → Authentication → URL Configuration, thêm `http://localhost:5500` vào Site URL / Redirect URLs.
- Nếu muốn thử nhanh trên môi trường cá nhân, có thể cấu hình xác nhận email theo chính sách của bạn trong Authentication → Providers → Email. Khi tắt xác nhận, tài khoản có thể đăng nhập ngay; cân nhắc bật lại trước khi đưa website công khai.

## 3. Chạy trên Windows
Cách đơn giản:
1. Cài Node.js LTS.
2. Mở terminal trong VS Code tại thư mục project.
3. Chạy:
   ```powershell
   npx serve . -l 5500
   ```
4. Mở `http://localhost:5500`.

Hoặc cài extension Live Server trong VS Code, nhấp phải `index.html` → Open with Live Server. Nếu dùng Live Server, thêm URL nó cung cấp vào Supabase Auth → URL Configuration.

## 4. Kiểm tra
- Đăng ký tài khoản email của bạn.
- Xác nhận email nếu Supabase yêu cầu.
- Đăng nhập.
- Mở một cấp độ N1–N5, chọn đáp án, nộp bài.
- Kiểm tra kết quả và lịch sử.
- Double-click từ có trong từ điển mẫu (ví dụ 経験, 環境, 改善, 影響, 必要) để mở popup.
- Thêm từ vào yêu thích, vào tab yêu thích để xác nhận đã lưu.
- Đăng xuất và đăng nhập bằng user khác để kiểm tra dữ liệu yêu thích/lịch sử không bị chia sẻ.

## Lưu ý bảo mật và phạm vi
- Đáp án đúng nằm trong `jlpt_answer_keys`, bảng này không cấp quyền đọc cho browser. RPC chấm bài kiểm tra user đăng nhập và trả về kết quả.
- RLS giới hạn lịch sử và từ yêu thích theo `auth.uid()`.
- Bản này là starter project; trước khi đưa lên production cần bổ sung rate limiting/abuse protection, kiểm thử RLS, quản lý nội dung, backup, và đánh giá bảo mật.
- Từ điển popup hiện là từ điển mẫu cục bộ, không tự tra mọi từ tiếng Nhật. Bạn có thể bổ sung từ trong `localDictionary` hoặc tích hợp một nguồn từ điển được cấp phép.
- Các câu hỏi là câu mẫu tự soạn, không phải đề JLPT chính thức.
