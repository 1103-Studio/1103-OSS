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

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(128) DEFAULT '';
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_traffic_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS used_traffic_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE buckets ADD COLUMN IF NOT EXISTS max_objects BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_bucket_access_bucket_id ON bucket_access(bucket_id);
CREATE INDEX IF NOT EXISTS idx_bucket_access_user_id ON bucket_access(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
`

func (r *PostgresRepository) EnsureSchema(ctx context.Context) error {
	_, err := r.conn(ctx).Exec(ctx, schemaMigrationsSQL)
	return err
}
