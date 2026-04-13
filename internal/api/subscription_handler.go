package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
	"github.com/jackc/pgx/v5/pgconn"
)

type subscriptionPlanResponse struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Code         string    `json:"code"`
	Description  string    `json:"description"`
	StorageBytes int64     `json:"storageBytes"`
	TrafficBytes int64     `json:"trafficBytes"`
	ObjectQuota  int64     `json:"objectQuota"`
	DurationDays int       `json:"durationDays"`
	PriceCents   int64     `json:"priceCents"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type resourcePackCodeResponse struct {
	ID               int64      `json:"id"`
	PlanID           int64      `json:"planId"`
	Code             string     `json:"code"`
	Label            string     `json:"label"`
	StorageBytes     int64      `json:"storageBytes"`
	TrafficBytes     int64      `json:"trafficBytes"`
	ObjectQuota      int64      `json:"objectQuota"`
	DurationDays     int        `json:"durationDays"`
	Status           string     `json:"status"`
	RedeemedByUserID *int64     `json:"redeemedByUserId,omitempty"`
	RedeemedAt       *time.Time `json:"redeemedAt,omitempty"`
	ExpiresAt        *time.Time `json:"expiresAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

type userSubscriptionResponse struct {
	ID             int64      `json:"id"`
	UserID         int64      `json:"userId"`
	PlanID         *int64     `json:"planId,omitempty"`
	ResourceCodeID *int64     `json:"resourceCodeId,omitempty"`
	Source         string     `json:"source"`
	Status         string     `json:"status"`
	StorageBytes   int64      `json:"storageBytes"`
	TrafficBytes   int64      `json:"trafficBytes"`
	ObjectQuota    int64      `json:"objectQuota"`
	StartedAt      time.Time  `json:"startedAt"`
	ExpiresAt      *time.Time `json:"expiresAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type subscriptionProfileResponse struct {
	ActivePlans       []userSubscriptionResponse `json:"activePlans"`
	TotalStorageBytes int64                      `json:"totalStorageBytes"`
	TotalTrafficBytes int64                      `json:"totalTrafficBytes"`
	TotalObjectQuota  int64                      `json:"totalObjectQuota"`
	ExpiresAt         *time.Time                 `json:"expiresAt,omitempty"`
}

type subscriptionPlanRequest struct {
	Name         string `json:"name" binding:"required"`
	Code         string `json:"code" binding:"required"`
	Description  string `json:"description"`
	StorageBytes int64  `json:"storageBytes"`
	TrafficBytes int64  `json:"trafficBytes"`
	ObjectQuota  int64  `json:"objectQuota"`
	DurationDays int    `json:"durationDays"`
	PriceCents   int64  `json:"priceCents"`
	Status       string `json:"status"`
}

type resourcePackCodeRequest struct {
	PlanID       *int64  `json:"planId"`
	Label        string  `json:"label"`
	Code         string  `json:"code"`
	StorageBytes *int64  `json:"storageBytes"`
	TrafficBytes *int64  `json:"trafficBytes"`
	ObjectQuota  *int64  `json:"objectQuota"`
	DurationDays *int    `json:"durationDays"`
	ExpiresAt    *string `json:"expiresAt"`
	Quantity     int     `json:"quantity"`
}

type redeemCodeRequest struct {
	Code string `json:"code" binding:"required"`
}

func normalizePlanStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "", "active":
		return "active"
	case "disabled":
		return "disabled"
	default:
		return ""
	}
}

func sanitizeSubscriptionPlan(plan *metadata.SubscriptionPlan) subscriptionPlanResponse {
	return subscriptionPlanResponse{
		ID:           plan.ID,
		Name:         plan.Name,
		Code:         plan.Code,
		Description:  plan.Description,
		StorageBytes: plan.StorageBytes,
		TrafficBytes: plan.TrafficBytes,
		ObjectQuota:  plan.ObjectQuota,
		DurationDays: plan.DurationDays,
		PriceCents:   plan.PriceCents,
		Status:       plan.Status,
		CreatedAt:    plan.CreatedAt,
		UpdatedAt:    plan.UpdatedAt,
	}
}

func sanitizeResourcePackCode(code *metadata.ResourcePackCode) resourcePackCodeResponse {
	return resourcePackCodeResponse{
		ID:               code.ID,
		PlanID:           code.PlanID,
		Code:             code.Code,
		Label:            code.Label,
		StorageBytes:     code.StorageBytes,
		TrafficBytes:     code.TrafficBytes,
		ObjectQuota:      code.ObjectQuota,
		DurationDays:     code.DurationDays,
		Status:           code.Status,
		RedeemedByUserID: code.RedeemedByUserID,
		RedeemedAt:       code.RedeemedAt,
		ExpiresAt:        code.ExpiresAt,
		CreatedAt:        code.CreatedAt,
		UpdatedAt:        code.UpdatedAt,
	}
}

func sanitizeUserSubscription(item metadata.UserSubscription) userSubscriptionResponse {
	return userSubscriptionResponse{
		ID:             item.ID,
		UserID:         item.UserID,
		PlanID:         item.PlanID,
		ResourceCodeID: item.ResourceCodeID,
		Source:         item.Source,
		Status:         item.Status,
		StorageBytes:   item.StorageBytes,
		TrafficBytes:   item.TrafficBytes,
		ObjectQuota:    item.ObjectQuota,
		StartedAt:      item.StartedAt,
		ExpiresAt:      item.ExpiresAt,
		CreatedAt:      item.CreatedAt,
		UpdatedAt:      item.UpdatedAt,
	}
}

func sanitizeSubscriptionProfile(profile *metadata.SubscriptionProfile) subscriptionProfileResponse {
	items := make([]userSubscriptionResponse, 0, len(profile.ActivePlans))
	for _, item := range profile.ActivePlans {
		items = append(items, sanitizeUserSubscription(item))
	}
	return subscriptionProfileResponse{
		ActivePlans:       items,
		TotalStorageBytes: profile.TotalStorageBytes,
		TotalTrafficBytes: profile.TotalTrafficBytes,
		TotalObjectQuota:  profile.TotalObjectQuota,
		ExpiresAt:         profile.ExpiresAt,
	}
}

func validateQuotaValues(storageBytes, trafficBytes, objectQuota int64, durationDays int) error {
	if storageBytes < 0 || trafficBytes < 0 || objectQuota < 0 {
		return errors.New("资源额度不能为负数")
	}
	if durationDays <= 0 {
		return errors.New("有效期天数必须大于 0")
	}
	return nil
}

func randomCodeSuffix() (string, error) {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return strings.ToUpper(hex.EncodeToString(buf)), nil
}

func createSubscriptionFromCode(ctx context.Context, repo metadata.Repository, userID int64, item *metadata.ResourcePackCode) (*metadata.UserSubscription, error) {
	startedAt := time.Now()
	expiresAt := startedAt.Add(time.Duration(item.DurationDays) * 24 * time.Hour)
	subscription := &metadata.UserSubscription{
		UserID:       userID,
		Source:       "redeem_code",
		Status:       "active",
		StorageBytes: item.StorageBytes,
		TrafficBytes: item.TrafficBytes,
		ObjectQuota:  item.ObjectQuota,
		StartedAt:    startedAt,
		ExpiresAt:    &expiresAt,
	}
	if item.PlanID > 0 {
		subscription.PlanID = &item.PlanID
	}
	subscription.ResourceCodeID = &item.ID
	if err := repo.CreateUserSubscription(ctx, subscription); err != nil {
		return nil, err
	}
	return subscription, nil
}

func (s *Server) ListSubscriptionPlans(c *gin.Context) {
	plans, err := s.repo.ListSubscriptionPlans(c.Request.Context(), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list subscription plans"})
		return
	}
	items := make([]subscriptionPlanResponse, 0, len(plans))
	for _, plan := range plans {
		if plan == nil {
			continue
		}
		items = append(items, sanitizeSubscriptionPlan(plan))
	}
	c.JSON(http.StatusOK, gin.H{"plans": items})
}

func (s *Server) ListActiveSubscriptionPlans(c *gin.Context) {
	plans, err := s.repo.ListSubscriptionPlans(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list subscription plans"})
		return
	}
	items := make([]subscriptionPlanResponse, 0, len(plans))
	for _, plan := range plans {
		if plan == nil {
			continue
		}
		items = append(items, sanitizeSubscriptionPlan(plan))
	}
	c.JSON(http.StatusOK, gin.H{"plans": items})
}

func (s *Server) CreateSubscriptionPlan(c *gin.Context) {
	var req subscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	status := normalizePlanStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}
	if err := validateQuotaValues(req.StorageBytes, req.TrafficBytes, req.ObjectQuota, req.DurationDays); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plan := &metadata.SubscriptionPlan{
		Name:         strings.TrimSpace(req.Name),
		Code:         strings.ToUpper(strings.TrimSpace(req.Code)),
		Description:  strings.TrimSpace(req.Description),
		StorageBytes: req.StorageBytes,
		TrafficBytes: req.TrafficBytes,
		ObjectQuota:  req.ObjectQuota,
		DurationDays: req.DurationDays,
		PriceCents:   req.PriceCents,
		Status:       status,
	}
	if plan.Name == "" || plan.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name and code are required"})
		return
	}
	if err := s.repo.CreateSubscriptionPlan(c.Request.Context(), plan); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "Plan code already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription plan"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"plan": sanitizeSubscriptionPlan(plan)})
}

func (s *Server) UpdateSubscriptionPlan(c *gin.Context) {
	planID := parseInt64(c.Param("id"))
	plan, err := s.repo.GetSubscriptionPlanByID(c.Request.Context(), planID)
	if err != nil || plan == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subscription plan not found"})
		return
	}

	var req subscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	status := normalizePlanStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
		return
	}
	if err := validateQuotaValues(req.StorageBytes, req.TrafficBytes, req.ObjectQuota, req.DurationDays); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plan.Name = strings.TrimSpace(req.Name)
	plan.Code = strings.ToUpper(strings.TrimSpace(req.Code))
	plan.Description = strings.TrimSpace(req.Description)
	plan.StorageBytes = req.StorageBytes
	plan.TrafficBytes = req.TrafficBytes
	plan.ObjectQuota = req.ObjectQuota
	plan.DurationDays = req.DurationDays
	plan.PriceCents = req.PriceCents
	plan.Status = status

	if plan.Name == "" || plan.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name and code are required"})
		return
	}
	if err := s.repo.UpdateSubscriptionPlan(c.Request.Context(), plan); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "Plan code already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription plan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"plan": sanitizeSubscriptionPlan(plan)})
}

func (s *Server) ListResourcePackCodes(c *gin.Context) {
	items, err := s.repo.ListResourcePackCodes(c.Request.Context(), parseInt(c.DefaultQuery("limit", "100")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list resource pack codes"})
		return
	}
	result := make([]resourcePackCodeResponse, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		result = append(result, sanitizeResourcePackCode(item))
	}
	c.JSON(http.StatusOK, gin.H{"codes": result})
}

func (s *Server) CreateResourcePackCode(c *gin.Context) {
	var req resourcePackCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	quantity := req.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	if quantity > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "一次最多生成 100 个兑换码"})
		return
	}

	var basePlan *metadata.SubscriptionPlan
	if req.PlanID != nil && *req.PlanID > 0 {
		basePlan, _ = s.repo.GetSubscriptionPlanByID(c.Request.Context(), *req.PlanID)
		if basePlan == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Subscription plan not found"})
			return
		}
	}

	storageBytes := int64(0)
	trafficBytes := int64(0)
	objectQuota := int64(0)
	durationDays := 30
	if basePlan != nil {
		storageBytes = basePlan.StorageBytes
		trafficBytes = basePlan.TrafficBytes
		objectQuota = basePlan.ObjectQuota
		durationDays = basePlan.DurationDays
	}
	if req.StorageBytes != nil {
		storageBytes = *req.StorageBytes
	}
	if req.TrafficBytes != nil {
		trafficBytes = *req.TrafficBytes
	}
	if req.ObjectQuota != nil {
		objectQuota = *req.ObjectQuota
	}
	if req.DurationDays != nil {
		durationDays = *req.DurationDays
	}
	if err := validateQuotaValues(storageBytes, trafficBytes, objectQuota, durationDays); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && strings.TrimSpace(*req.ExpiresAt) != "" {
		value, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.ExpiresAt))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "expiresAt 必须是 RFC3339 时间"})
			return
		}
		expiresAt = &value
	}

	codes := make([]resourcePackCodeResponse, 0, quantity)
	for i := 0; i < quantity; i++ {
		finalCode := strings.ToUpper(strings.TrimSpace(req.Code))
		if finalCode == "" || quantity > 1 {
			suffix, err := randomCodeSuffix()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate redeem code"})
				return
			}
			prefix := "MAXIO"
			if basePlan != nil && basePlan.Code != "" {
				prefix = basePlan.Code
			}
			finalCode = strings.ToUpper(prefix) + "-" + suffix
		}

		item := &metadata.ResourcePackCode{
			Label:        strings.TrimSpace(req.Label),
			Code:         finalCode,
			StorageBytes: storageBytes,
			TrafficBytes: trafficBytes,
			ObjectQuota:  objectQuota,
			DurationDays: durationDays,
			Status:       "active",
			ExpiresAt:    expiresAt,
		}
		if basePlan != nil {
			item.PlanID = basePlan.ID
		}
		if err := s.repo.CreateResourcePackCode(c.Request.Context(), item); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				i--
				continue
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create redeem code"})
			return
		}
		codes = append(codes, sanitizeResourcePackCode(item))
	}

	c.JSON(http.StatusCreated, gin.H{"codes": codes})
}

func (s *Server) GetMySubscriptionProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	profile, err := s.repo.GetUserSubscriptionProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"profile": sanitizeSubscriptionProfile(&metadata.SubscriptionProfile{
			ActivePlans: make([]metadata.UserSubscription, 0),
		})})
		return
	}
	if profile == nil {
		profile = &metadata.SubscriptionProfile{}
	}
	c.JSON(http.StatusOK, gin.H{"profile": sanitizeSubscriptionProfile(profile)})
}

func (s *Server) RedeemResourcePackCode(c *gin.Context) {
	var req redeemCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetInt64("user_id")
	codeText := strings.ToUpper(strings.TrimSpace(req.Code))
	if codeText == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "兑换码不能为空"})
		return
	}

	txRepo, err := s.repo.BeginTx(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start redeem transaction"})
		return
	}
	defer txRepo.Rollback()

	item, err := txRepo.GetResourcePackCodeByCode(c.Request.Context(), codeText)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load redeem code"})
		return
	}
	if item == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "兑换码不存在"})
		return
	}
	if item.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "兑换码不可用"})
		return
	}
	if item.RedeemedByUserID != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "兑换码已使用"})
		return
	}
	if item.ExpiresAt != nil && item.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "兑换码已过期"})
		return
	}

	subscription, err := createSubscriptionFromCode(c.Request.Context(), txRepo, userID, item)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply subscription"})
		return
	}
	now := time.Now()
	item.RedeemedByUserID = &userID
	item.RedeemedAt = &now
	item.Status = "redeemed"
	if err := txRepo.UpdateResourcePackCode(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update redeem code"})
		return
	}
	if err := txRepo.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit redeem operation"})
		return
	}

	profile, err := s.repo.GetUserSubscriptionProfile(context.Background(), userID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message":      "兑换成功",
			"subscription": sanitizeUserSubscription(*subscription),
			"code":         sanitizeResourcePackCode(item),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "兑换成功",
		"subscription": sanitizeUserSubscription(*subscription),
		"profile":      sanitizeSubscriptionProfile(profile),
		"code":         sanitizeResourcePackCode(item),
	})
}

func parseInt(value string) int {
	if value == "" {
		return 0
	}
	var parsed int
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return 0
		}
		parsed = parsed*10 + int(ch-'0')
	}
	return parsed
}
