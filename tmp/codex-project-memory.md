# Codex 项目记忆

更新时间: 2026-04-13

## 技术栈

- 后端: Go 1.21, Gin, pgx/v5, PostgreSQL, Zap
- 前端: React 18, TypeScript, Vite, Ant Design, TanStack Query, Axios
- 存储: 本地文件系统 `internal/storage/local`

## 关键入口

- 服务启动: `cmd/server/main.go`
- 路由与中间件: `internal/api/router.go`
- S3 主处理链: `internal/api/s3/handler.go`
- 鉴权签名: `internal/auth/signature.go`
- 元数据访问: `internal/metadata/postgres.go`
- 前端请求层: `web/src/lib/api.ts`
- 前端认证状态: `web/src/hooks/useAuth.tsx`

## 已验证

- `go test ./...`
- `npm run build` in `web/`
- 本地开发服务已启动并可访问:
  - API: `http://localhost:19000/api`
  - Web: `http://localhost:3001`
  - Postgres: `postgresql://oss:oss_password@localhost:15432/oss`
- 本地引导管理员以容器环境为准，不是默认 `admin/admin123`:
  - `ROOT_USER=maxio`
  - `ROOT_PASSWORD=maxioroot123`

## 已确认问题画像

- 高风险设计债: Web 登录后把 `secretKey` 下发到浏览器，前端自行做 SigV4 签名
- 高风险实现问题: 审计日志原来按请求直接起 goroutine 写库，缺少背压
- 性能问题: 数据库连接池配置原来没有真正应用到 pgx pool
- 性能问题: `objects`/`credentials`/`audit_logs` 缺少部分关键索引，列表与统计会放大 IO
- 可维护性问题: 权限判断在 `internal/api/permissions.go` 和 `internal/api/s3/access.go` 重复
- 可维护性问题: 审计动作识别依赖路径字符串匹配，比较脆

## 本轮已落地修复

- 审计日志改成有界队列 + 固定 worker 写库
- pgx 连接池开始应用 `DB_MAX_OPEN_CONNS` / `DB_MAX_IDLE_CONNS`
- 补充对象列表、凭证查询、审计时间排序相关索引
- 会话令牌改为持久化到 Postgres `sessions` 表，服务重启后不再全部失效
- 新增服务端登出接口 `/auth/logout`，退出时会删除服务端 session
- `deployments/.env` 创建与写回权限收紧到 `0600`
- 前端凭证持久化从 `localStorage` 降到 `sessionStorage`，并兼容迁移旧值
- Web 控制台改为会话令牌鉴权，浏览器不再依赖 `secretKey` 做 API 签名
- 预签名 URL 改由后端生成，浏览器不再持有 S3 签名密钥
- 用户查询新增批量角色/权限装载，消除主路径 N+1
- Bucket 页面改成 policy 懒加载、目录树按需加载
- Web 控制台骨架升级为企业云 OSS 控制台风格，已统一 `Layout` / `Dashboard` / `Buckets` / `Objects` / `AccessControl`
- 手机端已适配顶部栏、抽屉导航、表格横向滚动和表单堆叠
- `Tickets` / `Migration` / `AuditLogs` / `Settings` 已继续改成同一套云控制台界面语言
- `About` 页面已收口为统一云控制台风格，并适配手机端
- Web 前端已全量切到 Ant Design 体系，登录页/Bucket 页/对象页继续完成手机端收口
- 对象上传已从 `react-dropzone` 切为 Ant Design `Upload.Dragger`
- Web 前端已移除 Tailwind / PostCSS / Hot Toast 等遗留依赖和入口
- Vite 构建已改为 React / Query / Ant Design shell/forms/data/feedback/icons 分包
- 迁移链路已从“每对象一个 goroutine”改为固定 worker pool
- 迁移入口已增加 `sourceEndpoint` 安全校验，拦截私网、回环、本地域名和保留地址
- 迁移 HTTP 客户端已增加拨号期 IP 校验，进一步降低 DNS 绕过式 SSRF 风险
- 迁移任务状态已持久化到 `migration_jobs` 表，并新增查询接口:
  - `GET /api/admin/migration/jobs`
  - `GET /api/admin/migration/jobs/:id`
- 迁移任务已补取消能力:
  - `POST /api/admin/migration/jobs/:id/cancel`
  - 运行中任务已从裸 `context.Background()` 改为可追踪、可取消的后台任务
  - 取消后状态会持久化为 `cancelled`
- 已在真实开发环境完成迁移链路接口验证:
  - `POST /api/auth/login` 使用 `maxio/maxioroot123` 登录成功
  - `GET /api/admin/migration/jobs` 可正常返回任务列表
  - `POST /api/admin/migration/start` 对 `http://127.0.0.1:9000` 返回 400，SSRF 拦截生效
  - `POST /api/admin/migration/start` 对 `https://s3.amazonaws.com` + 假凭证返回 200 并创建 `job`
  - `GET /api/admin/migration/jobs/:id` 可观察任务落到 `failed`
  - `lastError`、`errorCount`、`completedAt` 已成功持久化
- 迁移任务空列表接口已稳定化，空结果返回 `[]` 而不是 `null`
- 已在真实开发环境验证取消能力:
  - 启动任务后立即调用 `POST /api/admin/migration/jobs/3/cancel`
  - `GET /api/admin/migration/jobs/3` 返回 `status=cancelled`
  - `lastError= migration cancelled` 且 `completedAt` 已写回

## 待继续处理

- 会话虽已持久化到 DB，但仍是单 token 模式，尚未做设备维度管理、刷新令牌、并发会话上限
- 权限判断重复、审计动作硬编码等可维护性问题还在
- 迁移任务仍缺少失败对象重试、对象覆盖/清理语义定义
