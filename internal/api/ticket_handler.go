package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
)

var allowedTicketStatus = map[string]struct{}{
	"open":     {},
	"pending":  {},
	"resolved": {},
	"closed":   {},
}

var allowedTicketPriority = map[string]struct{}{
	"low":    {},
	"medium": {},
	"high":   {},
	"urgent": {},
}

var allowedTicketCategory = map[string]struct{}{
	"general":  {},
	"billing":  {},
	"bucket":   {},
	"access":   {},
	"security": {},
}

type CreateTicketRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Category    string `json:"category"`
	Priority    string `json:"priority"`
	BucketID    *int64 `json:"bucketId"`
}

func (s *Server) ListTickets(c *gin.Context) {
	if !hasPermission(c, PermTicketRead) && !hasPermission(c, PermTicketManage) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermTicketRead, PermTicketManage}})
		return
	}

	status := c.Query("status")
	category := c.Query("category")
	priority := c.Query("priority")
	if status != "" {
		if _, ok := allowedTicketStatus[status]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
			return
		}
	}
	if category != "" {
		if _, ok := allowedTicketCategory[category]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
			return
		}
	}
	if priority != "" {
		if _, ok := allowedTicketPriority[priority]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority"})
			return
		}
	}

	userID := c.GetInt64("user_id")
	filter := &metadata.TicketFilter{
		RequesterID: &userID,
		Status:      status,
		Category:    category,
		Priority:    priority,
		Limit:       100,
		IncludeAll:  c.GetBool("is_admin") || hasPermission(c, PermTicketManage),
	}
	tickets, err := s.repo.ListTickets(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list tickets"})
		return
	}
	c.JSON(http.StatusOK, tickets)
}

func (s *Server) CreateTicket(c *gin.Context) {
	if !hasPermission(c, PermTicketCreate) && !hasPermission(c, PermTicketManage) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermTicketCreate, PermTicketManage}})
		return
	}

	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	if req.Title == "" || req.Description == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title and description are required"})
		return
	}
	if _, ok := allowedTicketCategory[valueOrDefault(req.Category, "general")]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
		return
	}
	if _, ok := allowedTicketPriority[valueOrDefault(req.Priority, "medium")]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority"})
		return
	}
	if req.BucketID != nil {
		bucket, err := s.repo.GetBucketByID(c.Request.Context(), *req.BucketID)
		if err != nil || bucket == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bucket not found"})
			return
		}
		if !canAccessTicketBucket(c, s.repo, bucket) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	}
	ticket := &metadata.Ticket{
		RequesterID: c.GetInt64("user_id"),
		Title:       req.Title,
		Description: req.Description,
		Category:    valueOrDefault(req.Category, "general"),
		Priority:    valueOrDefault(req.Priority, "medium"),
		Status:      "open",
		BucketID:    req.BucketID,
	}
	if err := s.repo.CreateTicket(c.Request.Context(), ticket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket"})
		return
	}
	created, _ := s.repo.GetTicketByID(c.Request.Context(), ticket.ID)
	c.JSON(http.StatusCreated, created)
}

func (s *Server) GetTicket(c *gin.Context) {
	if !hasPermission(c, PermTicketRead) && !hasPermission(c, PermTicketManage) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermTicketRead, PermTicketManage}})
		return
	}

	ticketID := parseInt64(c.Param("id"))
	ticket, err := s.repo.GetTicketByID(c.Request.Context(), ticketID)
	if err != nil || ticket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}
	userID := c.GetInt64("user_id")
	if !c.GetBool("is_admin") && !hasPermission(c, PermTicketManage) && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	messages, err := s.repo.ListTicketMessages(c.Request.Context(), ticket.ID, c.GetBool("is_admin") || hasPermission(c, PermTicketManage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load ticket messages"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ticket": ticket, "messages": messages})
}

type UpdateTicketRequest struct {
	Status      *string `json:"status,omitempty"`
	Priority    *string `json:"priority,omitempty"`
	Category    *string `json:"category,omitempty"`
	AssigneeID  *int64  `json:"assigneeId,omitempty"`
	Description *string `json:"description,omitempty"`
}

func (s *Server) UpdateTicket(c *gin.Context) {
	if !hasPermission(c, PermTicketRead) && !hasPermission(c, PermTicketManage) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermTicketRead, PermTicketManage}})
		return
	}

	ticketID := parseInt64(c.Param("id"))
	ticket, err := s.repo.GetTicketByID(c.Request.Context(), ticketID)
	if err != nil || ticket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}
	userID := c.GetInt64("user_id")
	if !c.GetBool("is_admin") && !hasPermission(c, PermTicketManage) && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	isManager := c.GetBool("is_admin") || hasPermission(c, PermTicketManage)

	var req UpdateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !isManager && (req.Status != nil || req.Priority != nil || req.Category != nil || req.AssigneeID != nil) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only ticket managers can update status, priority, category or assignee"})
		return
	}
	if req.Status != nil {
		if _, ok := allowedTicketStatus[*req.Status]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status"})
			return
		}
	}
	if req.Priority != nil {
		if _, ok := allowedTicketPriority[*req.Priority]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority"})
			return
		}
	}
	if req.Category != nil {
		if _, ok := allowedTicketCategory[*req.Category]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category"})
			return
		}
	}
	if req.AssigneeID != nil && isManager && *req.AssigneeID > 0 {
		assignee, err := s.repo.GetUserByID(c.Request.Context(), *req.AssigneeID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate assignee"})
			return
		}
		if assignee == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Assignee not found"})
			return
		}
	}

	updated := false
	if req.Status != nil {
		ticket.Status = *req.Status
		if *req.Status == "resolved" || *req.Status == "closed" {
			now := time.Now()
			ticket.ResolvedAt = &now
		} else {
			ticket.ResolvedAt = nil
		}
		updated = true
	}
	if req.Priority != nil {
		ticket.Priority = *req.Priority
		updated = true
	}
	if req.Category != nil {
		ticket.Category = *req.Category
		updated = true
	}
	if req.AssigneeID != nil {
		if *req.AssigneeID == 0 {
			ticket.AssigneeID = nil
		} else {
			ticket.AssigneeID = req.AssigneeID
		}
		updated = true
	}
	if req.Description != nil {
		description := strings.TrimSpace(*req.Description)
		if description == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Description cannot be empty"})
			return
		}
		ticket.Description = description
		updated = true
	}
	if !updated {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid fields to update"})
		return
	}
	if err := s.repo.UpdateTicket(c.Request.Context(), ticket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ticket"})
		return
	}
	updatedTicket, _ := s.repo.GetTicketByID(c.Request.Context(), ticket.ID)
	c.JSON(http.StatusOK, updatedTicket)
}

type CreateTicketMessageRequest struct {
	Message    string `json:"message" binding:"required"`
	IsInternal bool   `json:"isInternal"`
}

func (s *Server) CreateTicketMessage(c *gin.Context) {
	if !hasPermission(c, PermTicketRead) && !hasPermission(c, PermTicketManage) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Permission denied", "required": []string{PermTicketRead, PermTicketManage}})
		return
	}

	ticketID := parseInt64(c.Param("id"))
	ticket, err := s.repo.GetTicketByID(c.Request.Context(), ticketID)
	if err != nil || ticket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}
	userID := c.GetInt64("user_id")
	isManager := c.GetBool("is_admin") || hasPermission(c, PermTicketManage)
	if !isManager && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req CreateTicketMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
		return
	}
	if req.IsInternal && !isManager {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only ticket managers can create internal notes"})
		return
	}

	message := &metadata.TicketMessage{
		TicketID:   ticket.ID,
		AuthorID:   userID,
		Message:    req.Message,
		IsInternal: req.IsInternal,
	}
	if err := s.repo.CreateTicketMessage(c.Request.Context(), message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket message"})
		return
	}
	messages, _ := s.repo.ListTicketMessages(c.Request.Context(), ticket.ID, isManager)
	c.JSON(http.StatusCreated, gin.H{"message": "Ticket message created successfully", "messages": messages})
}

func valueOrDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func canAccessTicketBucket(c *gin.Context, repo metadata.Repository, bucket *metadata.Bucket) bool {
	return canReadBucket(c, repo, bucket) || hasPermission(c, PermBucketWrite)
}
