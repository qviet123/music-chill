/* =========================================================
   DANH SÁCH BÀI HÁT – BẠN CHỈ CẦN SỬA FILE NÀY
   ---------------------------------------------------------
   Cách thêm một bài:
   1. Chép file nhạc (mp3, m4a, wav…) vào thư mục  music/
   2. (Không bắt buộc) chép ảnh bìa vào thư mục    images/
   3. Thêm một dòng { … } vào danh sách bên dưới.

   Các mục trong mỗi bài:
     title  : tên bài hát                 (bắt buộc)
     artist : ca sĩ / nghệ sĩ             (bắt buộc)
     src    : đường dẫn file nhạc         (bắt buộc)  ví dụ 'music/ten-bai.mp3'
     genre  : thể loại – dùng để lọc       (không bắt buộc)
     cover  : đường dẫn ảnh bìa            (không bắt buộc) ví dụ 'images/ten-bai.jpg'
              nếu bỏ trống, trang tự tạo ảnh bìa màu.
     featured: true  → hiện ở mục "Gợi ý cho bạn" (không bắt buộc)

   Mẹo: đặt tên file không dấu, không khoảng trắng (vd: noi-nay-co-anh.mp3)
   ========================================================= */
window.PLAYLIST = [
  { title: 'Tên bài hát 1', artist: 'Tên ca sĩ', genre: 'Pop',     src: 'music/bai-hat-1.mp3', cover: '', featured: true },
  { title: 'Tên bài hát 2', artist: 'Tên ca sĩ', genre: 'Ballad',  src: 'music/bai-hat-2.mp3', cover: '', featured: true },
  { title: 'Tên bài hát 3', artist: 'Tên ca sĩ', genre: 'Rap',     src: 'music/bai-hat-3.mp3', cover: '', featured: true },
  { title: 'Tên bài hát 4', artist: 'Tên ca sĩ', genre: 'Lo-fi',   src: 'music/bai-hat-4.mp3', cover: '', featured: true },
  { title: 'Tên bài hát 5', artist: 'Tên ca sĩ', genre: 'Pop',     src: 'music/bai-hat-5.mp3', cover: '' },
  { title: 'Tên bài hát 6', artist: 'Tên ca sĩ', genre: 'Ballad',  src: 'music/bai-hat-6.mp3', cover: '' },
];
