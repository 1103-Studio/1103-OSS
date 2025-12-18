# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o gooss ./cmd/server

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates tzdata

# Copy binary
COPY --from=builder /app/gooss .
COPY --from=builder /app/configs/config.yaml ./configs/

# Create data directory
RUN mkdir -p /data/oss

# Expose ports
EXPOSE 9000

# Run
CMD ["./gooss", "-config", "configs/config.yaml"]
