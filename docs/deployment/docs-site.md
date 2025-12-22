# 文档站部署（GitHub Pages / 自托管）

本项目的文档站使用 **MkDocs + Material** 构建。

## 本地预览

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

默认访问： http://127.0.0.1:8000/

## 构建静态站点

```bash
pip install -r requirements-docs.txt
mkdocs build --clean
```

构建产物默认在 `site/` 目录。

## GitHub Pages（推荐）

仓库提供 GitHub Actions Workflow（见 `.github/workflows/docs.yml`）。

你需要在 GitHub 仓库设置中：

1. 打开 **Settings -> Pages**
2. 在 **Build and deployment** 选择 **GitHub Actions**
3. 推送到 `main` 后会自动构建并发布

如果你的仓库 Pages 地址不是 `https://1103-studio.github.io/1103-OSS/`，请同步修改 `mkdocs.yml` 中的 `site_url`。

## 自托管（Nginx 示例）

1. 构建产物：`mkdocs build --clean`
2. 将 `site/` 上传到服务器，例如 `/var/www/1103-oss-docs/`
3. 配置 Nginx：

```nginx
server {
    listen 80;
    server_name docs.yourdomain.com;

    root /var/www/1103-oss-docs;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

然后重载 Nginx 配置即可。
