package metadata

import (
	"context"
	"time"
)

// User 用户
type User struct {
	ID           int64
	Username     string
	PasswordHash string
	DisplayName  string
	Email        string
	Status       string
	IsAdmin      bool
	Subscription SubscriptionProfile
	Roles        []Role
	Permissions  []string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Credential 访问凭证
type Credential struct {
	ID          int64
	UserID      int64
	AccessKey   string
	SecretKey   string
	Description string
	Status      string
	CreatedAt   time.Time
	ExpiresAt   *time.Time
}

type Session struct {
	TokenHash string
	UserID    int64
	AccessKey string
	CreatedAt time.Time
	ExpiresAt time.Time
}

// Bucket 存储桶
type Bucket struct {
	ID               int64
	Name             string
	OwnerID          int64
	Region           string
	ACL              string
	Versioning       bool
	DefaultExpiry    string // 预签名URL默认过期时间，如 "7d", "4w", "2h30m"
	MaxSizeBytes     int64
	MaxTrafficBytes  int64
	UsedTrafficBytes int64
	MaxObjects       int64
	CreatedAt        time.Time
}

type Role struct {
	ID          int64
	Name        string
	Description string
	Permissions []string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type SubscriptionPlan struct {
	ID                int64
	Name              string
	Code              string
	Description       string
	StorageBytes      int64
	TrafficBytes      int64
	ObjectQuota       int64
	DurationDays      int
	PriceCents        int64
	Status            string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type ResourcePackCode struct {
	ID                int64
	PlanID            int64
	Code              string
	Label             string
	StorageBytes      int64
	TrafficBytes      int64
	ObjectQuota       int64
	DurationDays      int
	Status            string
	RedeemedByUserID  *int64
	RedeemedAt        *time.Time
	ExpiresAt         *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type UserSubscription struct {
	ID                int64
	UserID            int64
	PlanID            *int64
	ResourceCodeID    *int64
	Source            string
	Status            string
	StorageBytes      int64
	TrafficBytes      int64
	ObjectQuota       int64
	StartedAt         time.Time
	ExpiresAt         *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type SubscriptionProfile struct {
	ActivePlans       []UserSubscription
	TotalStorageBytes int64
	TotalTrafficBytes int64
	TotalObjectQuota  int64
	ExpiresAt         *time.Time
}

type BucketAccess struct {
	ID         int64
	BucketID   int64
	UserID     int64
	Permission string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type Ticket struct {
	ID          int64
	RequesterID int64
	AssigneeID  *int64
	Title       string
	Description string
	Category    string
	Priority    string
	Status      string
	BucketID    *int64
	BucketName  string
	Requester   string
	Assignee    string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	ResolvedAt  *time.Time
}

type TicketMessage struct {
	ID         int64
	TicketID   int64
	AuthorID   int64
	Author     string
	Message    string
	IsInternal bool
	CreatedAt  time.Time
}

type TicketFilter struct {
	RequesterID *int64
	AssigneeID  *int64
	Status      string
	Category    string
	Priority    string
	Limit       int
	Offset      int
	IncludeAll  bool
}

// Object 对象
type Object struct {
	ID             int64
	BucketID       int64
	Key            string
	VersionID      string
	Size           int64
	ETag           string
	ContentType    string
	StorageClass   string
	StoragePath    string
	Metadata       map[string]string
	IsDeleteMarker bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// MultipartUpload 分片上传
type MultipartUpload struct {
	ID          int64
	UploadID    string
	BucketID    int64
	Key         string
	ContentType string
	Metadata    map[string]string
	Status      string
	CreatedAt   time.Time
}

// UploadPart 分片
type UploadPart struct {
	ID          int64
	UploadID    string
	PartNumber  int
	Size        int64
	ETag        string
	StoragePath string
	CreatedAt   time.Time
}

// ListObjectsOptions 列表选项
type ListObjectsOptions struct {
	Prefix            string
	Delimiter         string
	Marker            string
	MaxKeys           int
	ContinuationToken string
}

// ListObjectsResult 列表结果
type ListObjectsResult struct {
	Objects               []Object
	CommonPrefixes        []string
	IsTruncated           bool
	NextMarker            string
	NextContinuationToken string
}

// Repository 元数据仓库接口
type Repository interface {
	// User 操作
	CreateUser(ctx context.Context, user *User) error
	GetUserByID(ctx context.Context, id int64) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	UpdateUser(ctx context.Context, user *User) error
	DeleteUser(ctx context.Context, id int64) error
	ListUsers(ctx context.Context) ([]User, error)
	GetUserPermissions(ctx context.Context, userID int64) ([]string, error)
	SetUserRoles(ctx context.Context, userID int64, roleIDs []int64) error
	ListUserRoles(ctx context.Context, userID int64) ([]Role, error)

	// Credential 操作
	CreateCredential(ctx context.Context, cred *Credential) error
	GetCredentialByID(ctx context.Context, id int64) (*Credential, error)
	GetCredentialByAccessKey(ctx context.Context, accessKey string) (*Credential, error)
	GetCredentialsByUserID(ctx context.Context, userID int64) ([]Credential, error)
	UpdateCredential(ctx context.Context, cred *Credential) error
	DeleteCredential(ctx context.Context, id int64) error

	// Session 操作
	CreateSession(ctx context.Context, session *Session) error
	GetSession(ctx context.Context, tokenHash string) (*Session, error)
	DeleteSession(ctx context.Context, tokenHash string) error
	DeleteExpiredSessions(ctx context.Context) error

	// Bucket 操作
	CreateBucket(ctx context.Context, bucket *Bucket) error
	GetBucketByName(ctx context.Context, name string) (*Bucket, error)
	GetBucketByID(ctx context.Context, id int64) (*Bucket, error)
	ListBuckets(ctx context.Context, ownerID int64) ([]Bucket, error)
	ListAccessibleBuckets(ctx context.Context, userID int64) ([]Bucket, error)
	ListAllBuckets(ctx context.Context) ([]Bucket, error)
	UpdateBucket(ctx context.Context, bucket *Bucket) error
	IncrementBucketTraffic(ctx context.Context, bucketID int64, delta int64) error
	DeleteBucket(ctx context.Context, id int64) error

	// Bucket 授权操作
	GetBucketAccess(ctx context.Context, bucketID, userID int64) (*BucketAccess, error)
	ListBucketAccess(ctx context.Context, bucketID int64) ([]BucketAccess, error)
	UpsertBucketAccess(ctx context.Context, access *BucketAccess) error
	DeleteBucketAccess(ctx context.Context, bucketID, userID int64) error

	// Role 操作
	CreateRole(ctx context.Context, role *Role) error
	GetRoleByID(ctx context.Context, id int64) (*Role, error)
	GetRoleByName(ctx context.Context, name string) (*Role, error)
	ListRoles(ctx context.Context) ([]Role, error)
	UpdateRole(ctx context.Context, role *Role) error
	DeleteRole(ctx context.Context, id int64) error

	// Bucket Policy 操作
	SetBucketPolicy(ctx context.Context, bucketID int64, policy []byte) error
	GetBucketPolicy(ctx context.Context, bucketID int64) ([]byte, error)
	DeleteBucketPolicy(ctx context.Context, bucketID int64) error

	// Audit Logs
	CreateAuditLog(ctx context.Context, log *AuditLog) error
	GetAuditLogs(ctx context.Context, filter *AuditLogFilter) ([]*AuditLog, error)
	GetAuditLogStats(ctx context.Context, startTime, endTime time.Time) (map[string]interface{}, error)
	GetRecentActions(ctx context.Context, limit int) ([]*AuditLog, error)

	// Migration Jobs
	CreateMigrationJob(ctx context.Context, job *MigrationJob) error
	GetMigrationJob(ctx context.Context, id int64) (*MigrationJob, error)
	ListMigrationJobs(ctx context.Context, userID *int64, limit int) ([]*MigrationJob, error)
	UpdateMigrationJob(ctx context.Context, job *MigrationJob) error

	// Tickets
	CreateTicket(ctx context.Context, ticket *Ticket) error
	GetTicketByID(ctx context.Context, id int64) (*Ticket, error)
	ListTickets(ctx context.Context, filter *TicketFilter) ([]*Ticket, error)
	UpdateTicket(ctx context.Context, ticket *Ticket) error
	CreateTicketMessage(ctx context.Context, message *TicketMessage) error
	ListTicketMessages(ctx context.Context, ticketID int64, includeInternal bool) ([]*TicketMessage, error)

	// 订阅与兑换
	CreateSubscriptionPlan(ctx context.Context, plan *SubscriptionPlan) error
	UpdateSubscriptionPlan(ctx context.Context, plan *SubscriptionPlan) error
	GetSubscriptionPlanByID(ctx context.Context, id int64) (*SubscriptionPlan, error)
	ListSubscriptionPlans(ctx context.Context, includeDisabled bool) ([]*SubscriptionPlan, error)
	CreateResourcePackCode(ctx context.Context, code *ResourcePackCode) error
	GetResourcePackCodeByCode(ctx context.Context, code string) (*ResourcePackCode, error)
	ListResourcePackCodes(ctx context.Context, limit int) ([]*ResourcePackCode, error)
	UpdateResourcePackCode(ctx context.Context, code *ResourcePackCode) error
	CreateUserSubscription(ctx context.Context, subscription *UserSubscription) error
	ListUserSubscriptions(ctx context.Context, userID int64) ([]*UserSubscription, error)
	GetUserSubscriptionProfile(ctx context.Context, userID int64) (*SubscriptionProfile, error)

	// Object 操作
	CreateObject(ctx context.Context, obj *Object) error
	GetObject(ctx context.Context, bucketID int64, key string) (*Object, error)
	ListObjects(ctx context.Context, bucketID int64, opts ListObjectsOptions) (*ListObjectsResult, error)
	UpdateObject(ctx context.Context, obj *Object) error
	DeleteObject(ctx context.Context, bucketID int64, key string) error
	DeleteObjectsByBucketID(ctx context.Context, bucketID int64) error
	GetBucketStats(ctx context.Context, bucketID int64) (objectCount int64, totalSize int64, err error)
	GetUserResourceUsage(ctx context.Context, ownerID int64) (objectCount int64, totalSize int64, usedTraffic int64, err error)

	// MultipartUpload 操作
	CreateMultipartUpload(ctx context.Context, upload *MultipartUpload) error
	GetMultipartUpload(ctx context.Context, uploadID string) (*MultipartUpload, error)
	ListMultipartUploads(ctx context.Context, bucketID int64) ([]MultipartUpload, error)
	DeleteMultipartUpload(ctx context.Context, uploadID string) error

	// UploadPart 操作
	CreateUploadPart(ctx context.Context, part *UploadPart) error
	GetUploadParts(ctx context.Context, uploadID string) ([]UploadPart, error)
	DeleteUploadParts(ctx context.Context, uploadID string) error

	// 事务
	BeginTx(ctx context.Context) (Repository, error)
	Commit() error
	Rollback() error

	// 关闭连接
	Close() error
}
