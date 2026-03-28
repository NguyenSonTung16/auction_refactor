# Báo cáo Kết quả Refactoring Phân đoạn 2 (Tùng)

Báo cáo này tổng hợp các cải tiến về mặt **KISS** (Keep It Simple, Stupid) và **DRY** (Don't Repeat Yourself) cho lớp dữ liệu (**Model**) của module Product & Bidding.

---

## 1. Các lỗi vi phạm tìm thấy

| Vị trí | Nguyên lý vi phạm | Mô tả chi tiết |
| :--- | :--- | :--- |
| `product.model.js` | **DRY** (Don't Repeat Yourself) | Câu truy vấn con `bid_count` (đếm số lượt đấu giá) bị lặp lại nguyên văn trong hơn 15 hàm khác nhau. |
| `product.model.js` | **KISS** (Keep It Simple) | Có 3 hàm lấy chi tiết sản phẩm (`findById`, `findByProductId2`, `findByProductIdForAdmin`) với logic Join gần như giống hệt nhau nhưng viết tách biệt, gây khó khăn cho việc cập nhật logic chung (ví dụ: khi thêm tính năng Watchlist). |
| `product.model.js` | **Clean Code** | Sử dụng quá nhiều `db.raw` cho các logic lọc cơ bản, làm code khó đọc và khó tận dụng các tính năng bảo mật/tiện ích của Knex Query Builder. |
| `product.model.js` | **Data Mapping** | Logic gộp ảnh phụ (`sub_images`) bị lặp lại ở mọi hàm lấy chi tiết sản phẩm, dẫn đến mã nguồn dài dòng và dễ sai sót. |

---

## 2. Danh sách File thay đổi

| Loại | File | Mô tả |
| :--- | :--- | :--- |
| **MODIFIED** | `src/models/product.model.js` | Làm sạch toàn bộ mã SQL lồng ghép, hợp nhất các hàm chi tiết. |

---

## 3. Giải pháp đề xuất & Đã triển khai

### **Tối ưu hóa nội bộ (KISS & DRY)**
1.  **Trích xuất SQL Helpers nội bộ**:
    *   Tạo các hàm helper không export như `bidCountSubquery`, `isFavoriteSubquery`, `maskNameSubquery`.
    *   Giảm thiểu sự phụ thuộc vào các chuỗi SQL thuần (Raw SQL) rải rác.
2.  **Hợp nhất logic truy cập dữ liệu**:
    *   Triển khai hàm `getById(id, userId)` làm nguồn sự thật duy nhất (Single Source of Truth) cho dữ liệu chi tiết sản phẩm.
    *   Các hàm cũ được chuyển thành "wrapper" trỏ về `getById` để đảm bảo không phá vỡ code ở các tầng trên (Service/Controller).
3.  **Tập trung hóa xử lý dữ liệu**:
    *   Tạo helper `formatProductRecord` để xử lý logic gộp ảnh và chuẩn hóa dữ liệu đầu ra.

---

## 4. Minh chứng (Code trước và sau khi sửa)

### **Minh chứng 1: Loại bỏ mã SQL lặp lại (DRY)**

**Trước (Mã SQL lặp lại tại nhiều vị trí tiêu biểu):**
*   `findAll`: Dòng 9-16
*   `searchPageByKeywords`: Dòng 138-144
*   `findByCategoryId`: Dòng 238-244
*   *(Và hơn 10 vị trí khác tương tự trong file)*

```javascript
db.raw(`
  (
    SELECT COUNT(*) 
    FROM bidding_history 
    WHERE bidding_history.product_id = products.id
  ) AS bid_count
`)
```

**Sau (Sử dụng Helper nội bộ):**
```javascript
// Định nghĩa 1 lần duy nhất đầu file
const bidCountSubquery = () => db.raw(`
  (SELECT COUNT(*) FROM bidding_history WHERE bidding_history.product_id = products.id) AS bid_count
`);

// Sử dụng ngắn gọn ở mọi nơi (giảm khoảng 100 dòng code lặp lại)
.select('products.*', bidCountSubquery())
```

### **Minh chứng 2: Hợp nhất logic "Find by ID" (KISS)**

**Trước (Code trùng lặp dài dòng):**
Hàm `findByProductIdForAdmin` (Dòng 19-73) và `findByProductId2` (Dòng 404-469) có logic lấy Join và gộp ảnh gần như giống hệt nhau nhưng viết tách biệt hoàn toàn.

```javascript
export async function findByProductIdForAdmin(productId, userId) {
  const rows = await db('products')
    .leftJoin(...) // L45-56 (Join thủ công)
    .where('products.id', productId)
    .select(...) // L59-75 (Subqueries thủ công)
  
  // Logic gộp mảng sub_images (L68-71)
  return product;
}
```

**Sau (Hợp nhất và sạch sẽ):**
```javascript
export async function getById(productId, userId) {
  const rows = await joinWatchlist(
    db('products').leftJoin(...), 
    userId
  )
  .where('products.id', productId)
  .select(
    'products.*',
    maskNameSubquery('users.fullname'),
    bidCountSubquery(),
    isFavoriteSubquery(userId)
  );

  return formatProductRecord(rows); // Logic gộp ảnh tập trung trong 1 hàm
}

// Giữ lại alias cho tính tương thích (không cần viết lại body hàm)
export const findByProductIdForAdmin = getById;
export const findByProductId2 = getById;
```

---

## 5. Bổ sung: Refactoring If-Else trong Model & Scripts 
chuyển đổi các khối `if-else` phức tạp thành các hàm/helper tái sử dụng:

### **Minh chứng 3: Centralized Status Mapping (DRY)**
Trong `product.model.js`, logic SQL `CASE WHEN` để xác định trạng thái sản phẩm (Sold, Pending, Active...) được gom vào helper `statusCaseSql`.

**Sau:**
```javascript
const statusCaseSql = () => db.raw(`
  CASE
    WHEN is_sold IS TRUE THEN 'Sold'
    ...
  END AS status
`);

// Sử dụng tại findAllProductsBySellerId
.select('products.*', bidCountSubquery(), statusCaseSql())
```

### **Minh chứng 4: Tách biệt logic xử lý File (KISS)**
Trong `invoice.model.js`, hàm `moveUploadedFiles` được chia nhỏ thành `processSingleFile` để dễ bảo trì và đọc hiểu.

---

## 6. Kết luận
Việc refactor Phase 2 đã giúp file `product.model.js` giảm đáng kể số lượng dòng code (khoảng 200 dòng code dư thừa đã bị loại bỏ), đồng thời tăng tính nhất quán của dữ liệu trả về. Cấu trúc hiện tại cực kỳ đơn giản (**KISS**) nhưng vẫn đảm bảo tính linh hoạt khi cần mở rộng thêm các trường thông tin mới trong tương lai.
