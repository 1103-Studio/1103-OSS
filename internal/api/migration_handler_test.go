package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/gooss/server/internal/storage"
	"github.com/gooss/server/pkg/logger"
)

func TestNormalizeAndValidateSourceEndpoint(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name:  "public endpoint with implied http",
			input: "8.8.8.8",
			want:  "http://8.8.8.8",
		},
		{
			name:    "localhost rejected",
			input:   "http://localhost:9000",
			wantErr: true,
		},
		{
			name:    "private ipv4 rejected",
			input:   "http://192.168.1.10:9000",
			wantErr: true,
		},
		{
			name:    "credentials in url rejected",
			input:   "https://user:pass@example.com",
			wantErr: true,
		},
		{
			name:    "unsupported scheme rejected",
			input:   "ftp://example.com",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := normalizeAndValidateSourceEndpoint(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("unexpected normalized endpoint: got %q want %q", got, tt.want)
			}
		})
	}
}

func init() {
	gin.SetMode(gin.TestMode)
	_ = logger.Init("error", "console", "stdout", "")
}

func TestValidateMigrationSourceURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		rawURL  string
		wantErr bool
	}{
		{
			name:   "allow public url",
			rawURL: "https://8.8.8.8",
		},
		{
			name:    "reject local suffix",
			rawURL:  "https://minio.local",
			wantErr: true,
		},
		{
			name:    "reject loopback ipv6",
			rawURL:  "http://[::1]:9000",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			parsed, err := url.Parse(tt.rawURL)
			if err != nil {
				t.Fatalf("failed to parse test url: %v", err)
			}

			err = validateMigrationSourceURL(parsed)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestDialMigrationContextRejectsPrivateAddress(t *testing.T) {
	t.Parallel()

	_, err := dialMigrationContext(context.Background(), nil, "tcp", "127.0.0.1:9000")
	if err == nil {
		t.Fatalf("expected private address to be rejected")
	}
}

type migrationListRepoStub struct {
	metadata.Repository
	jobs []*metadata.MigrationJob
}

func (s *migrationListRepoStub) ListMigrationJobs(ctx context.Context, userID *int64, limit int) ([]*metadata.MigrationJob, error) {
	return s.jobs, nil
}

type migrationJobRepoStub struct {
	metadata.Repository
	job        *metadata.MigrationJob
	updatedJob *metadata.MigrationJob
}

func (s *migrationJobRepoStub) GetMigrationJob(ctx context.Context, id int64) (*metadata.MigrationJob, error) {
	if s.job == nil || s.job.ID != id {
		return nil, nil
	}
	copyJob := *s.job
	return &copyJob, nil
}

func (s *migrationJobRepoStub) UpdateMigrationJob(ctx context.Context, job *metadata.MigrationJob) error {
	copyJob := *job
	s.updatedJob = &copyJob
	return nil
}

func TestListMigrationJobsReturnsEmptyArray(t *testing.T) {
	t.Parallel()

	handler := &MigrationHandler{
		repo: &migrationListRepoStub{},
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodGet, "/admin/migration/jobs", nil)
	ctx.Request = req
	ctx.Set("user_id", int64(99))
	ctx.Set("is_admin", true)

	handler.ListMigrationJobs(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: got %d want %d", recorder.Code, http.StatusOK)
	}

	var payload struct {
		Jobs []metadata.MigrationJob `json:"jobs"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if payload.Jobs == nil {
		t.Fatalf("expected jobs to be an empty array, got nil")
	}
	if len(payload.Jobs) != 0 {
		t.Fatalf("expected no jobs, got %d", len(payload.Jobs))
	}
}

func TestCancelMigrationMarksQueuedJobCancelled(t *testing.T) {
	t.Parallel()

	repo := &migrationJobRepoStub{
		job: &metadata.MigrationJob{
			ID:     42,
			UserID: 7,
			Status: migrationStatusQueued,
		},
	}
	handler := &MigrationHandler{
		repo:  repo,
		tasks: make(map[int64]*migrationTask),
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/admin/migration/jobs/42/cancel", nil)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "42"}}
	ctx.Set("user_id", int64(7))
	ctx.Set("is_admin", false)

	handler.CancelMigration(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: got %d want %d", recorder.Code, http.StatusOK)
	}
	if repo.updatedJob == nil {
		t.Fatalf("expected job to be persisted")
	}
	if repo.updatedJob.Status != migrationStatusCancelled {
		t.Fatalf("expected status %q, got %q", migrationStatusCancelled, repo.updatedJob.Status)
	}
	if repo.updatedJob.CompletedAt == nil {
		t.Fatalf("expected completedAt to be set")
	}
}

func TestCancelMigrationRejectsFinishedJob(t *testing.T) {
	t.Parallel()

	repo := &migrationJobRepoStub{
		job: &metadata.MigrationJob{
			ID:     9,
			UserID: 3,
			Status: migrationStatusFailed,
		},
	}
	handler := &MigrationHandler{
		repo:  repo,
		tasks: make(map[int64]*migrationTask),
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/admin/migration/jobs/9/cancel", nil)
	ctx.Request = req
	ctx.Params = gin.Params{{Key: "id", Value: "9"}}
	ctx.Set("user_id", int64(3))
	ctx.Set("is_admin", true)

	handler.CancelMigration(ctx)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("unexpected status: got %d want %d", recorder.Code, http.StatusConflict)
	}
	if repo.updatedJob != nil {
		t.Fatalf("did not expect finished job to be updated")
	}
}

type migrationObjectRepoStub struct {
	metadata.Repository
	existing      *metadata.Object
	updatedObject *metadata.Object
	createdObject *metadata.Object
}

func (s *migrationObjectRepoStub) GetObject(ctx context.Context, bucketID int64, key string) (*metadata.Object, error) {
	if s.existing == nil {
		return nil, nil
	}
	copyObject := *s.existing
	return &copyObject, nil
}

func (s *migrationObjectRepoStub) UpdateObject(ctx context.Context, obj *metadata.Object) error {
	copyObject := *obj
	s.updatedObject = &copyObject
	return nil
}

func (s *migrationObjectRepoStub) CreateObject(ctx context.Context, obj *metadata.Object) error {
	copyObject := *obj
	s.createdObject = &copyObject
	return nil
}

type migrationStorageStub struct{}

func (migrationStorageStub) Put(ctx context.Context, bucket, key string, reader io.Reader, size int64, contentType string) (*storage.ObjectInfo, error) {
	return &storage.ObjectInfo{
		Key:         key,
		Size:        size,
		ETag:        "etag-new",
		ContentType: contentType,
		StoragePath: "/tmp/" + key,
	}, nil
}

func (migrationStorageStub) Get(ctx context.Context, bucket, key string) (io.ReadCloser, *storage.ObjectInfo, error) {
	return nil, nil, errors.New("not implemented")
}

func (migrationStorageStub) GetRange(ctx context.Context, bucket, key string, start, end int64) (io.ReadCloser, *storage.ObjectInfo, error) {
	return nil, nil, errors.New("not implemented")
}

func (migrationStorageStub) Delete(ctx context.Context, bucket, key string) error {
	return nil
}

func (migrationStorageStub) Stat(ctx context.Context, bucket, key string) (*storage.ObjectInfo, error) {
	return nil, errors.New("not implemented")
}

func (migrationStorageStub) Exists(ctx context.Context, bucket, key string) (bool, error) {
	return false, errors.New("not implemented")
}

func (migrationStorageStub) Copy(ctx context.Context, srcBucket, srcKey, dstBucket, dstKey string) (*storage.ObjectInfo, error) {
	return nil, errors.New("not implemented")
}

func (migrationStorageStub) CreateBucket(ctx context.Context, bucket string) error {
	return nil
}

func (migrationStorageStub) DeleteBucket(ctx context.Context, bucket string) error {
	return nil
}

func (migrationStorageStub) BucketExists(ctx context.Context, bucket string) (bool, error) {
	return false, nil
}

func (migrationStorageStub) InitMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	return errors.New("not implemented")
}

func (migrationStorageStub) PutPart(ctx context.Context, bucket, key, uploadID string, partNumber int, reader io.Reader, size int64) (string, error) {
	return "", errors.New("not implemented")
}

func (migrationStorageStub) CompleteParts(ctx context.Context, bucket, key, uploadID string, parts []storage.PartInfo) (*storage.ObjectInfo, error) {
	return nil, errors.New("not implemented")
}

func (migrationStorageStub) AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	return errors.New("not implemented")
}

func TestMigrateObjectUpdatesExistingMetadata(t *testing.T) {
	t.Parallel()

	repo := &migrationObjectRepoStub{
		existing: &metadata.Object{
			ID:       99,
			BucketID: 77,
			Key:      "demo.txt",
		},
	}

	handler := &MigrationHandler{
		storage: migrationStorageStub{},
		repo:    repo,
	}

	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader("payload")),
				Header: http.Header{
					"Content-Type": []string{"text/plain"},
				},
			}, nil
		}),
	}

	err := handler.migrateObject(
		context.Background(),
		httpClient,
		"https://example.com",
		"access",
		"secret",
		"",
		"bucket-a",
		77,
		ObjectInfo{Key: "demo.txt", Size: 7, ContentType: "text/plain"},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.updatedObject == nil {
		t.Fatalf("expected existing object metadata to be updated")
	}
	if repo.createdObject != nil {
		t.Fatalf("did not expect create path for existing object")
	}
	if repo.updatedObject.ID != 99 {
		t.Fatalf("expected updated object id 99, got %d", repo.updatedObject.ID)
	}
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
