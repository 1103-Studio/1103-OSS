package response

import (
	"encoding/xml"
	"time"
)

// S3 XML 响应结构

// ListAllMyBucketsResult 列出所有 Bucket 响应
type ListAllMyBucketsResult struct {
	XMLName xml.Name `xml:"ListAllMyBucketsResult"`
	Xmlns   string   `xml:"xmlns,attr"`
	Owner   Owner    `xml:"Owner"`
	Buckets Buckets  `xml:"Buckets"`
}

type Owner struct {
	ID          string `xml:"ID"`
	DisplayName string `xml:"DisplayName"`
}

type Buckets struct {
	Bucket []BucketInfo `xml:"Bucket"`
}

type BucketInfo struct {
	Name         string `xml:"Name"`
	CreationDate string `xml:"CreationDate"`
}

// ListBucketResult 列出 Bucket 内容响应
type ListBucketResult struct {
	XMLName        xml.Name       `xml:"ListBucketResult"`
	Xmlns          string         `xml:"xmlns,attr"`
	Name           string         `xml:"Name"`
	Prefix         string         `xml:"Prefix"`
	Marker         string         `xml:"Marker,omitempty"`
	MaxKeys        int            `xml:"MaxKeys"`
	Delimiter      string         `xml:"Delimiter,omitempty"`
	IsTruncated    bool           `xml:"IsTruncated"`
	Contents       []ObjectInfo   `xml:"Contents"`
	CommonPrefixes []CommonPrefix `xml:"CommonPrefixes,omitempty"`
	NextMarker     string         `xml:"NextMarker,omitempty"`
}

type ObjectInfo struct {
	Key          string `xml:"Key"`
	LastModified string `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int64  `xml:"Size"`
	StorageClass string `xml:"StorageClass"`
	Owner        *Owner `xml:"Owner,omitempty"`
}

type CommonPrefix struct {
	Prefix string `xml:"Prefix"`
}

// ListBucketResultV2 ListObjectsV2 响应
type ListBucketResultV2 struct {
	XMLName               xml.Name       `xml:"ListBucketResult"`
	Xmlns                 string         `xml:"xmlns,attr"`
	Name                  string         `xml:"Name"`
	Prefix                string         `xml:"Prefix"`
	StartAfter            string         `xml:"StartAfter,omitempty"`
	ContinuationToken     string         `xml:"ContinuationToken,omitempty"`
	NextContinuationToken string         `xml:"NextContinuationToken,omitempty"`
	KeyCount              int            `xml:"KeyCount"`
	MaxKeys               int            `xml:"MaxKeys"`
	Delimiter             string         `xml:"Delimiter,omitempty"`
	IsTruncated           bool           `xml:"IsTruncated"`
	Contents              []ObjectInfo   `xml:"Contents"`
	CommonPrefixes        []CommonPrefix `xml:"CommonPrefixes,omitempty"`
}

// CopyObjectResult 复制对象响应
type CopyObjectResult struct {
	XMLName      xml.Name `xml:"CopyObjectResult"`
	LastModified string   `xml:"LastModified"`
	ETag         string   `xml:"ETag"`
}

// InitiateMultipartUploadResult 初始化分片上传响应
type InitiateMultipartUploadResult struct {
	XMLName  xml.Name `xml:"InitiateMultipartUploadResult"`
	Xmlns    string   `xml:"xmlns,attr"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	UploadId string   `xml:"UploadId"`
}

// CompleteMultipartUploadResult 完成分片上传响应
type CompleteMultipartUploadResult struct {
	XMLName  xml.Name `xml:"CompleteMultipartUploadResult"`
	Xmlns    string   `xml:"xmlns,attr"`
	Location string   `xml:"Location"`
	Bucket   string   `xml:"Bucket"`
	Key      string   `xml:"Key"`
	ETag     string   `xml:"ETag"`
}

// ListPartsResult 列出分片响应
type ListPartsResult struct {
	XMLName              xml.Name   `xml:"ListPartsResult"`
	Xmlns                string     `xml:"xmlns,attr"`
	Bucket               string     `xml:"Bucket"`
	Key                  string     `xml:"Key"`
	UploadId             string     `xml:"UploadId"`
	PartNumberMarker     int        `xml:"PartNumberMarker"`
	NextPartNumberMarker int        `xml:"NextPartNumberMarker"`
	MaxParts             int        `xml:"MaxParts"`
	IsTruncated          bool       `xml:"IsTruncated"`
	Parts                []PartInfo `xml:"Part"`
}

type PartInfo struct {
	PartNumber   int    `xml:"PartNumber"`
	LastModified string `xml:"LastModified"`
	ETag         string `xml:"ETag"`
	Size         int64  `xml:"Size"`
}

// ListMultipartUploadsResult 列出分片上传响应
type ListMultipartUploadsResult struct {
	XMLName    xml.Name     `xml:"ListMultipartUploadsResult"`
	Xmlns      string       `xml:"xmlns,attr"`
	Bucket     string       `xml:"Bucket"`
	KeyMarker  string       `xml:"KeyMarker"`
	MaxUploads int          `xml:"MaxUploads"`
	Uploads    []UploadInfo `xml:"Upload"`
}

type UploadInfo struct {
	Key       string `xml:"Key"`
	UploadId  string `xml:"UploadId"`
	Initiated string `xml:"Initiated"`
}

// CompleteMultipartUpload 完成分片上传请求
type CompleteMultipartUpload struct {
	XMLName xml.Name           `xml:"CompleteMultipartUpload"`
	Parts   []CompletedPartInfo `xml:"Part"`
}

type CompletedPartInfo struct {
	PartNumber int    `xml:"PartNumber"`
	ETag       string `xml:"ETag"`
}

// Error S3 错误响应
type Error struct {
	XMLName   xml.Name `xml:"Error"`
	Code      string   `xml:"Code"`
	Message   string   `xml:"Message"`
	Resource  string   `xml:"Resource,omitempty"`
	RequestId string   `xml:"RequestId,omitempty"`
}

// S3 错误码
const (
	ErrAccessDenied             = "AccessDenied"
	ErrBucketAlreadyExists      = "BucketAlreadyExists"
	ErrBucketAlreadyOwnedByYou  = "BucketAlreadyOwnedByYou"
	ErrBucketNotEmpty           = "BucketNotEmpty"
	ErrInternalError            = "InternalError"
	ErrInvalidAccessKeyId       = "InvalidAccessKeyId"
	ErrInvalidArgument          = "InvalidArgument"
	ErrInvalidBucketName        = "InvalidBucketName"
	ErrInvalidPart              = "InvalidPart"
	ErrInvalidPartOrder         = "InvalidPartOrder"
	ErrInvalidRequest           = "InvalidRequest"
	ErrMalformedXML             = "MalformedXML"
	ErrMalformedPolicy          = "MalformedPolicy"
	ErrMalformedPOSTRequest     = "MalformedPOSTRequest"
	ErrNoSuchBucket             = "NoSuchBucket"
	ErrNoSuchKey                = "NoSuchKey"
	ErrNoSuchBucketPolicy       = "NoSuchBucketPolicy"
	ErrNoSuchUpload             = "NoSuchUpload"
	ErrSignatureDoesNotMatch    = "SignatureDoesNotMatch"
	ErrEntityTooLarge           = "EntityTooLarge"
	ErrEntityTooSmall           = "EntityTooSmall"
)

// NewError 创建错误响应
func NewError(code, message, resource string) *Error {
	return &Error{
		Code:     code,
		Message:  message,
		Resource: resource,
	}
}

// FormatTime 格式化时间为 S3 格式
func FormatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

// S3Xmlns S3 XML 命名空间
const S3Xmlns = "http://s3.amazonaws.com/doc/2006-03-01/"
