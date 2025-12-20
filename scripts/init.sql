-- GoOSS Database Schema

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(64) UNIQUE NOT NULL,
    password_hash   VARCHAR(256) NOT NULL,
    email           VARCHAR(256),
    status          VARCHAR(20) DEFAULT 'active',
    is_admin        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 访问凭证表
CREATE TABLE IF NOT EXISTS credentials (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    access_key      VARCHAR(64) UNIQUE NOT NULL,
    secret_key      VARCHAR(128) NOT NULL,
    description     VARCHAR(256),
    status          VARCHAR(20) DEFAULT 'active',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE
);

-- Bucket 表
CREATE TABLE IF NOT EXISTS buckets (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(63) UNIQUE NOT NULL,
    owner_id        BIGINT REFERENCES users(id) ON DELETE CASCADE,
    region          VARCHAR(64) DEFAULT 'default',
    acl             VARCHAR(32) DEFAULT 'private',
    versioning      BOOLEAN DEFAULT FALSE,
    default_expiry  VARCHAR(32) DEFAULT '7d',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 对象表
CREATE TABLE IF NOT EXISTS objects (
    id              BIGSERIAL PRIMARY KEY,
    bucket_id       BIGINT REFERENCES buckets(id) ON DELETE CASCADE,
    key             VARCHAR(1024) NOT NULL,
    version_id      VARCHAR(64),
    size            BIGINT NOT NULL DEFAULT 0,
    etag            VARCHAR(64),
    content_type    VARCHAR(256) DEFAULT 'application/octet-stream',
    storage_class   VARCHAR(32) DEFAULT 'STANDARD',
    storage_path    VARCHAR(1024),
    metadata        JSONB DEFAULT '{}',
    is_delete_marker BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bucket_id, key, version_id)
);

-- 分片上传表
CREATE TABLE IF NOT EXISTS multipart_uploads (
    id              BIGSERIAL PRIMARY KEY,
    upload_id       VARCHAR(64) UNIQUE NOT NULL,
    bucket_id       BIGINT REFERENCES buckets(id) ON DELETE CASCADE,
    key             VARCHAR(1024) NOT NULL,
    content_type    VARCHAR(256),
    metadata        JSONB DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'in_progress',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 分片表
CREATE TABLE IF NOT EXISTS upload_parts (
    id              BIGSERIAL PRIMARY KEY,
    upload_id       VARCHAR(64) REFERENCES multipart_uploads(upload_id) ON DELETE CASCADE,
    part_number     INT NOT NULL,
    size            BIGINT NOT NULL,
    etag            VARCHAR(64),
    storage_path    VARCHAR(1024),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(upload_id, part_number)
);

-- Bucket 策略表
CREATE TABLE IF NOT EXISTS bucket_policies (
    id              BIGSERIAL PRIMARY KEY,
    bucket_id       BIGINT REFERENCES buckets(id) ON DELETE CASCADE UNIQUE,
    policy          JSONB NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username        VARCHAR(64) NOT NULL,
    action          VARCHAR(64) NOT NULL,
    resource_type   VARCHAR(32) NOT NULL,
    resource_name   VARCHAR(256),
    bucket_name     VARCHAR(63),
    object_key      VARCHAR(1024),
    ip_address      VARCHAR(45) NOT NULL,
    user_agent      TEXT,
    status_code     INT NOT NULL,
    error_message   TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_objects_bucket_key ON objects(bucket_id, key);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_prefix ON objects(bucket_id, key varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_credentials_access_key ON credentials(access_key);
CREATE INDEX IF NOT EXISTS idx_multipart_bucket ON multipart_uploads(bucket_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_bucket_name ON audit_logs(bucket_name);

-- 初始管理员用户 (密码: admin123, 需要在应用启动时更新为真实 hash)
INSERT INTO users (username, password_hash, is_admin) 
VALUES ('admin', '$2a$10$placeholder_hash_will_be_updated', TRUE)
ON CONFLICT (username) DO NOTHING;
