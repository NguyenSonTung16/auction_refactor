# Báo cáo kết quả Tái cấu trúc Toàn diện (MVC Refactoring Report)

## 1. Các lỗi vi phạm tìm thấy
Trong giai đoạn đầu, mã nguồn trong dự án mắc phải những rủi ro thiết kế cốt yếu về cấu trúc ứng dụng:
- **Vi phạm nguyên tắc DRY (Don't Repeat Yourself)**:
  - Logic tạo/kiểm tra mã OTP, gửi email cấu trúc HTML, xử lý upload ảnh (đổi tên, di chuyển tệp với `fs.renameSync`) và cấu trúc xác thực OAuth của PassportJS đều bị sao chép ở rất nhiều nơi.
- **Vi phạm Trách nhiệm duy nhất (Single Responsibility Principle - SOLID)**:
  - Các tệp định tuyến (Routing) như `account.route.js` và `seller.route.js` có tới hàng trăm dòng lệnh. Chúng không chỉ lo việc định tuyến (mapping URLs) mà còn gánh luôn việc xử lý Request/Response (Controller) và tương tác thô bạo với Database hay file system (Service/Model).
  - Điều này phá vỡ cấu trúc thiết kế đa tầng MVC, khiến Route phình to, rối rắm và rất khó để kiểm thử (unit test).

## 2. Danh sách File thay đổi/thêm mới
- Dịch vụ Xác thực mới: `[NEW] src/services/auth.service.js`
- Tiện ích Xử lý Ảnh mới: `[NEW] src/utils/upload.js`
- Bộ điều khiển độc lập Tài khoản: `[NEW] src/controllers/account.controller.js`
- Bộ điều khiển độc lập Người Bán: `[NEW] src/controllers/seller.controller.js`
- Tệp định tuyến (chỉ chứa mapping): `[MODIFIED] src/routes/seller.route.js`
- Tệp định tuyến (chỉ chứa mapping): `[MODIFIED] src/routes/account.route.js`
- Tiện ích Gửi Thư: `[MODIFIED] src/utils/mailer.js`
- Thiết lập Passport: `[MODIFIED] src/utils/passport.js`

## 3. Giải pháp đề xuất & Đã triển khai
Tôi đã đập bỏ toàn bộ quy trình gộp chung và thiết lập một mảng cấu trúc phân lớp **Route -> Controller -> Service/Model**:
1. **Lớp Controllers (`account.controller.js`, `seller.controller.js`)**: Được bóc tách sạch sẽ khỏi Route. Làm đúng một nhiệm vụ duy nhất là nhận dữ liệu `req.body`, gọi tầng Service/Model xử lý, và trả về giao diện `res.render`.
2. **Lớp Services (`auth.service.js`, `upload.js`, `mailer.js`)**: Gom cụm các quy trình thao tác nghiệp vụ phức tạp không liên quan đến Web Server HTTP (như tính toán mã OTP, gọi API Recaptcha, di chuyển xử lý file ảnh vật lý, render HTML email).
3. **Lớp Routes (`account.route.js`, `seller.route.js`)**: Được dọn dẹp biến thành các router cực kì nhẹ gọn. Tuyệt đối không còn bất kì hàm nặc danh `(req, res)` nào, toàn bộ đều là khai báo trỏ về Controller.

## 4. Minh chứng (Code trước và sau khi sửa)

### 4.1. Sự Tách Biệt Hoàn Toàn Của Tuyến Đường (Routes)
**Trước khi sửa (`account.route.js` - Hàng trăm dòng lộn xộn):**
```javascript
router.post('/signup', async function (req, res) {
  const { fullname, email, address, password, confirmPassword } = req.body;
  const recaptchaResponse = req.body['g-recaptcha-response'];
  const errors = {};
  
  if (!recaptchaResponse) {
      errors.captcha = 'Please check the captcha box.';
  } else {
      // Vài chục dòng gọi Fetch kiểm tra recaptcha...
      // Khởi tạo User mới xuống Database...
      // Mã hóa mật khẩu, vân vân...
  }
});
```

**Sau khi sửa (Trong file `account.route.js` - Đúng nguyên tắc MVC):**
```javascript
import * as accountController from '../controllers/account.controller.js';
// ...
router.post('/signup', accountController.postSignup); // CHỈ KHAI BÁO MAPPING
```

> **Sau đó Logic trên được chuyển hoàn toàn gọn gàng sang `account.controller.js`.**

### 4.2. Rút gọn Thao Tác Nghiệp vụ File/Ảnh thành Service
**Trước khi sửa (`seller.route.js` - Logic Service bị dính trong Route):**
```javascript
    const mainPath = path.join(dirPath, \`p\${returnedID[0].id}_thumb.jpg\`).replace(/\\\\/g, "/");
    const oldMainPath = path.join('public', 'uploads', path.basename(product.thumbnail)).replace(/\\\\/g, "/");
    fs.renameSync(oldMainPath, mainPath);
    await productModel.updateProductThumbnail(returnedID[0].id, savedMainPath);
```

**Sau khi sửa (Gọi Dịch vụ trong Controller):**
```javascript
    // Bên trong upload.js xử lý việc này và Controller chỉ cần gọi:
    const imgs = JSON.parse(product.imgs_list);
    await processProductImages(returnedID[0].id, product.thumbnail, imgs); // Gọi hàm từ tiện ích
```

### 4.3. Cấu hình xác thực tuân thủ SOLID Open-Closed Principle
**Trước khi sửa (`passport.js`):**
Mỗi giao thức đăng nhập (Google, Facebook, GitHub) có từ 20 đến 30 dòng logic hệt nhau bị copy-paste thủ công.
**Sau khi sửa:**
```javascript
async function handleOAuthLogin(provider, profile, done) {
   // Xử lý chung: Khởi tạo, Mapping Email, Hợp nhất Tài Khoản
}

// Bất kì Strategy tiếp theo nào được tích hợp (LinkedIn, Microsoft, v.v) đều không cần copy-paste logic cũ, 
// cấu hình cũ không cần sửa đổi (Open objects to extension, closed to modification).
passport.use(new GoogleStrategy({ ... }, (token, rfToken, profile, done) => handleOAuthLogin('google', profile, done)));
passport.use(new FacebookStrategy({ ... }, (token, rfToken, profile, done) => handleOAuthLogin('facebook', profile, done)));
passport.use(new GitHubStrategy({ ... }, (token, rfToken, profile, done) => handleOAuthLogin('github', profile, done)));
```
