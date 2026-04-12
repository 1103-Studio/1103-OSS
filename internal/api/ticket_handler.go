package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gooss/server/internal/metadata"
)

type CreateTicketRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Category    string `json:"category"`
	Priority    string `json:"priority"`
	BucketID    *int64 `json:"bucketId"`
}

func (s *Server) ListTickets(c *gin.Context) {
	userID := c.GetInt64("user_id")
	filter := &metadata.TicketFilter{
		RequesterID: &userID,
		Status:      c.Query("status"),
		Category:    c.Query("category"),
		Priority:    c.Query("priority"),
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
	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
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

	var req UpdateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != nil {
		ticket.Status = *req.Status
		if *req.Status == "resolved" || *req.Status == "closed" {
			now := time.Now()
			ticket.ResolvedAt = &now
		}
	}
	if req.Priority != nil {
		ticket.Priority = *req.Priority
	}
	if req.Category != nil {
		ticket.Category = *req.Category
	}
	if req.AssigneeID != nil {
		ticket.AssigneeID = req.AssigneeID
	}
	if req.Description != nil {
		ticket.Description = *req.Description
	}
	if err := s.repo.UpdateTicket(c.Request.Context(), ticket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ticket"})
		return
	}
	updated, _ := s.repo.GetTicketByID(c.Request.Context(), ticket.ID)
	c.JSON(http.StatusOK, updated)
}

type CreateTicketMessageRequest struct {
	Message    string `json:"message" binding:"required"`
	IsInternal bool   `json:"isInternal"`
}

func (s *Server) CreateTicketMessage(c *gin.Context) {
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
