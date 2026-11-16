Để giúp AI Agent hiểu sâu sắc, tự động hóa và code chính xác toàn bộ dự án **HUCE Timetable Scheduler (Genetic Algorithm + ReactJS/TypeScript + Tailwind CSS)**, dưới đây là bản **Implementation Specification & Task Breakdown (PRD chi tiết cho AI)**.

Bạn có thể đưa thẳng tài liệu này cho AI Agent (hoặc dùng làm system prompt/context) để nó triển khai code từng bước một cách hoàn hảo.

---

# 📋 PROJECT SPECIFICATION: HUCE TIMETABLE SCHEDULER AGENT

## 1. Tổng quan dự án (Project Overview)

Ứng dụng Web đơn trang (SPA) chạy hoàn toàn phía Frontend bằng **ReactJS (TypeScript) + Tailwind CSS**, giúp sinh viên Đại học Xây dựng Hà Nội (HUCE):

1. Parse dữ liệu Excel/CSV thời khóa biểu toàn trường.
2. Tìm kiếm học phần, quản lý danh sách chọn và tùy chỉnh chọn lớp (section) cụ thể.
3. Thiết lập ràng buộc cá nhân (khung giờ nghỉ cố định trong tuần).
4. Sử dụng **Thuật toán Di truyền (Genetic Algorithm - GA)** để tự động tối ưu hóa và sinh ra các phương án thời khóa biểu hoàn hảo (không trùng lịch, thỏa mãn ràng buộc).
5. Hiển thị trực quan kết quả trên giao diện lưới thời khóa biểu (Interactive Canvas/Grid View).

---

## 2. Cấu trúc thư mục dự kiến (Folder Structure)

```text
src/
├── types/
│   └── timetable.ts          # Định nghĩa các TypeScript Interfaces
├── utils/
│   ├── excelParser.ts        # Xử lý đọc file Excel/CSV thuần không cần thư viện nặng
│   └── timetableGA.ts        # Thuật toán di truyền (Genetic Algorithm)
├── components/
│   ├── Navbar.tsx            # Header & thông tin ứng dụng
│   ├── FileUploader.tsx      # Component tải file kèm hiển thị tên file & popup thông báo
│   ├── CourseSelector.tsx    # Tìm kiếm học phần, danh sách đã chọn & Modal chọn lớp
│   ├── ConstraintsConfig.tsx # Cấu hình khung giờ nghỉ (Thứ x Sáng/Chiều/Tối)
│   ├── TimetableCanvas.tsx   # Lưới hiển thị kết quả thời khóa biểu (Visualizer)
│   └── Toast.tsx             # Popup thông báo (Toast/Modal)
├── App.tsx                   # Main container quản lý toàn bộ State
└── index.css                 # Tailwind directives

```

---

## 3. Data Models & TypeScript Interfaces (`src/types/timetable.ts`)

```typescript
export interface RawCourseRow {
  Ky: string;
  Truong_Vien_Khoa: string;
  Ma_lop: string;
  Ma_lop_kem: string;
  Ma_HP: string;
  Ten_HP: string;
  Tieu_HP_Tieng_Anh?: string;
  Khoi_luong: string;
  Ghi_chu: string; // Thường chứa "Lớp - Giảng viên"
  Buoi_so: number;
  Thu: string;       // "2", "3", "4", "5", "6", "7", "Chủ nhật"
  Thoi_gian: string; // VD: "1325-1610"
  BD: string;        // "1325"
  KT: string;        // "1610"
  Kip: string;       // "Sáng", "Chiều", "Tối"
  Tuan: string;      // "1", "5-10"
  Phong: string;
  Trang_thai?: string;
  Loại_lớp?: string;
}

export interface Section {
  id: string;          // Mã lớp (Mã_lop)
  maHP: string;        // Mã học phần
  tenHP: string;       // Tên học phần
  sessions: ClassSession[];
}

export interface ClassSession {
  thu: number;         // 2 đến 8 (Chủ nhật = 8 hoặc 1)
  tietStart: number;
  tietEnd: number;
  timeStartMinutes: number; // Quy đổi ra phút trong ngày để so sánh nhanh
  timeEndMinutes: number;
  tuanHoc: number[];   // Mảng các tuần học cụ thể, VD: [5, 6, 7, 8, 9, 10]
  phong: string;
  ghiChu: string;
}

export interface CourseGroup {
  maHP: string;
  tenHP: string;
  sections: Section[]; // Các lớp học phần mở cho môn này
}

export interface SelectedCourseConfig {
  maHP: string;
  selectedSectionIds: string[]; // Nếu rỗng hoặc chứa toàn bộ -> Chọn tất cả để GA tự xếp, nếu chọn cụ thể -> Giới hạn trong các lớp này
}

export type TimeConstraints = {
  [day: number]: { // 2, 3, 4, 5, 6, 7, 8
    sang: boolean;   // true = nghỉ buổi sáng
    chieu: boolean;  // true = nghỉ buổi chiều
  };
};

```

---

## 4. Chi tiết các module thuật toán cốt lõi

### A. Parser Tuan Học (`src/utils/excelParser.ts`)

Xử lý chuỗi tuần học từ Excel sang mảng số nguyên để check trùng:

* Nếu chuỗi là `"5-10"` $\rightarrow$ `[5, 6, 7, 8, 9, 10]`
* Nếu chuỗi là `"1,3,5"` $\rightarrow$ `[1, 3, 5]`
* Nếu chuỗi là `"1"` $\rightarrow$ `[1]`

### B. Thuật toán Di truyền (Genetic Algorithm) (`src/utils/timetableGA.ts`)

* **Nhiễm sắc thể (Chromosome):** Một mảng gồm $N$ phần tử tương ứng với $N$ môn học đã chọn. Mỗi phần tử là `sectionId` được chọn cho môn học đó.
* **Hàm Fitness (Đánh giá độ thích nghi):**
1. *Trừng phạt nặng (Penalty):* Nếu 2 lớp bất kỳ trong TKB bị trùng lịch (Trùng Thứ + Trùng Khung Giờ + Giao nhau về mảng Tuần học).
2. *Trừng phạt ràng buộc cá nhân:* Nếu lớp học rơi vào ngày/buổi mà user chọn "nghỉ".
3. *Điểm thưởng (Bonus):* Giảm thiểu khoảng trống tiết học (gaps) giữa các buổi trong ngày.


* **Tiến hóa (Evolution):**
* Khởi tạo quần thể ban đầu (Population initialization).
* Đánh giá Fitness từng cá thể.
* Chọn lọc tự nhiên (Tournament Selection).
* Lai ghép (Crossover) giữa 2 nhiễm sắc thể.
* Đột biến (Mutation): Ngẫu nhiên đổi lớp của 1 môn học trong TKB.
* Lặp lại qua $G$ thế hệ (VD: 50-100 thế hệ) để tìm ra cá thể có Fitness cao nhất (0 lỗi trùng lịch).



---

## 5. Danh sách Task chi tiết cho AI Agent (Task Breakdown)

AI Agent cần thực hiện lần lượt các task dưới đây:

### Task 1: Setup Core Types & File Upload UI

* [ ] Tạo file `src/types/timetable.ts` với đầy đủ interfaces mô tả ở mục 3.
* [ ] Xây dựng component `FileUploader.tsx`:
* Hỗ trợ input file `.xlsx`, `.xls`, `.csv`.
* Parse file bằng thư viện SheetJS (`xlsx`) hoặc parser thuần.
* **Yêu cầu UI:** Khi tải file thành công $\rightarrow$ Hiển thị tên file trực tiếp lên nút upload, đồng thời bật một popup Toast/Modal thông báo *"Đã tải lên thành công file [Tên_File]!"*.



### Task 2: Course Management & Modal Chọn Lớp

* [ ] Xây dựng `CourseSelector.tsx`:
* Ô input tìm kiếm học phần theo Mã HP hoặc Tên HP.
* Danh sách các môn đã được thêm vào giỏ hàng (Selected Courses).
* Nút bấm cấu hình: Click vào mỗi môn mở ra một **Modal/Drawer** hiển thị toàn bộ danh sách các lớp (sections) đang mở của môn đó.
* Cho phép người dùng: Bấm "Chọn tất cả" hoặc tích chọn thủ công từng lớp cụ thể.



### Task 3: Constraints Config (Ràng buộc cá nhân)

* [ ] Xây dựng `ConstraintsConfig.tsx`:
* Hiển thị bảng ma trận Từ Thứ 2 đến Chủ nhật $\times$ Buổi Sáng / Buổi Chiều.
* Cho phép sinh viên click checkbox để chọn các khung thời gian **muốn nghỉ cố định** (tool sẽ loại bỏ hoàn toàn các lớp học vào khung giờ này khi chạy thuật toán).



### Task 4: Genetic Algorithm Engine (`src/utils/timetableGA.ts`)

* [ ] Viết hàm kiểm tra trùng lịch dựa trên `ClassSession` và `tuanHoc`.
* [ ] Triển khai thuật toán GA:
* Hàm tạo quần thể ngẫu nhiên (`generatePopulation`).
* Hàm tính điểm fitness (`evaluateFitness`) bao gồm check trùng lịch và check ràng buộc nghỉ.
* Hàm lai ghép và đột biến (`crossover`, `mutate`).
* Vòng lặp chính chạy tối ưu và trả về top $K$ phương án thời khóa biểu tối ưu nhất.



### Task 5: Timetable Visualizer (Canvas/Grid UI)

* [ ] Xây dựng `TimetableCanvas.tsx`:
* Vẽ lưới thời khóa biểu truyền thống (Trục dọc là các tiết/giờ, trục ngang là Thứ 2 đến Chủ nhật).
* Render các ô học phần vào đúng tọa độ thời gian, phân màu sắc bắt mắt bằng Tailwind CSS.
* Thêm nút chuyển đổi qua lại giữa các phương án thời khóa biểu khác nhau (Phương án 1, Phương án 2,...) do GA tìm ra.
* Nút xuất file ảnh/PDF hoặc in lịch học nếu cần.



---

Hãy giao task này cho AI Agent của bạn để bắt đầu sinh mã nguồn hoàn chỉnh từng bước!