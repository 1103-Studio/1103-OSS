package storage

import (
	"context"
	"io"
	"time"
)

// ObjectInfo 对象元信息
type ObjectInfo struct {
	Key          string
	Size         int64
	ETag         string
	ContentType  string
	StorageClass string
	StoragePath  string
	Metadata     map[string]string
	LastModified time.Time
}

// ListOptions 列表查询选项
type ListOptions struct {
	Prefix       string
	Delimiter    string
	Marker       string
	MaxKeys      int
	ContinuationToken string
}

// ListResult 列表查询结果
type ListResult struct {
	Objects        []ObjectInfo
	CommonPrefixes []string
	IsTruncated    bool
	NextMarker     string
	NextContinuationToken string
}

// Engine 存储引擎接口
type Engine interface {
	// Put 上传对象
	Put(ctx context.Context, bucket, key string, reader io.Reader, size int64, contentType string) (*ObjectInfo, error)

	// Get 获取对象
	Get(ctx context.Context, bucket, key string) (io.ReadCloser, *ObjectInfo, error)

	// GetRange 范围获取对象
	GetRange(ctx context.Context, bucket, key string, start, end int64) (io.ReadCloser, *ObjectInfo, error)

	// Delete 删除对象
	Delete(ctx context.Context, bucket, key string) error

	// Stat 获取对象信息
	Stat(ctx context.Context, bucket, key string) (*ObjectInfo, error)

	// Exists 检查对象是否存在
	Exists(ctx context.Context, bucket, key string) (bool, error)

	// Copy 复制对象
	Copy(ctx context.Context, srcBucket, srcKey, dstBucket, dstKey string) (*ObjectInfo, error)

	// CreateBucket 创建 Bucket 目录
	CreateBucket(ctx context.Context, bucket string) error

	// DeleteBucket 删除 Bucket 目录
	DeleteBucket(ctx context.Context, bucket string) error

	// BucketExists 检查 Bucket 是否存在
	BucketExists(ctx context.Context, bucket string) (bool, error)

	// InitMultipartUpload 初始化分片上传
	InitMultipartUpload(ctx context.Context, bucket, key, uploadID string) error

	// PutPart 上传分片
	PutPart(ctx context.Context, bucket, key, uploadID string, partNumber int, reader io.Reader, size int64) (string, error)

	// CompleteParts 合并分片
	CompleteParts(ctx context.Context, bucket, key, uploadID string, parts []PartInfo) (*ObjectInfo, error)

	// AbortMultipartUpload 取消分片上传
	AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error
}

// PartInfo 分片信息
type PartInfo struct {
	PartNumber int
	ETag       string
	Size       int64
}
