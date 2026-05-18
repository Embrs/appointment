---
name: API 模組職責地圖
description: server/routes/nuxt-api/ 13 個資源目錄職責、認證需求、與 prisma model 對應、公開 vs 後台
type: reference
---

# API 模組職責地圖

`server/routes/nuxt-api/` 13 個資源目錄、約 59 個 handler。所有錯誤一律 `return`（見 [backend-conventions.md](./backend-conventions.md)）。

## 認證分類

| 前綴 | 守衛 | 對象 |
|------|------|------|
| `auth/*` | 無（簽發 token） | 商家成員 |
| `public/*` | 無 | 顧客（公開） |
| `sys/*` | `requireAdmin` | 平台管理員 |
| `merchant/*` / `service/*` / `resource/*` / `schedule/*` / `holiday/*` / `queue/*`（除 ws）/ `appointment/*` / `tinymce/*` / `upload/*` | `requireMerchant` | 商家成員（OWNER/STAFF） |
| `cron/*` | `x-cron-secret` header | 外部 cron service |
| `queue/ws` | MVP 不鑑權（公開讀） | 任何顧客／商家頁 |

## 資源目錄詳表

### `auth/` — 商家認證
| Endpoint | 用途 |
|----------|------|
| `POST sign-up` | 商家註冊（會建立 PENDING merchant + OWNER） |
| `POST sign-in` | 商家成員登入 |
| `POST forgot-password` | 忘記密碼 |
| `GET me` | 取得當前商家身分 |

### `sys/` — 平台管理員
| Endpoint | 用途 |
|----------|------|
| `GET /sys/admin` `POST /sys/admin` `PUT /sys/admin/[id]` `POST /sys/admin/[id]/toggle-active` | 管理員 CRUD |
| `GET /sys/merchant` `GET /sys/merchant/[id]` `PUT /sys/merchant/[id]` | 商家檢視／編輯 |
| `POST /sys/merchant/[id]/approve` `reject` `suspend` `activate` | 商家狀態變更（PENDING→ACTIVE 等） |
| `POST /sys/merchant/[id]/impersonate` | 代理進入商家後台（30 分鐘短 token；拒絕代理鏈） |

### `merchant/` — 商家自身設定 + 員工
| Endpoint | 用途 |
|----------|------|
| `GET /merchant` `PUT /merchant/[id]` | 商家設定（含 `cancelPolicy` JSON） |
| `GET /merchant/staff` `POST /merchant/staff` `PUT /merchant/staff/[id]` `POST /merchant/staff/[id]/toggle-active` | 員工管理（OWNER 限定） |

### `service/` / `resource/` — 服務、資源 CRUD
標準 RESTful：`index.{get,post}` + `[id].{get,put,delete}`，五個 handler 各一支。

### `schedule/` — 排程
| Endpoint | 用途 |
|----------|------|
| `GET /schedule/rules` `PUT /schedule/rules` | 每週規則（PUT 為整批覆蓋） |
| `GET /schedule/override` `POST /schedule/override` `DELETE /schedule/override/[id]` | 特定日期覆寫 |

### `holiday/` — 整店休假日
標準 CRUD（三個 handler：index.get/post + [id].delete）。

### `appointment/` — 後台預約
| Endpoint | 用途 |
|----------|------|
| `GET /appointment` | 列表 |
| `POST /appointment` | 商家代客預約（會略過 cancelPolicy） |
| `POST /appointment/[id]/cancel` | 商家取消 |
| `GET /appointment/archive` | 已歸檔預約 |

### `queue/` — 號碼牌商家控制
| Endpoint | 用途 |
|----------|------|
| `GET /queue/today` | 當日所有號碼牌 |
| `POST /queue/call-next` | 叫下一號（advisory lock + QueueCounter row lock） |
| `POST /queue/[id]/done` `skip` | 完成／跳號 |
| `GET /queue/ws` | WebSocket（廣播 CALL_NEXT/TICKET_DONE/...） |

詳見 [queue-realtime.md](./queue-realtime.md)。

### `public/` — 顧客公開介面（無守衛）
| Endpoint | 用途 |
|----------|------|
| `GET /public/m/[slug]` | 商家公開資料 + 服務 + 資源 |
| `GET /public/availability` | 可用時段查詢 |
| `POST /public/appointment` | 顧客建立預約 |
| `POST /public/appointment/[id]/cancel` | 顧客取消（受 cancelPolicy 限制） |
| `POST /public/appointment/lookup` | 三元組查詢 |
| `POST /public/customer/lookup` | 三元組查跨商家 |
| `GET /public/queue/[id]` `POST /public/queue/take` | 領號 / 查號 |

詳見 [availability-and-booking.md](./availability-and-booking.md)。

### `cron/` — 排程觸發
| Endpoint | 用途 |
|----------|------|
| `POST /cron/archive` | 每日 04:00 UTC 由外部 cron 呼叫；歸檔 + 清理 |

詳見 [deploy-and-env.md](./deploy-and-env.md#cron-jobs)。

### `tinymce/` / `upload/` — 檔案上傳
| Endpoint | 用途 |
|----------|------|
| `POST /tinymce/upload` | TinyEditor 圖片上傳（內嵌呼叫） |
| `POST /upload/image` | 一般圖片上傳（商家設定 logo/cover 等） |

兩支都上傳到 R2（見 [deploy-and-env.md](./deploy-and-env.md#cloudflare-r2)）。

## 與 OpenSpec spec 對應

| spec 名稱 | API 範圍 |
|----------|---------|
| `auth-flow` | `/nuxt-api/auth/*` + Customer Session（前端） |
| `platform-admin` | `/nuxt-api/sys/*` |
| `merchant-platform` | `/nuxt-api/merchant/*`、`service/*`、`resource/*`、`schedule/*`、`holiday/*` |
| `public-availability` | `/nuxt-api/public/availability` + `server/utils/availability.ts` |
| `customer-booking` | `/nuxt-api/public/{m,appointment,customer}/*` |
| `queue-tickets` | `/nuxt-api/queue/*` + `/nuxt-api/public/queue/*` |
| `finalize-deploy` | `/nuxt-api/cron/*` + Dockerfile + i18n |
