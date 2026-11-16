# HUCE TIMETABLE SCHEDULER — AGENT DESIGN SPECIFICATION (`DESIGN.md`)

**Project:** HUCE Timetable Scheduler — Công cụ hỗ trợ sinh viên Đại học Xây dựng Hà Nội (HUCE) xếp thời khóa biểu tự động bằng Thuật toán Di truyền (GA)
**Target Platform:** Web SPA (chạy 100% phía trình duyệt) — Desktop, Tablet, Mobile (responsive)
**Aesthetic Persona:** Tactile 3D thân thiện (viền đậm, đế nổi 3D, nút bấm cơ học, chuyển động nảy nhẹ) — nghiêm túc đủ cho công cụ học vụ nhưng vẫn vui mắt với sinh viên
**Core Tech Stack:** React 18 + TypeScript (strict), Vite, Tailwind CSS 3, SheetJS (`xlsx`)

---

## 1. DESIGN PHILOSOPHY & MOTION SYSTEM

### 1.1. Tactile 3D & Volumetric Depth (Vật lý Chạm nổi 3D)
* **Không sử dụng bóng mờ phẳng** (`shadow-md`, `drop-shadow` xám mềm) cho phần tử tương tác.
* **Quy chuẩn phần tử tương tác (Button, Card, Badge, Chip học phần, ô lớp học trên lưới):**
  * Bắt buộc có **viền đậm `2px solid`**, màu tối hơn màu nền.
  * Có **đế nổi 3D cạnh dưới** dạng bóng cứng `box-shadow: 0 Npx 0 <màu Dark>`:
    * Badge / Chip / Checkbox: `3px`
    * Button thường, ô ma trận ngày nghỉ: `4px`
    * Card / Panel lớn / CTA chính: `6px`
* **Trạng thái nhấn (`:active`):** phần tử lún xuống đúng bằng độ dày đế (`translateY(Npx)`) và bóng đế về `0` → cảm giác bấm phím cơ.
* **Trạng thái `disabled`:** nền `Grey 200`, viền `Grey 300`, chữ `Grey 500`, không có đế, `cursor-not-allowed`.
* **Ngoại lệ:** Các khối môn học vẽ trong lưới TKB (`TimetableCanvas`) dùng đế `2px` để không làm sai lệch tọa độ thời gian.

### 1.2. Platform Scope & Responsive
* **Desktop-first cho thao tác xếp lịch**, nhưng phải dùng tốt trên điện thoại:
  * `≥ 1024px (lg)`: bố cục 2 cột — Sidebar điều khiển `360px` bên trái + Lưới TKB bên phải.
  * `< 1024px`: xếp dọc theo thứ tự Bước 1 → 4 → Kết quả; lưới TKB cuộn ngang (`min-width: 760px`).
* Vùng chạm tối thiểu `44×44px` cho nút và checkbox (checkbox dạng ô vuông lớn, không dùng checkbox mặc định của trình duyệt trên mobile).
* Hỗ trợ **In / Xuất PDF**: khi `@media print` ẩn toàn bộ phần điều khiển (`.no-print`), bỏ đế 3D, lưới in nền trắng.

### 1.3. Motion & Easing
* Mọi chuyển động dùng easing nảy: `cubic-bezier(0.34, 1.56, 0.64, 1)`; thời lượng `150–250ms`. Không dùng `linear` (trừ thanh tiến trình GA).
* Áp dụng cho: mở/đóng Modal chọn lớp (scale `0.95 → 1`), Toast trượt từ trên xuống, chuyển Phương án (fade + slide `8px`), thêm/xóa chip học phần (pop scale).
* Thanh tiến trình GA: chạy mượt theo `%` thế hệ, có sọc chéo động (`striped`) khi đang tối ưu.
* Tôn trọng `prefers-reduced-motion`: tắt animation, chỉ giữ đổi màu.

---

## 2. COLOR DESIGN SYSTEM

### 2.1. Solid Palette (`Lighter` | `Light` | `Main` | `Dark` | `Darker`)
| Nhóm | Lighter | Light | Main | Dark | Darker |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary** | `#DCEBFA` | `#4D7BA8` | `#002A52` | `#001E3B` | `#001226` |
| **Secondary** | `#EFD6FF` | `#C584FF` | `#8637E8` | `#5219B7` | `#27097A` |
| **Info** | `#CAFEF5` | `#61F3F3` | `#00B8D9` | `#006C9C` | `#013769` |
| **Success** | `#D3FCD3` | `#77ED8B` | `#22C55D` | `#108D57` | `#055E49` |
| **Warning** | `#FFF5CC` | `#FED766` | `#FFAB00` | `#B76E00` | `#7A4100` |
| **Error** | `#FFE9D5` | `#FFAC82` | `#FF5631` | `#B71D19` | `#7B0916` |

### 2.2. Vai trò màu trong ứng dụng (Semantic Mapping)
| Vai trò | Màu |
| :--- | :--- |
| CTA chính "🧬 Xếp thời khóa biểu", phương án đang chọn | `Primary` |
| Header / Navbar, điểm nhấn thương hiệu | `Secondary.Main` → `Secondary.Dark` |
| Nút phụ (Chọn lớp, Lọc, Xem tuần), link | `Info` |
| Phương án hợp lệ (0 trùng lịch, 0 vi phạm), Toast thành công, file đã tải | `Success` |
| Giờ trống nhiều, phương án gần đạt | `Warning` |
| Trùng lịch, vi phạm ngày nghỉ, ô ngày nghỉ được tick, nút xóa, Toast lỗi | `Error` |

### 2.3. Transparent Variants
* **Primary transparent:** dùng màu gốc **`#A16232`** (`rgb(161, 98, 50)`), không dùng `Primary.Main`.
* **Secondary transparent:** dùng màu gốc **`#8E33FF`** (`rgb(142, 51, 255)`), không dùng `Secondary.Main`.
* **Grey / Black / White 12%:** fill alpha `12%` × layer opacity `80%` (alpha hiệu dụng `9.6%`) — dùng cho hover hàng trong danh sách lớp, nền overlay nhẹ.
* **Overlay Modal:** `Black 40%` (alpha thực tế `48%`).

### 2.4. Grey Scale
* `Grey 50`: `#FCFDFD` · `Grey 100`: `#F9FAFB` (nền trang) · `Grey 200`: `#F4F6F8`
* `Grey 300`: `#DFE3E7` (viền card) · `Grey 400`: `#C4CDD5` · `Grey 500`: `#909EAB` (placeholder)
* `Grey 600`: `#637281` (chữ phụ) · `Grey 700`: `#454F5B` · `Grey 800`: `#1C252E` (chữ chính) · `Grey 900`: `#141B22`

### 2.5. Bảng màu học phần trên lưới TKB
Mỗi học phần một màu, lặp vòng theo thứ tự (nền `Lighter`, viền & đế `Dark`, chữ `Darker`):
`Primary → Secondary → Info → Success → Warning → Error`, sau đó lặp lại với nền `Light`.
Ô bị trùng lịch: viền nét đứt `Error.Main` + icon ⚠️.

---

## 3. TYPOGRAPHY & SPACING
* Font: **`Be Vietnam Pro`** (hỗ trợ tiếng Việt đầy đủ), fallback `system-ui`.
* Thang chữ: Tiêu đề trang `20/700` · Tiêu đề Card `16/700` · Nội dung `14/500` · Phụ chú `12/500` · Ô lưới TKB `10–11/600`.
* Mã học phần / mã lớp / giờ dùng `font-variant-numeric: tabular-nums`.
* Bo góc: Card `20px` · Button/Input `16px` (`rounded-2xl`) · Badge/Chip `999px` · Ô lưới `10px`.
* Khoảng cách theo bội số `4px`; padding Card `16px` (mobile) / `20px` (desktop).

---

## 4. COMPONENT ARCHITECTURE & UI RULES

### 4.1. Tactile Buttons
* **Primary CTA** (`Xếp thời khóa biểu`): nền `Primary.Main`, viền `Primary.Darker`, đế `0 6px 0 Primary.Dark`, chữ trắng, full-width, cao `56px`. Khi GA chạy → hiển thị `Đang tối ưu… xx%` và thanh tiến trình bên trong nút.
* **Secondary / Info Button:** nền `Info.Lighter`, viền `Info.Dark`, đế `0 4px 0 Info.Dark`, chữ `Info.Darker`.
* **Danger Button** (xóa học phần): nền `Error.Lighter`, viền `Error.Dark`, chữ `Error.Darker`, đế `4px`.

### 4.2. Content Card (Panel từng bước)
* Nền `#FFFFFF`, viền `2px solid Grey 300`, đế `0 6px 0 Grey 300`.
* Tiêu đề có **badge số bước** tròn (1, 2, 3) nền `Secondary.Main`, viền `Secondary.Darker`.
* Thứ tự Sidebar: `① Tải dữ liệu` → `② Chọn học phần` → `③ Khung giờ nghỉ` → CTA.

### 4.3. FileUploader
* Vùng kéo-thả viền nét đứt `2px Grey 400`, icon 📁. Hover → viền `Info.Main`, nền `Info.Lighter`.
* Đã tải: đổi thành card `Success` hiển thị `📄 <Tên file>` + số học phần đọc được; nút "Đổi file".
* Link "Dùng dữ liệu mẫu" màu `Info.Dark`.

### 4.4. CourseSelector & Modal Chọn Lớp
* Ô tìm kiếm: input bo `16px`, viền `Grey 300`, focus viền `Primary.Main` + đế `0 4px 0 Primary.Light`. Dropdown kết quả dạng card nổi `6px`.
* Học phần đã chọn: **chip/card nhỏ** gồm tên HP, mã HP, badge `x/y lớp`, nút ⚙ (Info) và ✕ (Error).
* **Modal chọn lớp:** card nổi giữa màn hình (mobile: bottom-sheet full width), header tên HP + mã HP, ô lọc theo mã lớp/ghi chú khóa (vd `65`, `XD-HCM`), nhóm nút `Chọn tất cả` · `Chỉ chọn lớp đang lọc`. Mỗi lớp là một hàng có checkbox tactile, liệt kê các buổi: `T2 · 07:25–11:05 · Tuần 1-10 · 401.H2 · 65XD1`.

### 4.5. ConstraintsConfig (Ma trận ngày nghỉ)
* Lưới `7 cột (T2…CN) × 2 hàng (Sáng, Chiều)`, mỗi ô là **nút toggle tactile** `44×44px`:
  * Bình thường: nền trắng, viền `Grey 300`, đế `4px Grey 300`.
  * Đã chọn nghỉ: nền `Error.Lighter`, viền `Error.Dark`, icon 🌙/☕, lún xuống `2px`.
* Hàng chú thích: "Sáng < 12:00 · Chiều 12:00–18:00".

### 4.6. TimetableCanvas (Lưới kết quả)
* **Thanh Phương án:** các tab tactile `Phương án 1, 2, …`; tab đang chọn nền `Primary.Main`. Phương án lỗi gắn badge ⚠️ `Warning`.
* **Thanh trạng thái:** 3 badge — `Trùng lịch: n` (Success nếu 0, Error nếu > 0) · `Vi phạm ngày nghỉ: n` · `Giờ trống TB/tuần: x h` (Warning nếu > 3h).
* **Bộ chọn tuần:** `Tất cả các tuần` hoặc `Tuần k (dd/mm – dd/mm)`; tuần 1 bắt đầu **11/01/2027** (`WEEK_1_START`). Khi chọn tuần cụ thể, tiêu đề mỗi cột hiển thị ngày `dd/mm`, cột của **ngày hôm nay** viền `Primary.Main`.
* **Lưới:** trục dọc 06:00–21:00 (`48px/giờ`), vạch giờ `Grey 200`; vùng Sáng / Chiều / Tối phân biệt bằng nền rất nhạt. Khối môn học: bo `10px`, viền `2px`, đế `2px`, hiển thị Tên HP · giờ · phòng · mã lớp · tuần; hover nổi lên `-2px` + tooltip đầy đủ.
* **Chú thích (legend)** bên dưới: chip màu + Mã HP + Tên HP + lớp.
* Nút `🖨 In / Xuất PDF` dạng Secondary button góc phải.

### 4.7. Toast & Empty State
* **Toast:** card tactile góc trên phải (mobile: trên cùng full width), viền + đế theo `Success` / `Error`, tự đóng sau `4s`.
* **Empty state** của lưới: minh họa 🗓️ + hướng dẫn 3 bước, nền `Grey 100`, viền nét đứt `Grey 300`.

### 4.8. Accessibility
* Tỷ lệ tương phản chữ ≥ 4.5:1 (chữ trên nền `Main` dùng trắng; trên nền `Lighter` dùng `Darker`).
* Mọi nút icon có `aria-label`; Modal có `role="dialog"`, đóng bằng `Esc`, focus trap.
* Không truyền tải thông tin chỉ bằng màu: luôn kèm icon (✅ ⚠️ ✕) hoặc chữ.

---

## 5. CODE GENERATION GUIDELINES CHO AI AGENT
* **Design tokens tập trung:** khai báo palette trong `tailwind.config.js` (`theme.extend.colors.primary.lighter … darker`, `boxShadow.tactile-sm/md/lg`) và tiện ích `.btn-tactile`, `.card-tactile` trong `src/index.css` (`@layer components`). Không hard-code HEX trong component.
* **Tách biệt dữ liệu & logic:** dữ liệu mẫu, hằng số (`WEEK_1_START`, khung giờ Sáng/Chiều, bảng màu học phần) đặt trong `src/data/` hoặc `src/utils/`; thuật toán GA và parser không phụ thuộc UI.
* **Giữ nguyên cấu trúc thư mục** `src/types`, `src/utils`, `src/components` như trong `implementation+Task.md`.
* **Không cắt xén code:** không dùng bình luận kiểu `// ... giữ nguyên`; luôn cung cấp mã hoàn chỉnh, tuân thủ `TypeScript strict`.
* Ngôn ngữ giao diện: **tiếng Việt**, giọng thân thiện, ngắn gọn.
