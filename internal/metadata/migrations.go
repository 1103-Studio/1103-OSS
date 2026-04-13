package metadata

import "context"

const schemaMigrationsSQL = `
CREATE TABLE IF NOT EXISTS roles (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(64) UNIQUE NOT NULL,
    description     VARCHAR(256) DEFAULT '',
    permissions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role_id         BIGINT REFERENCES roles(id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS bucket_access (
    id              BIGSERIAL PRIMARY KEY,
    bucket_id       BIGINT REFERENCES buckets(id) ON DELETE CASCADE,
    user_id         BIGINT REFERENCES users(id) ON DELETE CASCADE,
    permission      VARCHAR(32) NOT NULL DEFAULT 'read',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bucket_id, user_id)
);

CREATE TABLE IF NOT EXISTS tickets (
    id              BIGSERIAL PRIMARY KEY,
    requester_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
    assignee_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(32) NOT NULL DEFAULT 'general',
    priority        VARCHAR(16) NOT NULL DEFAULT 'medium',
    status          VARCHAR(16) NOT NULL DEFAULT 'open',
    bucket_id       BIGINT REFERENCES buckets(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at     TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    author_id       BIGINT REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT NOT NULL,
    is_internal     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash      VARCHAR(128) PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_key      VARCHAR(64) NOT NULL REFERENCES credentials(access_key) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS migration_jobs (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_endpoint     TEXT NOT NULL,
    region              VARCHAR(64) NOT NULL DEFAULT 'us-east-1',
    status              VARCHAR(32) NOT NULL DEFAULT 'queued',
    current_bucket      VARCHAR(255) NOT NULL DEFAULT '',
    current_object      TEXT NOT NULL DEFAULT '',
    total_buckets       INT NOT NULL DEFAULT 0,
    total_objects       BIGINT NOT NULL DEFAULT 0,
    completed_objects   BIGINT NOT NULL DEFAULT 0,
    error_count         INT NOT NULL DEFAULT 0,
    last_error          TEXT NOT NULL DEFAULT '',
    started_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(128) NOT NULL,
    code                VARCHAR(64) UNIQUE NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    storage_bytes       BIGINT NOT NULL DEFAULT 0,
    traffic_bytes       BIGINT NOT NULL DEFAULT 0,
    object_quota        BIGINT NOT NULL DEFAULT 0,
    duration_days       INT NOT NULL DEFAULT 30,
    price_cents         BIGINT NOT NULL DEFAULT 0,
    status              VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_pack_codes (
    id                  BIGSERIAL PRIMARY KEY,
    plan_id             BIGINT REFERENCES subscription_plans(id) ON DELETE SET NULL,
    code                VARCHAR(128) UNIQUE NOT NULL,
    label               VARCHAR(128) NOT NULL DEFAULT '',
    storage_bytes       BIGINT NOT NULL DEFAULT 0,
    traffic_bytes       BIGINT NOT NULL DEFAULT 0,
    object_quota        BIGINT NOT NULL DEFAULT 0,
    duration_days       INT NOT NULL DEFAULT 30,
    status              VARCHAR(16) NOT NULL DEFAULT 'active',
    redeemed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    redeemed_at         TIMESTAMP WITH TIME ZONE,
    expires_at          TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id             BIGINT REFERENCES subscription_plans(id) ON DELETE SET NULL,
    resource_code_id    BIGINT REFERENCES resource_pack_codes(id) ON DELETE SET NULL,
    source              VARCHAR(32) NOT NULL DEFAULT 'manual',
    status              VARCHAR(16) NOT NULL DEFAULT 'active',
    storage_bytes       BIGINT NOT NULL DEFAULT 0,
    traffic_bytes       BIGINT NOT NULL DEFAULT 0,
    object_quota        BIGINT NOT NULL DEFAULT 0,
    started_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(128) DEFAULT '';
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_traffic_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS used_traffic_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_objects BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_bucket_access_bucket_id ON bucket_access(bucket_id);
CREATE INDEX IF NOT EXISTS idx_bucket_access_user_id ON bucket_access(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_user_id_started_at ON migration_jobs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status_started_at ON migration_jobs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_status ON subscription_plans(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_pack_codes_status ON resource_pack_codes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_pack_codes_user_id ON resource_pack_codes(redeemed_by_user_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_bucket_key_updated_at ON objects(bucket_id, key, updated_at DESC) WHERE is_delete_marker = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);
`

func (r *PostgresRepository) EnsureSchema(ctx context.Context) error {
	_, err := r.conn(ctx).Exec(ctx, schemaMigrationsSQL)
	return err
}
