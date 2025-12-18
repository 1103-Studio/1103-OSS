package metadata

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepository PostgreSQL 实现
type PostgresRepository struct {
	pool *pgxpool.Pool
	tx   pgx.Tx
}

// NewPostgresRepository 创建 PostgreSQL 仓库
func NewPostgresRepository(dsn string) (*PostgresRepository, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse dsn: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PostgresRepository{pool: pool}, nil
}

func (r *PostgresRepository) conn(ctx context.Context) interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
} {
	if r.tx != nil {
		return r.tx
	}
	return r.pool
}

// ==================== User 操作 ====================

func (r *PostgresRepository) CreateUser(ctx context.Context, user *User) error {
	query := `INSERT INTO users (username, password_hash, email, status, is_admin, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
	now := time.Now()
	return r.conn(ctx).QueryRow(ctx, query,
		user.Username, user.PasswordHash, user.Email, user.Status, user.IsAdmin, now, now,
	).Scan(&user.ID)
}

func (r *PostgresRepository) GetUserByID(ctx context.Context, id int64) (*User, error) {
	query := `SELECT id, username, password_hash, email, status, is_admin, created_at, updated_at
		FROM users WHERE id = $1`
	user := &User{}
	var email sql.NullString
	err := r.conn(ctx).QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &email,
		&user.Status, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if email.Valid {
		user.Email = email.String
	}
	return user, nil
}

func (r *PostgresRepository) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	query := `SELECT id, username, password_hash, email, status, is_admin, created_at, updated_at
		FROM users WHERE username = $1`
	user := &User{}
	var email sql.NullString
	err := r.conn(ctx).QueryRow(ctx, query, username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &email,
		&user.Status, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if email.Valid {
		user.Email = email.String
	}
	return user, err
}

func (r *PostgresRepository) UpdateUser(ctx context.Context, user *User) error {
	query := `UPDATE users SET username = $1, password_hash = $2, email = $3, 
		status = $4, is_admin = $5, updated_at = $6 WHERE id = $7`
	_, err := r.conn(ctx).Exec(ctx, query,
		user.Username, user.PasswordHash, user.Email,
		user.Status, user.IsAdmin, time.Now(), user.ID,
	)
	return err
}

func (r *PostgresRepository) DeleteUser(ctx context.Context, id int64) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func (r *PostgresRepository) ListUsers(ctx context.Context) ([]User, error) {
	query := `SELECT id, username, password_hash, email, status, is_admin, created_at, updated_at
		FROM users ORDER BY id`
	rows, err := r.conn(ctx).Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var email sql.NullString
		if err := rows.Scan(&user.ID, &user.Username, &user.PasswordHash, &email,
			&user.Status, &user.IsAdmin, &user.CreatedAt, &user.UpdatedAt); err != nil {
			return nil, err
		}
		if email.Valid {
			user.Email = email.String
		}
		users = append(users, user)
	}
	return users, nil
}

// ==================== Credential 操作 ====================

func (r *PostgresRepository) CreateCredential(ctx context.Context, cred *Credential) error {
	query := `INSERT INTO credentials (user_id, access_key, secret_key, description, status, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
	return r.conn(ctx).QueryRow(ctx, query,
		cred.UserID, cred.AccessKey, cred.SecretKey, cred.Description, cred.Status, time.Now(), cred.ExpiresAt,
	).Scan(&cred.ID)
}

func (r *PostgresRepository) GetCredentialByAccessKey(ctx context.Context, accessKey string) (*Credential, error) {
	query := `SELECT id, user_id, access_key, secret_key, description, status, created_at, expires_at
		FROM credentials WHERE access_key = $1 AND status = 'active'`
	cred := &Credential{}
	var desc sql.NullString
	var expiresAt sql.NullTime
	err := r.conn(ctx).QueryRow(ctx, query, accessKey).Scan(
		&cred.ID, &cred.UserID, &cred.AccessKey, &cred.SecretKey, &desc,
		&cred.Status, &cred.CreatedAt, &expiresAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if desc.Valid {
		cred.Description = desc.String
	}
	if expiresAt.Valid {
		cred.ExpiresAt = &expiresAt.Time
	}
	return cred, err
}

func (r *PostgresRepository) GetCredentialsByUserID(ctx context.Context, userID int64) ([]Credential, error) {
	query := `SELECT id, user_id, access_key, secret_key, description, status, created_at, expires_at
		FROM credentials WHERE user_id = $1`
	rows, err := r.conn(ctx).Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var creds []Credential
	for rows.Next() {
		var cred Credential
		var desc sql.NullString
		var expiresAt sql.NullTime
		if err := rows.Scan(&cred.ID, &cred.UserID, &cred.AccessKey, &cred.SecretKey, &desc,
			&cred.Status, &cred.CreatedAt, &expiresAt); err != nil {
			return nil, err
		}
		if desc.Valid {
			cred.Description = desc.String
		}
		if expiresAt.Valid {
			cred.ExpiresAt = &expiresAt.Time
		}
		creds = append(creds, cred)
	}
	return creds, nil
}

func (r *PostgresRepository) DeleteCredential(ctx context.Context, id int64) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM credentials WHERE id = $1`, id)
	return err
}

// ==================== Bucket 操作 ====================

func (r *PostgresRepository) CreateBucket(ctx context.Context, bucket *Bucket) error {
	query := `INSERT INTO buckets (name, owner_id, region, acl, versioning, created_at)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	return r.conn(ctx).QueryRow(ctx, query,
		bucket.Name, bucket.OwnerID, bucket.Region, bucket.ACL, bucket.Versioning, time.Now(),
	).Scan(&bucket.ID)
}

func (r *PostgresRepository) GetBucketByName(ctx context.Context, name string) (*Bucket, error) {
	query := `SELECT id, name, owner_id, region, acl, versioning, created_at FROM buckets WHERE name = $1`
	bucket := &Bucket{}
	err := r.conn(ctx).QueryRow(ctx, query, name).Scan(
		&bucket.ID, &bucket.Name, &bucket.OwnerID, &bucket.Region,
		&bucket.ACL, &bucket.Versioning, &bucket.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return bucket, err
}

func (r *PostgresRepository) GetBucketByID(ctx context.Context, id int64) (*Bucket, error) {
	query := `SELECT id, name, owner_id, region, acl, versioning, created_at FROM buckets WHERE id = $1`
	bucket := &Bucket{}
	err := r.conn(ctx).QueryRow(ctx, query, id).Scan(
		&bucket.ID, &bucket.Name, &bucket.OwnerID, &bucket.Region,
		&bucket.ACL, &bucket.Versioning, &bucket.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return bucket, err
}

func (r *PostgresRepository) ListBuckets(ctx context.Context, ownerID int64) ([]Bucket, error) {
	query := `SELECT id, name, owner_id, region, acl, versioning, created_at FROM buckets WHERE owner_id = $1 ORDER BY name`
	rows, err := r.conn(ctx).Query(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []Bucket
	for rows.Next() {
		var bucket Bucket
		if err := rows.Scan(&bucket.ID, &bucket.Name, &bucket.OwnerID, &bucket.Region,
			&bucket.ACL, &bucket.Versioning, &bucket.CreatedAt); err != nil {
			return nil, err
		}
		buckets = append(buckets, bucket)
	}
	return buckets, nil
}

func (r *PostgresRepository) ListAllBuckets(ctx context.Context) ([]Bucket, error) {
	query := `SELECT id, name, owner_id, region, acl, versioning, created_at FROM buckets ORDER BY name`
	rows, err := r.conn(ctx).Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buckets []Bucket
	for rows.Next() {
		var bucket Bucket
		if err := rows.Scan(&bucket.ID, &bucket.Name, &bucket.OwnerID, &bucket.Region,
			&bucket.ACL, &bucket.Versioning, &bucket.CreatedAt); err != nil {
			return nil, err
		}
		buckets = append(buckets, bucket)
	}
	return buckets, nil
}

func (r *PostgresRepository) UpdateBucket(ctx context.Context, bucket *Bucket) error {
	query := `UPDATE buckets SET acl = $1, versioning = $2 WHERE id = $3`
	_, err := r.conn(ctx).Exec(ctx, query, bucket.ACL, bucket.Versioning, bucket.ID)
	return err
}

func (r *PostgresRepository) DeleteBucket(ctx context.Context, id int64) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM buckets WHERE id = $1`, id)
	return err
}

// ==================== Object 操作 ====================

func (r *PostgresRepository) CreateObject(ctx context.Context, obj *Object) error {
	metadataJSON, _ := json.Marshal(obj.Metadata)
	query := `INSERT INTO objects (bucket_id, key, version_id, size, etag, content_type, storage_class, storage_path, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (bucket_id, key, version_id) DO UPDATE SET
			size = EXCLUDED.size, etag = EXCLUDED.etag, content_type = EXCLUDED.content_type,
			storage_path = EXCLUDED.storage_path, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at
		RETURNING id`
	now := time.Now()
	versionID := obj.VersionID
	if versionID == "" {
		versionID = "null"
	}
	return r.conn(ctx).QueryRow(ctx, query,
		obj.BucketID, obj.Key, versionID, obj.Size, obj.ETag, obj.ContentType,
		obj.StorageClass, obj.StoragePath, metadataJSON, now, now,
	).Scan(&obj.ID)
}

func (r *PostgresRepository) GetObject(ctx context.Context, bucketID int64, key string) (*Object, error) {
	query := `SELECT id, bucket_id, key, version_id, size, etag, content_type, storage_class, storage_path, metadata, created_at, updated_at
		FROM objects WHERE bucket_id = $1 AND key = $2 AND is_delete_marker = FALSE ORDER BY updated_at DESC LIMIT 1`
	obj := &Object{}
	var metadataJSON []byte
	var versionID sql.NullString
	err := r.conn(ctx).QueryRow(ctx, query, bucketID, key).Scan(
		&obj.ID, &obj.BucketID, &obj.Key, &versionID, &obj.Size, &obj.ETag,
		&obj.ContentType, &obj.StorageClass, &obj.StoragePath, &metadataJSON,
		&obj.CreatedAt, &obj.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if versionID.Valid {
		obj.VersionID = versionID.String
	}
	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &obj.Metadata)
	}
	return obj, nil
}

func (r *PostgresRepository) ListObjects(ctx context.Context, bucketID int64, opts ListObjectsOptions) (*ListObjectsResult, error) {
	if opts.MaxKeys <= 0 {
		opts.MaxKeys = 1000
	}

	result := &ListObjectsResult{}

	// 构建查询
	var conditions []string
	var args []interface{}
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("bucket_id = $%d", argIdx))
	args = append(args, bucketID)
	argIdx++

	conditions = append(conditions, "is_delete_marker = FALSE")

	if opts.Prefix != "" {
		conditions = append(conditions, fmt.Sprintf("key LIKE $%d", argIdx))
		args = append(args, opts.Prefix+"%")
		argIdx++
	}

	if opts.Marker != "" {
		conditions = append(conditions, fmt.Sprintf("key > $%d", argIdx))
		args = append(args, opts.Marker)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT id, bucket_id, key, version_id, size, etag, content_type, storage_class, storage_path, metadata, created_at, updated_at
		FROM objects WHERE %s ORDER BY key LIMIT $%d`, strings.Join(conditions, " AND "), argIdx)
	args = append(args, opts.MaxKeys+1)

	rows, err := r.conn(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prefixSet := make(map[string]bool)
	count := 0

	for rows.Next() {
		var obj Object
		var metadataJSON []byte
		var versionID sql.NullString
		if err := rows.Scan(&obj.ID, &obj.BucketID, &obj.Key, &versionID, &obj.Size, &obj.ETag,
			&obj.ContentType, &obj.StorageClass, &obj.StoragePath, &metadataJSON,
			&obj.CreatedAt, &obj.UpdatedAt); err != nil {
			return nil, err
		}
		if versionID.Valid {
			obj.VersionID = versionID.String
		}
		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &obj.Metadata)
		}

		count++
		if count > opts.MaxKeys {
			result.IsTruncated = true
			break
		}

		// 处理 delimiter
		if opts.Delimiter != "" && opts.Prefix != "" {
			keyWithoutPrefix := strings.TrimPrefix(obj.Key, opts.Prefix)
			if idx := strings.Index(keyWithoutPrefix, opts.Delimiter); idx >= 0 {
				prefix := opts.Prefix + keyWithoutPrefix[:idx+1]
				if !prefixSet[prefix] {
					prefixSet[prefix] = true
					result.CommonPrefixes = append(result.CommonPrefixes, prefix)
				}
				continue
			}
		}

		result.Objects = append(result.Objects, obj)
		result.NextMarker = obj.Key
	}

	return result, nil
}

func (r *PostgresRepository) UpdateObject(ctx context.Context, obj *Object) error {
	metadataJSON, _ := json.Marshal(obj.Metadata)
	query := `UPDATE objects SET size = $1, etag = $2, content_type = $3, storage_path = $4, metadata = $5, updated_at = $6
		WHERE id = $7`
	_, err := r.conn(ctx).Exec(ctx, query, obj.Size, obj.ETag, obj.ContentType, obj.StoragePath, metadataJSON, time.Now(), obj.ID)
	return err
}

func (r *PostgresRepository) DeleteObject(ctx context.Context, bucketID int64, key string) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM objects WHERE bucket_id = $1 AND key = $2`, bucketID, key)
	return err
}

func (r *PostgresRepository) DeleteObjectsByBucketID(ctx context.Context, bucketID int64) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM objects WHERE bucket_id = $1`, bucketID)
	return err
}

func (r *PostgresRepository) GetBucketStats(ctx context.Context, bucketID int64) (objectCount int64, totalSize int64, err error) {
	query := `SELECT COUNT(*), COALESCE(SUM(size), 0) FROM objects WHERE bucket_id = $1 AND is_delete_marker = FALSE`
	err = r.conn(ctx).QueryRow(ctx, query, bucketID).Scan(&objectCount, &totalSize)
	return
}

// ==================== MultipartUpload 操作 ====================

func (r *PostgresRepository) CreateMultipartUpload(ctx context.Context, upload *MultipartUpload) error {
	metadataJSON, _ := json.Marshal(upload.Metadata)
	query := `INSERT INTO multipart_uploads (upload_id, bucket_id, key, content_type, metadata, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
	return r.conn(ctx).QueryRow(ctx, query,
		upload.UploadID, upload.BucketID, upload.Key, upload.ContentType, metadataJSON, upload.Status, time.Now(),
	).Scan(&upload.ID)
}

func (r *PostgresRepository) GetMultipartUpload(ctx context.Context, uploadID string) (*MultipartUpload, error) {
	query := `SELECT id, upload_id, bucket_id, key, content_type, metadata, status, created_at
		FROM multipart_uploads WHERE upload_id = $1`
	upload := &MultipartUpload{}
	var metadataJSON []byte
	var contentType sql.NullString
	err := r.conn(ctx).QueryRow(ctx, query, uploadID).Scan(
		&upload.ID, &upload.UploadID, &upload.BucketID, &upload.Key,
		&contentType, &metadataJSON, &upload.Status, &upload.CreatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if contentType.Valid {
		upload.ContentType = contentType.String
	}
	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &upload.Metadata)
	}
	return upload, err
}

func (r *PostgresRepository) ListMultipartUploads(ctx context.Context, bucketID int64) ([]MultipartUpload, error) {
	query := `SELECT id, upload_id, bucket_id, key, content_type, metadata, status, created_at
		FROM multipart_uploads WHERE bucket_id = $1 AND status = 'in_progress'`
	rows, err := r.conn(ctx).Query(ctx, query, bucketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var uploads []MultipartUpload
	for rows.Next() {
		var upload MultipartUpload
		var metadataJSON []byte
		var contentType sql.NullString
		if err := rows.Scan(&upload.ID, &upload.UploadID, &upload.BucketID, &upload.Key,
			&contentType, &metadataJSON, &upload.Status, &upload.CreatedAt); err != nil {
			return nil, err
		}
		if contentType.Valid {
			upload.ContentType = contentType.String
		}
		if len(metadataJSON) > 0 {
			json.Unmarshal(metadataJSON, &upload.Metadata)
		}
		uploads = append(uploads, upload)
	}
	return uploads, nil
}

func (r *PostgresRepository) DeleteMultipartUpload(ctx context.Context, uploadID string) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM multipart_uploads WHERE upload_id = $1`, uploadID)
	return err
}

// ==================== UploadPart 操作 ====================

func (r *PostgresRepository) CreateUploadPart(ctx context.Context, part *UploadPart) error {
	query := `INSERT INTO upload_parts (upload_id, part_number, size, etag, storage_path, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (upload_id, part_number) DO UPDATE SET size = EXCLUDED.size, etag = EXCLUDED.etag, storage_path = EXCLUDED.storage_path
		RETURNING id`
	return r.conn(ctx).QueryRow(ctx, query,
		part.UploadID, part.PartNumber, part.Size, part.ETag, part.StoragePath, time.Now(),
	).Scan(&part.ID)
}

func (r *PostgresRepository) GetUploadParts(ctx context.Context, uploadID string) ([]UploadPart, error) {
	query := `SELECT id, upload_id, part_number, size, etag, storage_path, created_at
		FROM upload_parts WHERE upload_id = $1 ORDER BY part_number`
	rows, err := r.conn(ctx).Query(ctx, query, uploadID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parts []UploadPart
	for rows.Next() {
		var part UploadPart
		if err := rows.Scan(&part.ID, &part.UploadID, &part.PartNumber, &part.Size,
			&part.ETag, &part.StoragePath, &part.CreatedAt); err != nil {
			return nil, err
		}
		parts = append(parts, part)
	}
	return parts, nil
}

func (r *PostgresRepository) DeleteUploadParts(ctx context.Context, uploadID string) error {
	_, err := r.conn(ctx).Exec(ctx, `DELETE FROM upload_parts WHERE upload_id = $1`, uploadID)
	return err
}

// ==================== 事务 ====================

func (r *PostgresRepository) BeginTx(ctx context.Context) (Repository, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	return &PostgresRepository{pool: r.pool, tx: tx}, nil
}

func (r *PostgresRepository) Commit() error {
	if r.tx != nil {
		return r.tx.Commit(context.Background())
	}
	return nil
}

func (r *PostgresRepository) Rollback() error {
	if r.tx != nil {
		return r.tx.Rollback(context.Background())
	}
	return nil
}

func (r *PostgresRepository) Close() error {
	r.pool.Close()
	return nil
}
