# mpv config

Bộ config mpv dùng kèm [Handlers Helper](../userscript/Handlers%20Helper.user.js) và
[protocol_hook](scripts/protocol_hook.lua) để mở video từ Firefox bằng mpv.

## Cài đặt

Chép các file trong thư mục này vào thư mục config của mpv:

| Hệ điều hành | Thư mục config (`~~/`) |
| --- | --- |
| Windows | `%APPDATA%\mpv` (hoặc `mpv\portable_config` cạnh `mpv.exe`) |
| macOS | `~/.config/mpv` |
| Linux | `~/.config/mpv` |

- `mpv.conf` — config chính, chạy được trên cả ba hệ điều hành.
- `profiles.conf` — các tuỳ chọn **chỉ đúng trên một hệ điều hành**. mpv không tự đọc
  file này, phải bỏ dấu `#` ở dòng `include=~~/profiles.conf` trong `mpv.conf`.
- `yt-dlp.conf` — chép vào thư mục config của yt-dlp, không phải của mpv.
- `scripts/`, `script-opts/` — giữ nguyên tên thư mục.

Kiểm tra config có lỗi hay không:

```sh
mpv --no-config --version          # phiên bản mpv
mpv "https://www.youtube.com/watch?v=..."   # xem log ở dòng đầu
```

Dòng nào sai, mpv báo ngay khi khởi động kèm **tên file và số dòng** — sửa đúng chỗ đó.

## Lỗi thường gặp

### `Option gpu-api: 'd3d11' isn't supported`

```
Option gpu-api: 'd3d11' isn't supported
Error parsing option gpu-api (option parameter could not be parsed)
/Users/mac/.config/mpv/profiles.conf:6: setting option gpu-api='d3d11' failed.
```

`d3d11` là Direct3D 11, **chỉ có trên Windows**. Trên macOS chỉ có OpenGL (qua lớp
cocoa-cb) và Vulkan (qua MoltenVK, còn thử nghiệm); trên Linux là OpenGL/Vulkan.

Cách sửa: mở đúng file và đúng dòng mà mpv chỉ ra, đổi thành

```
gpu-api=auto
gpu-context=auto
```

`auto` tự chọn d3d11 khi chạy trên Windows, nên không mất gì cả. Ai vẫn muốn ép API
theo từng máy thì để trong `profiles.conf` rồi gọi bằng
`mpv --profile=gpu-windows` / `--profile=gpu-macos` / `--profile=gpu-linux`.

Không dùng được `profile-cond=platform=='windows'` cho việc này: `gpu-api` phải được
đặt **trước** khi cửa sổ video mở ra, còn auto profile chỉ chạy lúc bắt đầu load file,
lúc đó VO đã khởi tạo xong rồi.

> Lỗi này chỉ làm hỏng đúng dòng đó, mpv vẫn chạy tiếp. Nếu video không phát được thì
> nguyên nhân nằm ở lỗi bên dưới.

### `could not find firefox cookies database`

```
ytdl_hook: ERROR: could not find firefox cookies database in '/Users/mac/Library/Application Support/Firefox/Profiles'
ytdl_hook: youtube-dl failed: unexpected error occurred
cplayer: Failed to recognize file format.
cplayer: Exiting... (Errors when loading file)
```

Đây mới là lỗi làm video không phát được. `cookies-from-browser` là tất-cả-hoặc-không-gì:
yt-dlp tìm không ra `cookies.sqlite` thì báo lỗi và bỏ luôn video, chứ không chạy tiếp
mà không có cookies. mpv không nhận được link nào nên báo `Failed to recognize file format`.

yt-dlp chỉ tìm ở đúng một chỗ mặc định của Firefox gốc:

| Hệ điều hành | Nơi yt-dlp tìm |
| --- | --- |
| Windows | `%APPDATA%\Mozilla\Firefox\Profiles` |
| macOS | `~/Library/Application Support/Firefox/Profiles` |
| Linux | `~/.mozilla/firefox` (Firefox 147+: `~/.config/mozilla/firefox`) |

Nếu thư mục đó không có `cookies.sqlite` — hay gặp khi bạn dùng LibreWolf, Zen, Waterfox,
Floorp, Firefox Nightly, bản portable, hoặc profile để ở ổ khác — thì phải chỉ đường dẫn
tay. Lấy đường dẫn thật ở `about:support` → **Thư mục hồ sơ** (Profile Directory) → Open/Show,
rồi dán vào sau `firefox:`

```
ytdl-raw-options-append=cookies-from-browser=firefox:/Users/mac/Library/Application Support/LibreWolf/Profiles/xxxxxxxx.default
```

Ba cách xử lý, chọn một:

1. **Không cần cookies** — cứ để dòng `cookies-from-browser` ở dạng comment trong `mpv.conf`.
   Video công khai vẫn xem bình thường, chỉ mất phần đánh dấu đã xem (`mark-watched`) và
   video giới hạn tuổi / riêng tư.
2. **Chỉ đúng đường dẫn profile** như ví dụ trên.
3. **Xuất riêng file cookies** bằng addon dạng "cookies.txt" rồi trỏ thẳng vào nó, khỏi phụ
   thuộc vị trí profile:

   ```
   ytdl-raw-options-append=cookies=/Users/mac/cookies.txt
   ```

Kiểm tra riêng phần cookies trước khi sửa mpv.conf:

```sh
yt-dlp --cookies-from-browser firefox -F "https://www.youtube.com/watch?v=..."
```

### `Failed to recognize file format`

Câu này gần như luôn là hệ quả của việc yt-dlp chết trước đó, chứ bản thân file không sai.
Đọc ngược lên vài dòng, tìm dòng `ytdl_hook: ERROR:` đầu tiên và sửa đúng nguyên nhân đó.
Chạy lại với `--msg-level=ytdl_hook=debug` để thấy đầy đủ lệnh yt-dlp mà mpv gọi:

```sh
mpv --msg-level=ytdl_hook=debug "https://www.youtube.com/watch?v=..."
```

Nếu yt-dlp báo lỗi ngay cả khi chạy tay thì cập nhật nó trước, YouTube đổi liên tục:

```sh
yt-dlp -U        # hoặc: brew upgrade yt-dlp / pipx upgrade yt-dlp
```

### Link playlist / radio mix (`&list=RD...&start_radio=1`)

`mpv.conf` bật sẵn `ytdl-raw-options-append=yes-playlist=`, nên link kiểu
`watch?v=...&list=RD...` sẽ được mở thành cả danh sách chứ không phải một video.
Muốn chỉ xem đúng video đang bấm thì bỏ phần `&list=...` khỏi link, hoặc chạy

```sh
mpv --ytdl-raw-options-append=no-playlist= "https://www.youtube.com/watch?v=..."
```

## Tuỳ chọn đã đổi tên

mpv 0.38 bỏ `--focus-on-open` và thay bằng `--focus-on`, nên `mpv.conf` ở đây dùng
`focus-on=never`. Ai còn xài mpv 0.37 trở về trước thì đổi lại thành `no-focus-on-open`.
