package metadata

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) GetBucketAccess(ctx context.Context, bucketID, userID int64) (*BucketAccess, error) {
	access := &BucketAccess{}
	err := r.conn(ctx).QueryRow(ctx, `
		SELECT id, bucket_id, user_id, permission, created_at, updated_at
		FROM bucket_access
		WHERE bucket_id = $1 AND user_id = $2
	`, bucketID, userID).Scan(&access.ID, &access.BucketID, &access.UserID, &access.Permission, &access.CreatedAt, &access.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return access, nil
}

func (r *PostgresRepository) ListBucketAccess(ctx context.Context, bucketID int64) ([]BucketAccess, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, bucket_id, user_id, permission, created_at, updated_at
		FROM bucket_access
		WHERE bucket_id = $1
		ORDER BY user_id
	`, bucketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]BucketAccess, 0)
	for rows.Next() {
		var access BucketAccess
		if err := rows.Scan(&access.ID, &access.BucketID, &access.UserID, &access.Permission, &access.CreatedAt, &access.UpdatedAt); err != nil {
			return nil, err
		}
		records = append(records, access)
	}
	return records, rows.Err()
}

func (r *PostgresRepository) UpsertBucketAccess(ctx context.Context, access *BucketAccess) error {
	now := time.Now()
	return r.conn(ctx).QueryRow(ctx, `
		INSERT INTO bucket_access (bucket_id, user_id, permission, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (bucket_id, user_id)
		DO UPDATE SET permission = EXCLUDED.permission, updated_at = EXCLUDED.updated_at
		RETURNING id
	`, access.BucketID, access.UserID, access.Permission, now, now).Scan(&access.ID)
}

func (r *PostgresRepository) DeleteBucketAccess(ctx context.Context, bucketID, userID int64) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM bucket_access WHERE bucket_id = $1 AND user_id = $2`, bucketID, userID)
	return err
}

func (r *PostgresRepository) CreateRole(ctx context.Context, role *Role) error {
	permissionsJSON, _ := json.Marshal(role.Permissions)
	now := time.Now()
	return r.conn(ctx).QueryRow(ctx, `
		INSERT INTO roles (name, description, permissions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, role.Name, role.Description, permissionsJSON, now, now).Scan(&role.ID)
}

func (r *PostgresRepository) GetRoleByID(ctx context.Context, id int64) (*Role, error) {
	role := &Role{}
	var permissionsJSON []byte
	err := r.conn(ctx).QueryRow(ctx, `
		SELECT id, name, description, permissions, created_at, updated_at
		FROM roles
		WHERE id = $1
	`, id).Scan(&role.ID, &role.Name, &role.Description, &permissionsJSON, &role.CreatedAt, &role.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(permissionsJSON, &role.Permissions)
	return role, nil
}

func (r *PostgresRepository) GetRoleByName(ctx context.Context, name string) (*Role, error) {
	role := &Role{}
	var permissionsJSON []byte
	err := r.conn(ctx).QueryRow(ctx, `
		SELECT id, name, description, permissions, created_at, updated_at
		FROM roles
		WHERE name = $1
	`, name).Scan(&role.ID, &role.Name, &role.Description, &permissionsJSON, &role.CreatedAt, &role.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(permissionsJSON, &role.Permissions)
	return role, nil
}

func (r *PostgresRepository) ListRoles(ctx context.Context) ([]Role, error) {
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, name, description, permissions, created_at, updated_at
		FROM roles
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	roles := make([]Role, 0)
	for rows.Next() {
		var role Role
		var permissionsJSON []byte
		if err := rows.Scan(&role.ID, &role.Name, &role.Description, &permissionsJSON, &role.CreatedAt, &role.UpdatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(permissionsJSON, &role.Permissions)
		roles = append(roles, role)
	}
	return roles, rows.Err()
}

func (r *PostgresRepository) UpdateRole(ctx context.Context, role *Role) error {
	permissionsJSON, _ := json.Marshal(role.Permissions)
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE roles
		SET name = $1, description = $2, permissions = $3, updated_at = $4
		WHERE id = $5
	`, role.Name, role.Description, permissionsJSON, time.Now(), role.ID)
	return err
}

func (r *PostgresRepository) DeleteRole(ctx context.Context, id int64) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM roles WHERE id = $1`, id)
	return err
}
