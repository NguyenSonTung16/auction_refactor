import expressHandlebarsSections from 'express-handlebars-sections';

 export const hbsHelper = {
    section: expressHandlebarsSections(),
    eq(a, b) { return a === b; },
    add(a, b) { return a + b; },
    format_number(price) { return new Intl.NumberFormat('en-US').format(price); },
    mask_name(fullname) {
      if (!fullname) return null;
      const name = fullname.trim();
      if (name.length === 0) return null;
      if (name.length === 1) return '*';
      if (name.length === 2) return name[0] + '*';
      
      // Mã hóa xen kẽ: giữ ký tự ở vị trí chẵn (0,2,4...), thay bằng * ở vị trí lẻ (1,3,5...)
      // Khoảng trắng cũng được xử lý như ký tự bình thường
      let masked = '';
      for (let i = 0; i < name.length; i++) {
        if (i % 2 === 0) {
          masked += name[i]; // Giữ nguyên ký tự ở vị trí chẵn (kể cả khoảng trắng)
        } else {
          masked += '*'; // Thay bằng * ở vị trí lẻ
        }
      }
      return masked;
    },
    truncate(str, len) {
      if (!str) return '';
      if (str.length <= len) return str;
      return str.substring(0, len) + '...';
    },
    format_date(date) {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');

      return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
    },
    format_only_date(date) {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');

      return `${day}/${month}/${year}`;
    },
    format_only_time(time) {
      if (!time) return '';
      const d = new Date(time);
      if (isNaN(d.getTime())) return '';

      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');

      return `${hour}:${minute}:${second}`;
    },
    format_date_input: function (date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    time_remaining(date) {
      const now = new Date();
      const end = new Date(date);
      const diff = end - now;
      if (diff <= 0) return '00:00:00';
      const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
      const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    },
    format_time_remaining(date) {
      const now = new Date();
      const end = new Date(date);
      console.log(end);
      const diff = end - now;
      
      if (diff <= 0) return 'Auction Ended';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      // > 3 ngày: hiển thị ngày kết thúc
      if (days > 3) {
        if (isNaN(end.getTime())) return '';
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, '0');
        const day = String(end.getDate()).padStart(2, '0');

        const hour = String(end.getHours()).padStart(2, '0');
        const minute = String(end.getMinutes()).padStart(2, '0');
        const second = String(end.getSeconds()).padStart(2, '0');
        return `${hour}:${minute}:${second} ${day}/${month}/${year}`
      }
      
      // <= 3 ngày: hiển thị ... days left
      if (days >= 1) {
        return `${days} days left`;
      }
      
      // < 1 ngày: hiển thị ... hours left
      if (hours >= 1) {
        return `${hours} hours left`;
      }
      
      // < 1 giờ: hiển thị ... minutes left
      if (minutes >= 1) {
        return `${minutes} minutes left`;
      }
      
      // < 1 phút: hiển thị ... seconds left
      return `${seconds} seconds left`;
    },
    should_show_relative_time(date) {
      const now = new Date();
      const end = new Date(date);
      const diff = end - now;
      
      if (diff <= 0) return true; // Auction Ended counts as relative
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      return days <= 3; // True nếu <= 3 ngày (hiển thị relative time)
    },
    getPaginationRange(currentPage, totalPages) {
      const range = [];
      const maxVisible = 4;
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) range.push({ number: i, type: 'number' });
      } else {
        range.push({ number: 1, type: 'number' });
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (start > 2) range.push({ type: 'ellipsis' });
        for (let i = start; i <= end; i++) range.push({ number: i, type: 'number' });
        if (end < totalPages - 1) range.push({ type: 'ellipsis' });
        range.push({ number: totalPages, type: 'number' });
      }
      return range;
    },
    and(...args) { 
      return args.slice(0, -1).every(Boolean); 
    },
    or(...args) { 
      return args.slice(0, -1).some(Boolean); 
    },
    gt(a, b) { 
      return a > b; 
    },
    gte(a, b) { return a >= b; },
    lt(a, b) { 
      return a < b; 
    },
    ne(a, b) {
      return a !== b;
    },
    lte(a, b) { 
      return a <= b; 
    },
    gte(a, b) { 
      return a >= b; 
    },
    lte(a, b) { return a <= b; },
    add(a, b) { 
      return a + b; 
    },
    subtract(a, b) { 
      return a - b; },
    multiply(a, b) {
      return a * b;
    },
    replace(str, search, replaceWith) {
      if (!str) return '';
      return str.replace(new RegExp(search, 'g'), replaceWith);
    },
    range(start, end) {
      const result = [];
      for (let i = start; i < end; i++) {
        result.push(i);
      }
      return result;
    },
    round(value, decimals) {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },
    length(arr) {
      return Array.isArray(arr) ? arr.length : 0;
    },
  };

