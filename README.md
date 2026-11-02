# Cinema.Tickets

在线电影订票系统前端 —— **零框架、零依赖、零构建**，只用原生 HTML / CSS / JavaScript（ES Modules）。

后端为课程提供的 REST API：`https://api.cinema.int.hardcoder.ru`（前缀 `/api`）。

---

## 技术约束

| 约束 | 实现 |
| --- | --- |
| 禁止框架 / 库 / npm / 打包工具 | 无 `package.json`，无第三方 `import`，浏览器直接加载 ES Module |
| 只能使用原生 Web API | `fetch`、`URL` / `URLSearchParams`、`localStorage`、`Intl.DateTimeFormat`、`Intl.NumberFormat`、原生 `<dialog>` |
| 多页面应用（MPA） | 10 个独立 HTML 页面，页面状态完全由 URL 查询串控制，刷新不丢状态 |
| UI 由提供的 kit 决定 | 页面不含 `<style>` 与自定义 CSS，仅通过 `class` 与 `aria-*` 属性表达状态 |
| 配置禁止硬编码 | 时区、排片天数、单场座位上限等全部来自 `GET /api/config` |

## 目录结构

```
.
├── www/                    # 应用本体
│   ├── index.html          # 电影目录（筛选 / 排序 / 分页）
│   ├── movie.html          # 电影详情（排片日期、场次、评论）
│   ├── session.html        # 选座（座位图 + 锁定倒计时）
│   ├── login.html          # 登录
│   ├── registration.html   # 注册
│   ├── profile.html        # 个人资料
│   ├── cart.html           # 购物车（按场次分组 + 倒计时）
│   ├── purchase.html       # 结算（联系方式、支付方式、优惠码）
│   ├── bookings.html       # 我的订单
│   ├── booking.html        # 订单详情
│   └── js/
│       ├── api/            # 数据层：唯一 fetch 出口 + 按资源拆分
│       │   ├── apiClient.js    # ★ ApiError、query 序列化、401 单飞刷新重试
│       │   ├── auth.js         # token 的 localStorage 读写
│       │   ├── config.js       # /api/config 的 Promise 缓存
│       │   └── account.js  movies.js  sessions.js  cart.js  promocodes.js  bookings.js
│       ├── pages/          # 页面层：1 个 HTML ↔ 1 个入口模块
│       ├── components/     # 复用片段（header / seatmap）
│       └── utils/          # 纯函数：format / ui (toast) / phoneMask
├── kit/                    # 提供的 UI kit（tokens / base / layout / components / icons）
└── cinema-mockups.html     # kit 附带的参考视觉稿（组件与各页面状态目录）
```

> ⚠️ `www/` 中的样式与图标引用 `../kit/`，因此 **`kit/` 必须与 `www/` 同级**，不可单独移动或单独部署。

## 本地运行

必须通过 HTTP 服务器打开（ES Module 与外部 SVG 精灵图在 `file://` 下会失败）：

```bash
# 任选其一，在仓库根目录执行
npx serve .            # 打开 /www/index.html
python -m http.server  # 打开 /www/index.html
```

或使用 VS Code 的 Live Server 插件，右键 `index.html` → *Open with Live Server*。

## 关键实现点

- **统一请求出口。** 所有页面只调用 `request()`，`fetch` 仅出现在 `apiClient.js` 中 3 处。鉴权头、JSON 序列化、query 拼装、`ProblemDetails` → `ApiError` 归一化、401 处理都只写一份。
- **401 并发单飞刷新。** 模块级 `refreshInFlight` 保证多个请求同时 401 时只发一次 `/api/account/refresh`；刷新用裸 `fetch` 避免递归；刷新成功后各自重放原请求，且**只重试一次**；刷新失败则清空 token。
- **URL 即状态。** 筛选栏是原生 `<form method="get">`，分页是纯 `<a href>`；`URLSearchParams` 保证翻页时保留全部筛选条件、只改 `page`。
- **座位并发安全。** 选座/取消成功后不本地改状态，而是重新拉取 `/api/sessions/{id}/seats`，以服务端为唯一事实源；报错（座位被抢占）同样重拉。座位三态用 `disabled` / `aria-pressed="true"` / `aria-pressed="false"` 表达，VIP 用 `c-seat--vip`。
- **锁定倒计时。** 取购物车 `holdExpiresAt`（最早过期时间），每秒 `tick`，归零后重拉座位与购物车。展示时间用影院时区，倒计时比较用本地 `Date.now()`。
- **信任边界。** 下单只传 `cartItemIds` + `paymentMethod` + `promoCode`，**不传价格**；折扣金额由服务端重算，前端仅做预览。
- **配置驱动。** `timeZone`、`scheduleDaysAhead`、`maxSeatsPerSession` 均来自 `/api/config`。

## 已知未完成项

以下为已知缺口，非笔误：

1. 评论**写入**：`api/movies.js` 已封装 `reviews/check`、`create`、`update`、`delete`，页面层目前只实现「读 + Show more 追加」，写评论表单与编辑/删除未接入。
2. 订票关闭的边界态：选座页未禁用座位、结算页未禁用确认按钮、购物车未给分组加 `is-error`。
3. `utils/format.js` 中 `formatSessionDateTime` / `formatTimeRange` / `formatCountdown` / `formatSeat` 已实现但页面内联了同类逻辑，待统一收敛。
4. 列表容器未使用 `aria-busy`；座位请求期间无 `is-loading` 态。
5. 少数时间格式化（订单列表/详情、评论日期）仍走浏览器本地时区，待统一为影院时区。

## License

课程作业项目，仅用于学习。
