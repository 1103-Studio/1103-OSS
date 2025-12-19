-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username        VARCHAR(255),
    action          VARCHAR(50) NOT NULL,  -- CREATE, DELETE, UPLOAD, UPDATE, etc.
    resource_type   VARCHAR(50) NOT NULL,  -- BUCKET, OBJECT, USER, CREDENTIAL
    resource_name   VARCHAR(1024),
    bucket_name     VARCHAR(255),
    object_key      VARCHAR(1024),
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    status_code     INTEGER,
    error_message   TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_bucket_name ON audit_logs(bucket_name);
