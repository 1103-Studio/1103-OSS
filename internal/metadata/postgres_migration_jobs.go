package metadata

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) CreateMigrationJob(ctx context.Context, job *MigrationJob) error {
	query := `INSERT INTO migration_jobs (
		user_id, source_endpoint, region, status, current_bucket, current_object,
		total_buckets, total_objects, completed_objects, error_count, last_error,
		started_at, updated_at, completed_at
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	RETURNING id`

	now := time.Now()
	if job.StartedAt.IsZero() {
		job.StartedAt = now
	}
	job.UpdatedAt = now

	return r.conn(ctx).QueryRow(ctx, query,
		job.UserID, job.SourceEndpoint, job.Region, job.Status, job.CurrentBucket, job.CurrentObject,
		job.TotalBuckets, job.TotalObjects, job.CompletedObjects, job.ErrorCount, job.LastError,
		job.StartedAt, job.UpdatedAt, job.CompletedAt,
	).Scan(&job.ID)
}

func (r *PostgresRepository) GetMigrationJob(ctx context.Context, id int64) (*MigrationJob, error) {
	query := `SELECT id, user_id, source_endpoint, region, status, current_bucket, current_object,
		total_buckets, total_objects, completed_objects, error_count, last_error,
		started_at, updated_at, completed_at
		FROM migration_jobs WHERE id = $1`

	job := &MigrationJob{}
	err := r.conn(ctx).QueryRow(ctx, query, id).Scan(
		&job.ID, &job.UserID, &job.SourceEndpoint, &job.Region, &job.Status, &job.CurrentBucket, &job.CurrentObject,
		&job.TotalBuckets, &job.TotalObjects, &job.CompletedObjects, &job.ErrorCount, &job.LastError,
		&job.StartedAt, &job.UpdatedAt, &job.CompletedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return job, nil
}

func (r *PostgresRepository) ListMigrationJobs(ctx context.Context, userID *int64, limit int) ([]*MigrationJob, error) {
	query := `SELECT id, user_id, source_endpoint, region, status, current_bucket, current_object,
		total_buckets, total_objects, completed_objects, error_count, last_error,
		started_at, updated_at, completed_at
		FROM migration_jobs`
	args := make([]interface{}, 0, 2)

	if userID != nil {
		query += ` WHERE user_id = $1`
		args = append(args, *userID)
	}

	query += ` ORDER BY started_at DESC`
	if limit <= 0 {
		limit = 20
	}
	query += fmt.Sprintf(" LIMIT $%d", len(args)+1)
	args = append(args, limit)

	rows, err := r.conn(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*MigrationJob
	for rows.Next() {
		job := &MigrationJob{}
		if err := rows.Scan(
			&job.ID, &job.UserID, &job.SourceEndpoint, &job.Region, &job.Status, &job.CurrentBucket, &job.CurrentObject,
			&job.TotalBuckets, &job.TotalObjects, &job.CompletedObjects, &job.ErrorCount, &job.LastError,
			&job.StartedAt, &job.UpdatedAt, &job.CompletedAt,
		); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (r *PostgresRepository) UpdateMigrationJob(ctx context.Context, job *MigrationJob) error {
	job.UpdatedAt = time.Now()

	query := `UPDATE migration_jobs
		SET status = $1, current_bucket = $2, current_object = $3, total_buckets = $4, total_objects = $5,
			completed_objects = $6, error_count = $7, last_error = $8, updated_at = $9, completed_at = $10
		WHERE id = $11`

	_, err := r.conn(ctx).Exec(ctx, query,
		job.Status, job.CurrentBucket, job.CurrentObject, job.TotalBuckets, job.TotalObjects,
		job.CompletedObjects, job.ErrorCount, job.LastError, job.UpdatedAt, job.CompletedAt, job.ID,
	)
	return err
}
