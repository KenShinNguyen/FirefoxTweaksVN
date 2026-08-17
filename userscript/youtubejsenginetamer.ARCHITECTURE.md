# YouTube JS Engine Tamer (bản fork VN) — bản đồ kiến trúc

Tài liệu đi kèm `youtubejsenginetamer.user.js`. Số dòng theo bản trong repo tại thời điểm
viết; khi merge upstream mới thì dò lại bằng tên hàm/tên cờ chứ đừng tin số dòng.

Script là **một file ~12.6k dòng, một IIFE duy nhất**, chạy ở page world
(`@inject-into page`, `@grant none`, `@run-at document-start`). Không có bước build,
không có test. Toàn bộ hành vi được điều khiển bằng ~94 hằng số ở đầu file — khối
`Configuration` đã được nhóm lại đúng theo cây dưới đây, nên đọc từ trên xuống là thấy
được hình dạng của script.

```
YouTube JS Engine Tamer VN
│
├── Core patches
│   ├── DOM                  25 cờ   appendChild / removeChild / XHR / computedStyle / layout
│   ├── Scheduler             5 cờ   scheduler nội bộ của YT, requestIdleCallback, performance.now
│   ├── Animation             5 cờ   Web Animations, cinematic canvas, paper-ripple
│   └── Polymer/ShadyDOM     24 cờ   yt_player, ShadyDOM/ShadyCSS, dom-if / dom-repeat, yt-action
│
├── Experimental
│   ├── template binding      1 cờ   _bindTemplate + templateMap
│   ├── continuation ignore   3 cờ   dedup fetchUpdatedMetadata (số like/view)
│   ├── element-pool hack     2 cờ   chặn reusable element pool + fastDomIf
│   └── still under test      6 cờ   upstream tự ghi EXPERIMENTAL / problematic / TBC
│
├── Memory
│   ├── WeakRef               3 cờ   giữ tham chiếu của YT ở dạng yếu
│   ├── FinalizationRegistry  4 cờ   dọn khi GC thật sự thu hồi node
│   └── cleanup               6 cờ   gỡ listener, map, property của component
│
└── Debug
    └── OFF by default        8 cờ   chỉ log; không cờ nào được bật trong bản phát hành
```

---

## 1. Core patches

### 1.1 DOM

Vá trực tiếp lên prototype dùng chung của trang. Đây là nhóm rủi ro cao nhất vì mọi
script khác trên youtube.com đều đi qua nó.

| Hook | Dòng | Cờ | Ghi chú |
|---|---|---|---|
| `Node.prototype.appendChild` | 10040 | `CHANGE_appendChild` | bỏ qua fragment rỗng hoàn toàn |
| `Node.prototype.removeChild` | 4044 | `FIX_removeChild` | nuốt exception, có đường cứu qua fragment tạm |
| `Node.prototype.isConnected` | 502 | `OVERRIDE_isConnected` | **tắt** trong fork; upstream luôn bật |
| `XMLHttpRequest` (subclass) | 5164 | `FIX_XHR_REQUESTING` | chặn googleads / doubleclick / pagead / ptracking / log_event / qoe |
| `JSON.parse` | 8556 | `FIX_error_many_stack` | **tắt** trong fork |
| scriptlet json-prune của uBO | 8419, 8463 | `FIX_error_many_stack`, `SCRIPTLET_REMOVE_PRUNE_propNeedles` | **tắt** trong fork |
| `getComputedStyle` (cache) | 9359 | `ENABLE_COMPUTEDSTYLE_CACHE` | cache CSSStyleDeclaration theo element, hợp lệ vì object này là live view |
| `CSSStyleDeclaration.prototype.left` | 9678 | `HOOK_CSSPD_LEFT` | |
| `requestStorageAccessFor` | 3406 | `DENY_requestStorageAccess` | no-op trên Firefox (không có API này) |

### 1.2 Scheduler

`FIX_schedulerInstanceInstance` (bitmask 2|4), `FIX_ytScheduler`,
`FIX_fix_requestIdleCallback_timing` (dòng 8379), `FIX_perfNow` (dòng 3974),
`FIX_Polymer_AF`.

`performance.now` bị cộng offset + jitter để né bug Firefox
[1756970](https://bugzilla.mozilla.org/show_bug.cgi?id=1756970) /
[1842437](https://bugzilla.mozilla.org/show_bug.cgi?id=1842437) — nhưng áp dụng cho
**mọi trình duyệt**, kể cả Chrome.

### 1.3 Animation

`NATIVE_CANVAS_ANIMATION` (mặc định false), `FIX_Animation_n_timeline`,
`FIX_Animation_n_timeline_cinematic`, `IGNORE_bindAnimationForCustomEffect`,
`FIX_paper_ripple_animate`.

### 1.4 Polymer / ShadyDOM

Nhóm đông nhất và cũng là lý do script tồn tại. Cơ chế nhận diện: **duck-typing trên
`_yt_player` và trên prototype của custom element** (xem `getZqOu`, `setupYtComponent`
dòng 8264), cộng thêm kiểm tra `Function.length`.

Điểm vào quan trọng nhất là accessor `Object.prototype.connectedCallback` (dòng 8346):
mọi object có `.is` khi đọc `connectedCallback` sẽ kích hoạt `setupYtComponent()`, và từ
đó 6 method `stampDomArray_` / `createComponent_` / `deferRenderStamperBinding_` / … bị
thay bằng bản của script.

Các accessor đặt trên `Object.prototype` — ảnh hưởng **mọi object** trong trang:
`root` (2868), `__CE_shadowRoot` (825), `fastDomIf` (4344), `DomIf` (4518),
`_lastIf` (4535), `__renderDebouncer` (4669), `addJob`/`cancelJob` (3867/3886),
`isLowLatencyLiveStream`/`latencyClass` (743/760), `connectedCallback` (8346).

---

## 2. Experimental

| Nhóm | Cờ | Trạng thái |
|---|---|---|
| template binding | `FIX_TEMPLATE_BINDING` | bật; `templateMap` (dòng ~1642) map `componentIs` → `<template>`, chặn trên bởi số lượng tag name nên **không** phình vô hạn |
| continuation ignore | `FIX_CONTINUATION_IGNORE_COPY`, `FIX_avoid_incorrect_video_meta*` | `FIX_CONTINUATION_IGNORE_COPY` là code hồi sinh trong fork — tắt nếu số like/view ngừng cập nhật |
| element-pool hack | `FORCE_NO_REUSEABLE_ELEMENT_POOL`, `USE_fastDomIf` | probe ghi đè tạm `Map.prototype.get` + `Set.prototype.has` (dòng ~579), chạy **một lần, đồng bộ**, restore trong `finally` |
| still under test | `FIX_bind_self_this`, `ENABLE_ASYNC_DISPATCHEVENT`, `FIX_DOM_IF_REPEAT`, `IGNORE_bufferhealth_CHECK`, `DISABLE_isLowLatencyLiveStream`, `FIX_MODERN_TRANSCRIPT_SEGMENTS` | upstream tự dán nhãn; phần lớn mặc định false |

---

## 3. Memory

### 3.1 WeakRef
`WEAK_REF_BINDING_CONTROL`, `WEAK_CE_ROOT`, `MemoryFix_Flag002` (bitmask).
Mẫu dùng chung: `node[wk] = mWeakRef(node)` rồi lưu WeakRef thay vì lưu node.

### 3.2 FinalizationRegistry
`FIX_stampDomArray_` / `FIX_stampDomArray` (yêu cầu cả `WeakRef` lẫn
`FinalizationRegistry`), `MEMORY_RELEASE_NF00` (**upstream để false** — "need
investigation, no time"), và `STAMPED_MAP_EVICTION` (thêm ở fork).

`stampedNodes` / `stampedFragment` (dòng 1570 / 1572) là hai `Map` khóa bằng id sinh ra từ
`genId()`, giá trị là WeakRef. Node được GC thu hồi bình thường, nhưng **upstream không
bao giờ xóa entry** — khóa chuỗi và vỏ WeakRef chết tích lại tới khi đóng tab. Fork đăng
ký mỗi lần ghi vào một `FinalizationRegistry` và xóa entry khi node bị thu hồi.

### 3.3 cleanup
`MEMORY_RELEASE_MAP_SET_REMOVE_NODE` và `FULLY_REMOVE_ALL_EVENT_LISTENERS` **tắt trong
fork** (consumer duy nhất nằm sau `MEMORY_RELEASE_NF00 = false`).
Còn lại: `FUZZY_EVENT_LISTENER_REMOVAL`, `ENHANCE_DOMIF_TEARDOWN`,
`PROP_OverReInclusion_AVOID` + `PROP_OverReInclusion_LIST`.

---

## 4. Debug — OFF by default

`DEBUG_removePrune`, `DEBUG_DBR847`, `LOG_FETCHMETA_UPDATE`,
`MEMORY_RELEASE_NF00_SHOW_MESSAGE`, `FIX_TEMPLATE_BINDING_SHOW_MESSAGE`,
`PROP_OverReInclusion_DEBUGLOG`, `DEBUG_FN_INTEGRITY`, `DEBUG_EXPOSE_GLOBALS`.

Toàn bộ helper `showNM00`, `testNM00`, `showShadys00`, `showNg00`, `showTemplates00`,
`showFrag00`, `__listWeakNodeC__` đi qua `debugNS` (dòng 342). Với
`DEBUG_EXPOSE_GLOBALS = false` chúng nằm trong một object nội bộ; bật cờ lên thì mới
xuất ra `window` như upstream.

---

## 5. Vùng rủi ro cao — triệu chứng và nghi phạm

Script can thiệp rất sâu vào DOM internals. Một thay đổi nhỏ phía YouTube có thể tạo lỗi
không có stack trace rõ ràng. Bảng tra nhanh khi cần chia đôi tìm thủ phạm:

| Triệu chứng | Nghi phạm đầu tiên | Cờ để tắt |
|---|---|---|
| Click không ăn, nút chết | listener bị gỡ nhầm | `FUZZY_EVENT_LISTENER_REMOVAL`, `FULLY_REMOVE_ALL_EVENT_LISTENERS` |
| Live chat lỗi / không cuộn | template binding, stampDomArray | `FIX_TEMPLATE_BINDING`, `FIX_stampDomArray_` |
| Player chuyển video lỗi | bind self this, VideoEVENTS | `FIX_bind_self_this`, `FIX_VideoEVENTS_v2` |
| SPA navigation treo | dom-if / dom-repeat, element pool | `FIX_DOM_IF_REPEAT`, `FORCE_NO_REUSEABLE_ELEMENT_POOL` |
| Node biến mất / DOM sai | appendChild / removeChild | `CHANGE_appendChild`, `FIX_removeChild` |
| RAM tăng thay vì giảm | teardown, stamped map | `ENHANCE_DOMIF_TEARDOWN`, `STAMPED_MAP_EVICTION` |
| Lỗi ngẫu nhiên sau vài phút | scheduler / idle callback | `FIX_ytScheduler`, `FIX_fix_requestIdleCallback_timing` |

Cách chia đôi nhanh: tắt cả nhóm Experimental trước, rồi tới Memory, giữ Core sau cùng.

---

## 6. Khi YouTube đổi code

Script nhận diện code YouTube bằng ba mức, từ yếu đến mạnh:

1. **Duck-typing** — có method tên gì, `in` prototype nào. Bền nhất trước minify.
2. **`Function.length`** — số tham số. Đây là guard chính cho `stampDomArray_` và bạn bè
   (dòng 8289). Yếu: minifier giữ nguyên arity, nên một bản viết lại hoàn toàn vẫn lọt.
   `propChecker()` (dòng 458) trả về verdict; đặt `STRICT_PROP_CHECK = true` để verdict
   đó thực sự chặn việc vá thay vì chỉ cảnh báo.
3. **`fnIntegrity()`** — vân tay trên source đã minify (`length.symbols.words`). Mạnh
   nhất nhưng phải chốt số bằng tay và chỉ đang dùng ở 2 chỗ.

Quy trình khi nghi YouTube đã đổi: bật `DEBUG_FN_INTEGRITY = true`, mở một video, chép
các giá trị in ra console, rồi chốt lại bằng `fnIntegrity(fn, '<giá trị>')` ở chỗ cần.
Cảnh báo `Code Changed: [...] method ...` trong console là dấu hiệu sớm nhất.
