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
	Email        string
	Status       string
	IsAdmin      bool
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

// Bucket 存储桶
type Bucket struct {
	ID         int64
	Name       string
	OwnerID    int64
	Region     string
	ACL        string
	Versioning bool
	CreatedAt  time.Time
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

	// Credential 操作
	CreateCredential(ctx context.Context, cred *Credential) error
	GetCredentialByAccessKey(ctx context.Context, accessKey string) (*Credential, error)
	GetCredentialsByUserID(ctx context.Context, userID int64) ([]Credential, error)
	DeleteCredential(ctx context.Context, id int64) error

	// Bucket 操作
	CreateBucket(ctx context.Context, bucket *Bucket) error
	GetBucketByName(ctx context.Context, name string) (*Bucket, error)
	GetBucketByID(ctx context.Context, id int64) (*Bucket, error)
	ListBuckets(ctx context.Context, ownerID int64) ([]Bucket, error)
	ListAllBuckets(ctx context.Context) ([]Bucket, error)
	UpdateBucket(ctx context.Context, bucket *Bucket) error
	DeleteBucket(ctx context.Context, id int64) error

	// Object 操作
	CreateObject(ctx context.Context, obj *Object) error
	GetObject(ctx context.Context, bucketID int64, key string) (*Object, error)
	ListObjects(ctx context.Context, bucketID int64, opts ListObjectsOptions) (*ListObjectsResult, error)
	UpdateObject(ctx context.Context, obj *Object) error
	DeleteObject(ctx context.Context, bucketID int64, key string) error
	DeleteObjectsByBucketID(ctx context.Context, bucketID int64) error
	GetBucketStats(ctx context.Context, bucketID int64) (objectCount int64, totalSize int64, err error)

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
