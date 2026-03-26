# Báo cáo Kết quả Refactoring Phân đoạn 1 (Tùng)

Báo cáo này tổng hợp các lỗi vi phạm, giải pháp đã triển khai và minh chứng code cho quá trình refactor module **Product & Bidding** (Phần việc của Tùng).

---

## 1. Các lỗi vi phạm tìm thấy

| Vị trí | Nguyên lý vi phạm | Mô tả chi tiết |
| :--- | :--- | :--- |
| `product.route.js` | **SRP** (Single Responsibility) | Route handler `/bid` dài hơn 450 dòng, chứa cả logic validation, DB transaction, auto-bidding và gửi email. |
| `product.route.js` | **OCP** (Open-Closed) | Các loại hình đấu giá (Normal, Auto, Buy Now) được xử lý bằng các khối `if-else` lồng nhau. Muốn thêm loại mới buộc phải sửa code lõi. |
| `product.route.js` | **Fat Route** | File route tổng cộng hơn 1800 dòng, gây quá tải cho việc bảo trì và đọc hiểu cấu trúc routing. |
| Toàn bộ Route | **DRY** (Don't Repeat Yourself) | Logic kiểm tra trạng thái sản phẩm, định dạng kết quả đấu giá bị lặp lại ở nhiều endpoint khác nhau. |

---

## 2. Danh sách File thay đổi/thêm mới

| Loại | File | Mô tả |
| :--- | :--- | :--- |
| **MODIFIED** | `src/routes/product.route.js` | Loại bỏ logic nghiệp vụ, chuyển sang gọi Controller. |
| **NEW** | `src/controllers/product.controller.js` | Điều hướng Request/Response cho các tính năng liên quan đến sản phẩm. |
| **NEW** | `src/services/product.service.js` | Chứa logic chung về sản phẩm (kiểm tra trạng thái, định dạng kết quả). |
| **NEW** | `src/services/bidding.service.js` | Điều phối quy trình đấu giá (Transaction, email, thông tin đấu giá). |
| **NEW** | `src/strategies/bidding/` | Thư mục chứa các Strategy đấu giá (`Normal`, `Auto`, `BuyNow`) và `Factory`. |

---

## 3. Giải pháp đề xuất & Đã triển khai

### **Kiến trúc mới: Controller-Service-Strategy**
1.  **Chuyển đổi sang Controller-Service (SRP)**:
    *   Tạo `product.controller.js`: Chỉ làm nhiệm vụ điều hướng Request/Response.
    *   Tạo `product.service.js` & `bidding.service.js`: Chứa toàn bộ logic nghiệp vụ (Domain Logic).
2.  **Áp dụng Strategy Pattern (OCP)**:
    *   Tạo `BiddingStrategyFactory` để quyết định thuật toán đấu giá dựa trên dữ liệu đầu vào.
    *   Chia nhỏ logic thành 3 lớp chiến lược: `NormalBidStrategy`, `AutoBidStrategy`, `BuyNowBidStrategy`.
3.  **Làm sạch Route**:
    *   Rút gọn `product.route.js` về đúng vai trò định nghĩa endpoint (chưa tới 60 dòng code).

---

## 4. Minh chứng (Code trước và sau khi sửa)

### **Minh chứng 1: Rút gọn Route Handler (SRP)**

**Trước (Original - Fat Route):**
```javascript
// src/routes/product.route.js (Dòng 336-788)
router.post('/bid', isAuthenticated, async (req, res) => {
  const result = await db.transaction(async (trx) => {
    // ... 400 dòng logic DB phức tạp, validation, auto-bid lồng nhau ...
  });
  // ... Gửi email với HTML mẫu cứng ...
  res.redirect(...)
});
```

**Sau (Refactored - Clean Route):**
```javascript
// src/routes/product.route.js
router.post('/bid', isAuthenticated, productController.postBid);

// src/controllers/product.controller.js
export const postBid = async (req, res) => {
  const { productId, bidAmount } = req.body;
  try {
    const result = await biddingService.placeBid(productId, req.userId, bidAmount);
    req.session.success_message = result.message;
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    // Xử lý lỗi tập trung
  }
};
```

### **Minh chứng 2: Áp dụng Strategy Pattern (OCP)**

**Trước (Original - If-Else Hell):**
```javascript
if (!product.highest_bidder_id) {
  // Logic bid đầu tiên
} else {
  if (bidAmount <= currentHighestMaxPrice) {
    // Logic người cũ thắng
  } else {
    // Logic người mới thắng
  }
}
```

**Sau (Refactored - OCP compliant):**
```javascript
// src/services/bidding.service.js
const strategy = BiddingStrategyFactory.get(product, userId, bidAmount);
const strategyResult = await strategy.calculate(product, userId, bidAmount, trx);

// Mỗi strategy (Normal, Auto, BuyNow) nằm trong 1 file riêng, dễ dàng mở rộng.
```

---

