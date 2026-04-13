# Codex 审计缓存

更新时间: 2026-04-13

## 高优先级

1. 浏览器持有 S3 `secretKey`
   - 文件: `internal/api/auth_handler.go`, `web/src/hooks/useAuth.tsx`, `web/src/lib/api.ts`
   - 影响: XSS 或浏览器侧供应链脚本一旦命中，可直接接管对象存储权限
   - 状态: Web 主路径已修复，改为会话令牌 + 服务端预签名；仍需留意其它页面/未来回归

2. 审计日志写入缺少背压
   - 文件: `internal/api/audit_middleware.go`
   - 影响: 高并发下 goroutine 膨胀，拖垮 API
   - 状态: 本轮已修复

## 中优先级

1. 连接池配置未生效
   - 文件: `internal/metadata/postgres.go`, `cmd/server/main.go`
   - 影响: 高并发下连接行为不可控
   - 状态: 本轮已修复

2. 缺关键索引
   - 文件: `internal/metadata/migrations.go`, `scripts/init.sql`
   - 影响: 对象列表、凭证查询、审计排序容易退化
   - 状态: 本轮已修复

3. 用户查询 N+1
   - 文件: `internal/metadata/postgres.go`
   - 影响: 用户数上去后管理接口明显变慢
   - 状态: 本轮已修复主路径

4. 迁移对象并发模型粗糙
   - 文件: `internal/api/migration_handler.go`
   - 影响: 超大桶迁移时 goroutine 数量过高
   - 状态: 本轮已修复为固定 worker pool

5. 前端目录树全量加载
   - 文件: `web/src/pages/Buckets.tsx`
   - 影响: 大桶 UI 卡顿、请求慢、内存大
   - 状态: 本轮已改为按需加载

6. 会话仅驻留进程内内存
   - 文件: `internal/api/helpers.go`, `internal/metadata/repository.go`, `internal/metadata/postgres.go`
   - 影响: 服务重启后全员掉线，多实例无法共享
   - 状态: 本轮已修复为 Postgres 持久化，并补 `/auth/logout`

7. 迁移入口缺少源站限制提示
   - 文件: `web/src/pages/Migration.tsx`, `internal/api/migration_handler.go`
   - 影响: 前端虽已做控制台化，但后端若不限制 `sourceEndpoint` 仍存在 SSRF / 内网目标风险
   - 状态: 本轮后端已补端点校验，拦截私网、回环、本地域名与保留地址

8. 迁移任务列表空结果返回 `null`
   - 文件: `internal/api/migration_handler.go`
   - 影响: 前端轮询、手机端空状态和类型收窄会变脆，容易出现额外判空分支
   - 状态: 本轮已修复为稳定返回空数组 `[]`

9. 迁移任务启动后不可取消
   - 文件: `internal/api/migration_handler.go`, `internal/api/router.go`, `web/src/pages/Migration.tsx`, `web/src/lib/api.ts`
   - 影响: 长时间外部迁移无法主动止损，错误端点或错误凭证场景只能被动等待
   - 状态: 本轮已修复，新增取消接口、任务注册表和控制台取消按钮

10. 前端仍残留 Tailwind / 非 Ant 组件链路
   - 文件: `web/package.json`, `web/src/index.css`, `web/src/pages/Objects.tsx`, `web/src/main.tsx`
   - 影响: 包体偏大、视觉语言不统一、移动端和上传交互继续分裂
   - 状态: 本轮已修复，已切为纯 Ant Design 主路径并清理遗留依赖

## 代码屎山点

- 权限判断逻辑重复
- API 同时混用 XML 与 JSON 错误语义
- 审计动作分类硬编码在字符串匹配里
- 前端认证与签名逻辑仍偏耦合，但已从密钥直出降级为 session token
- 前端页面视觉语言此前分裂较重，本轮已统一主要控制台页面并完成 `About` 收口
- Vite 对 `antd` 的大 vendor 粗暴合包会拖慢首屏，本轮已改为分组拆包

## 真实环境测试记录

- 时间: 2026-04-13
- 环境:
  - API `http://localhost:19000/api`
  - Web `http://localhost:3001`
  - Postgres `postgresql://oss:oss_password@localhost:15432/oss`
  - 引导管理员 `maxio/maxioroot123`
- 用例结果:
  - `POST /api/auth/login` 成功，拿到 `sessionToken`
  - `GET /api/admin/migration/jobs` 成功
  - `POST /api/admin/migration/start` with `http://127.0.0.1:9000` 返回 400，错误为 `sourceEndpoint resolved to a private or reserved address`
  - `POST /api/admin/migration/start` with `https://s3.amazonaws.com` + fake 凭证返回 200，并创建任务 `id=1`
  - `GET /api/admin/migration/jobs/1` 最终返回 `status=failed`
  - 持久化字段确认已更新: `errorCount=1`、`lastError`、`completedAt`
  - `POST /api/admin/migration/start` with `https://s3.us-east-1.amazonaws.com` 后立即调用 `POST /api/admin/migration/jobs/:id/cancel`，随后 `GET /api/admin/migration/jobs/:id` 返回 `status=cancelled`
- 额外观察:
  - 当前库内已有 `admin` 和 `maxio` 两个管理员，但生效引导口令来自容器环境变量，默认 `admin/admin123` 不可直接用于当前开发库
  - 取消链路的真实 bug 已定位并修复: 之前用已取消的任务 `context` 写 DB，导致状态卡在 `running`
