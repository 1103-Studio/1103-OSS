package metadata

import (
	"context"
	"fmt"
	"time"
)

// CreateAuditLog 创建审计日志
func (r *PostgresRepository) CreateAuditLog(ctx context.Context, log *AuditLog) error {
	query := `
		INSERT INTO audit_logs (
			user_id, username, action, resource_type, resource_name,
			bucket_name, object_key, ip_address, user_agent,
			status_code, error_message, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id
	`
	
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}

	return r.conn(ctx).QueryRow(
		ctx, query,
		log.UserID, log.Username, log.Action, log.ResourceType, log.ResourceName,
		log.BucketName, log.ObjectKey, log.IPAddress, log.UserAgent,
		log.StatusCode, log.ErrorMessage, log.Metadata, log.CreatedAt,
	).Scan(&log.ID)
}

// GetAuditLogs 查询审计日志
func (r *PostgresRepository) GetAuditLogs(ctx context.Context, filter *AuditLogFilter) ([]*AuditLog, error) {
	query := `
		SELECT id, user_id, username, action, resource_type, resource_name,
		       bucket_name, object_key, ip_address, user_agent,
		       status_code, error_message, metadata, created_at
		FROM audit_logs
		WHERE 1=1
	`
	args := []interface{}{}
	argIndex := 1

	// 构建过滤条件
	if filter.UserID != nil {
		query += fmt.Sprintf(" AND user_id = $%d", argIndex)
		args = append(args, *filter.UserID)
		argIndex++
	}

	if filter.Action != "" {
		query += fmt.Sprintf(" AND action = $%d", argIndex)
		args = append(args, filter.Action)
		argIndex++
	}

	if filter.ResourceType != "" {
		query += fmt.Sprintf(" AND resource_type = $%d", argIndex)
		args = append(args, filter.ResourceType)
		argIndex++
	}

	if filter.BucketName != "" {
		query += fmt.Sprintf(" AND bucket_name = $%d", argIndex)
		args = append(args, filter.BucketName)
		argIndex++
	}

	if filter.StartTime != nil {
		query += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, *filter.StartTime)
		argIndex++
	}

	if filter.EndTime != nil {
		query += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, *filter.EndTime)
		argIndex++
	}

	query += " ORDER BY created_at DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, filter.Limit)
		argIndex++
	}

	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, filter.Offset)
		argIndex++
	}

	rows, err := r.conn(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := []*AuditLog{}
	for rows.Next() {
		log := &AuditLog{}
		err := rows.Scan(
			&log.ID, &log.UserID, &log.Username, &log.Action, &log.ResourceType,
			&log.ResourceName, &log.BucketName, &log.ObjectKey, &log.IPAddress,
			&log.UserAgent, &log.StatusCode, &log.ErrorMessage, &log.Metadata,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}

// GetAuditLogStats 获取审计日志统计
func (r *PostgresRepository) GetAuditLogStats(ctx context.Context, startTime, endTime time.Time) (map[string]interface{}, error) {
	query := `
		SELECT 
			COUNT(*) as total_operations,
			COUNT(DISTINCT user_id) as unique_users,
			COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_operations,
			COUNT(CASE WHEN action LIKE '%_BUCKET' THEN 1 END) as bucket_operations,
			COUNT(CASE WHEN action LIKE '%_OBJECT' THEN 1 END) as object_operations
		FROM audit_logs
		WHERE created_at BETWEEN $1 AND $2
	`

	var stats struct {
		TotalOps      int64
		UniqueUsers   int64
		FailedOps     int64
		BucketOps     int64
		ObjectOps     int64
	}

	err := r.conn(ctx).QueryRow(ctx, query, startTime, endTime).Scan(
		&stats.TotalOps, &stats.UniqueUsers, &stats.FailedOps,
		&stats.BucketOps, &stats.ObjectOps,
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_operations":   stats.TotalOps,
		"unique_users":       stats.UniqueUsers,
		"failed_operations":  stats.FailedOps,
		"bucket_operations":  stats.BucketOps,
		"object_operations":  stats.ObjectOps,
	}, nil
}

// GetRecentActions 获取最近的操作行为（用于时间线展示）
func (r *PostgresRepository) GetRecentActions(ctx context.Context, limit int) ([]*AuditLog, error) {
	query := `
		SELECT id, user_id, username, action, resource_type, resource_name,
		       bucket_name, object_key, ip_address, user_agent,
		       status_code, error_message, metadata, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := r.conn(ctx).Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := []*AuditLog{}
	for rows.Next() {
		log := &AuditLog{}
		err := rows.Scan(
			&log.ID, &log.UserID, &log.Username, &log.Action, &log.ResourceType,
			&log.ResourceName, &log.BucketName, &log.ObjectKey, &log.IPAddress,
			&log.UserAgent, &log.StatusCode, &log.ErrorMessage, &log.Metadata,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}
