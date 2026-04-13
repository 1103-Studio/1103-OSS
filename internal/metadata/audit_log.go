package metadata

import "time"

// AuditLog 操作日志
type AuditLog struct {
	ID           int64     `json:"id"`
	UserID       *int64    `json:"user_id,omitempty"`
	Username     string    `json:"username"`
	Action       string    `json:"action"`
	ResourceType string    `json:"resource_type"`
	ResourceName string    `json:"resource_name,omitempty"`
	BucketName   string    `json:"bucket_name,omitempty"`
	ObjectKey    string    `json:"object_key,omitempty"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent,omitempty"`
	StatusCode   int       `json:"status_code"`
	ErrorMessage string    `json:"error_message,omitempty"`
	Metadata     []byte    `json:"metadata,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// Action types
const (
	ActionCreateBucket       = "CREATE_BUCKET"
	ActionDeleteBucket       = "DELETE_BUCKET"
	ActionUploadObject       = "UPLOAD_OBJECT"
	ActionDeleteObject       = "DELETE_OBJECT"
	ActionCompleteMultipart  = "COMPLETE_MULTIPART"
	ActionCreateUser         = "CREATE_USER"
	ActionDeleteUser         = "DELETE_USER"
	ActionUpdateUser         = "UPDATE_USER"
	ActionCreateRole         = "CREATE_ROLE"
	ActionUpdateRole         = "UPDATE_ROLE"
	ActionDeleteRole         = "DELETE_ROLE"
	ActionCreateCredential   = "CREATE_CREDENTIAL"
	ActionUpdateCredential   = "UPDATE_CREDENTIAL"
	ActionDeleteCredential   = "DELETE_CREDENTIAL"
	ActionUpdateBucket       = "UPDATE_BUCKET"
	ActionUpdateBucketAccess = "UPDATE_BUCKET_ACCESS"
	ActionDeleteBucketAccess = "DELETE_BUCKET_ACCESS"
	ActionCreateTicket       = "CREATE_TICKET"
	ActionUpdateTicket       = "UPDATE_TICKET"
	ActionCreateTicketReply  = "CREATE_TICKET_REPLY"
	ActionSetBucketPolicy    = "SET_BUCKET_POLICY"
	ActionDeleteBucketPolicy = "DELETE_BUCKET_POLICY"
	ActionLogin              = "LOGIN"
	ActionLogout             = "LOGOUT"
)

// Resource types
const (
	ResourceTypeBucket     = "BUCKET"
	ResourceTypeObject     = "OBJECT"
	ResourceTypeUser       = "USER"
	ResourceTypeRole       = "ROLE"
	ResourceTypeCredential = "CREDENTIAL"
	ResourceTypePolicy     = "POLICY"
	ResourceTypeTicket     = "TICKET"
	ResourceTypeBucketAccess = "BUCKET_ACCESS"
)

// AuditLogFilter 日志查询过滤器
type AuditLogFilter struct {
	UserID       *int64
	Action       string
	ResourceType string
	BucketName   string
	StartTime    *time.Time
	EndTime      *time.Time
	Limit        int
	Offset       int
}
