package metadata

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

func (r *PostgresRepository) CreateTicket(ctx context.Context, ticket *Ticket) error {
	now := time.Now()
	return r.conn(ctx).QueryRow(ctx, `
		INSERT INTO tickets (
			requester_id, assignee_id, title, description, category, priority, status, bucket_id, created_at, updated_at, resolved_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id
	`, ticket.RequesterID, ticket.AssigneeID, ticket.Title, ticket.Description, ticket.Category, ticket.Priority, ticket.Status, ticket.BucketID, now, now, ticket.ResolvedAt).Scan(&ticket.ID)
}

func (r *PostgresRepository) GetTicketByID(ctx context.Context, id int64) (*Ticket, error) {
	ticket := &Ticket{}
	err := r.conn(ctx).QueryRow(ctx, `
		SELECT t.id, t.requester_id, t.assignee_id, t.title, t.description, t.category, t.priority, t.status,
		       t.bucket_id, COALESCE(b.name, ''), COALESCE(u1.username, ''), COALESCE(u2.username, ''),
		       t.created_at, t.updated_at, t.resolved_at
		FROM tickets t
		LEFT JOIN buckets b ON b.id = t.bucket_id
		LEFT JOIN users u1 ON u1.id = t.requester_id
		LEFT JOIN users u2 ON u2.id = t.assignee_id
		WHERE t.id = $1
	`, id).Scan(
		&ticket.ID, &ticket.RequesterID, &ticket.AssigneeID, &ticket.Title, &ticket.Description, &ticket.Category,
		&ticket.Priority, &ticket.Status, &ticket.BucketID, &ticket.BucketName, &ticket.Requester, &ticket.Assignee,
		&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ResolvedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

func (r *PostgresRepository) ListTickets(ctx context.Context, filter *TicketFilter) ([]*Ticket, error) {
	query := `
		SELECT t.id, t.requester_id, t.assignee_id, t.title, t.description, t.category, t.priority, t.status,
		       t.bucket_id, COALESCE(b.name, ''), COALESCE(u1.username, ''), COALESCE(u2.username, ''),
		       t.created_at, t.updated_at, t.resolved_at
		FROM tickets t
		LEFT JOIN buckets b ON b.id = t.bucket_id
		LEFT JOIN users u1 ON u1.id = t.requester_id
		LEFT JOIN users u2 ON u2.id = t.assignee_id
		WHERE 1=1
	`
	args := []any{}
	argIndex := 1

	if filter != nil {
		if !filter.IncludeAll && filter.RequesterID != nil {
			query += fmt.Sprintf(" AND t.requester_id = $%d", argIndex)
			args = append(args, *filter.RequesterID)
			argIndex++
		}
		if filter.AssigneeID != nil {
			query += fmt.Sprintf(" AND t.assignee_id = $%d", argIndex)
			args = append(args, *filter.AssigneeID)
			argIndex++
		}
		if filter.Status != "" {
			query += fmt.Sprintf(" AND t.status = $%d", argIndex)
			args = append(args, filter.Status)
			argIndex++
		}
		if filter.Category != "" {
			query += fmt.Sprintf(" AND t.category = $%d", argIndex)
			args = append(args, filter.Category)
			argIndex++
		}
		if filter.Priority != "" {
			query += fmt.Sprintf(" AND t.priority = $%d", argIndex)
			args = append(args, filter.Priority)
			argIndex++
		}
	}

	query += " ORDER BY t.updated_at DESC"
	if filter != nil && filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, filter.Limit)
		argIndex++
	}
	if filter != nil && filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, filter.Offset)
	}

	rows, err := r.conn(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tickets := make([]*Ticket, 0)
	for rows.Next() {
		ticket := &Ticket{}
		if err := rows.Scan(
			&ticket.ID, &ticket.RequesterID, &ticket.AssigneeID, &ticket.Title, &ticket.Description, &ticket.Category,
			&ticket.Priority, &ticket.Status, &ticket.BucketID, &ticket.BucketName, &ticket.Requester, &ticket.Assignee,
			&ticket.CreatedAt, &ticket.UpdatedAt, &ticket.ResolvedAt,
		); err != nil {
			return nil, err
		}
		tickets = append(tickets, ticket)
	}
	return tickets, rows.Err()
}

func (r *PostgresRepository) UpdateTicket(ctx context.Context, ticket *Ticket) error {
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE tickets
		SET assignee_id = $1, title = $2, description = $3, category = $4, priority = $5,
		    status = $6, bucket_id = $7, updated_at = $8, resolved_at = $9
		WHERE id = $10
	`, ticket.AssigneeID, ticket.Title, ticket.Description, ticket.Category, ticket.Priority, ticket.Status, ticket.BucketID, time.Now(), ticket.ResolvedAt, ticket.ID)
	return err
}

func (r *PostgresRepository) CreateTicketMessage(ctx context.Context, message *TicketMessage) error {
	return r.conn(ctx).QueryRow(ctx, `
		INSERT INTO ticket_messages (ticket_id, author_id, message, is_internal, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, message.TicketID, message.AuthorID, message.Message, message.IsInternal, time.Now()).Scan(&message.ID)
}

func (r *PostgresRepository) ListTicketMessages(ctx context.Context, ticketID int64, includeInternal bool) ([]*TicketMessage, error) {
	query := `
		SELECT tm.id, tm.ticket_id, tm.author_id, COALESCE(u.username, ''), tm.message, tm.is_internal, tm.created_at
		FROM ticket_messages tm
		LEFT JOIN users u ON u.id = tm.author_id
		WHERE tm.ticket_id = $1
	`
	args := []any{ticketID}
	if !includeInternal {
		query += " AND tm.is_internal = FALSE"
	}
	query += " ORDER BY tm.created_at ASC"

	rows, err := r.conn(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]*TicketMessage, 0)
	for rows.Next() {
		message := &TicketMessage{}
		if err := rows.Scan(&message.ID, &message.TicketID, &message.AuthorID, &message.Author, &message.Message, &message.IsInternal, &message.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	return messages, rows.Err()
}
