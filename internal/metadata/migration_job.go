package metadata

import "time"

type MigrationJob struct {
	ID               int64      `json:"id"`
	UserID           int64      `json:"userId"`
	SourceEndpoint   string     `json:"sourceEndpoint"`
	Region           string     `json:"region"`
	Status           string     `json:"status"`
	CurrentBucket    string     `json:"currentBucket,omitempty"`
	CurrentObject    string     `json:"currentObject,omitempty"`
	TotalBuckets     int        `json:"totalBuckets"`
	TotalObjects     int64      `json:"totalObjects"`
	CompletedObjects int64      `json:"completedObjects"`
	ErrorCount       int        `json:"errorCount"`
	LastError        string     `json:"lastError,omitempty"`
	StartedAt        time.Time  `json:"startedAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	CompletedAt      *time.Time `json:"completedAt,omitempty"`
}
