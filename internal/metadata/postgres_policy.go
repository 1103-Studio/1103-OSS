package metadata

import "context"

// SetBucketPolicy 设置 Bucket 策略
func (r *PostgresRepository) SetBucketPolicy(ctx context.Context, bucketID int64, policy []byte) error {
	query := `
		INSERT INTO bucket_policies (bucket_id, policy, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		ON CONFLICT (bucket_id) 
		DO UPDATE SET policy = $2, updated_at = NOW()
	`
	_, err := r.conn(ctx).Exec(ctx, query, bucketID, policy)
	return err
}

// GetBucketPolicy 获取 Bucket 策略
func (r *PostgresRepository) GetBucketPolicy(ctx context.Context, bucketID int64) ([]byte, error) {
	query := `SELECT policy FROM bucket_policies WHERE bucket_id = $1`
	var policy []byte
	err := r.conn(ctx).QueryRow(ctx, query, bucketID).Scan(&policy)
	if err != nil {
		return nil, err
	}
	return policy, nil
}

// DeleteBucketPolicy 删除 Bucket 策略
func (r *PostgresRepository) DeleteBucketPolicy(ctx context.Context, bucketID int64) error {
	query := `DELETE FROM bucket_policies WHERE bucket_id = $1`
	_, err := r.conn(ctx).Exec(ctx, query, bucketID)
	return err
}
