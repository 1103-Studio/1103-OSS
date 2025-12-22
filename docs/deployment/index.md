# 部署总览

1103-OSS 支持多种部署方式。

## 你可能会用到的几种部署场景

- **本地开发 / 二次开发**：使用 Docker Compose `dev` profile（热重载）
- **单机生产部署**：使用 Docker Compose `production` profile
- **服务器部署（自定义端口）**：使用 `deployments/docker-compose-server.yml`
- **文档站部署**：本 Wiki 站点可发布到 GitHub Pages 或自托管

## 推荐路径

- 想快速跑起来：先看 [Docker Compose（开发/生产）](docker-compose.md)
- 要上公网/HTTPS/安全加固：看 [生产环境建议](production.md)
- 要发布本项目文档站：看 [文档站部署](docs-site.md)
