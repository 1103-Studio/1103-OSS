package metadata

import "encoding/json"

// BucketPolicy S3 Bucket 策略结构
type BucketPolicy struct {
	Version   string              `json:"Version"`
	Statement []PolicyStatement   `json:"Statement"`
}

// PolicyStatement 策略声明
type PolicyStatement struct {
	Effect    string      `json:"Effect"`    // Allow or Deny
	Principal interface{} `json:"Principal"` // "*" for public access
	Action    interface{} `json:"Action"`    // s3:GetObject, s3:PutObject, etc.
	Resource  interface{} `json:"Resource"`  // arn:aws:s3:::bucket/*
}

// IsPublicRead 判断是否为公开读策略
func (p *BucketPolicy) IsPublicRead() bool {
	if p == nil || p.Statement == nil {
		return false
	}
	
	for _, stmt := range p.Statement {
		// 检查是否允许所有人
		if stmt.Effect != "Allow" {
			continue
		}
		
		// 检查 Principal 是否为 "*"
		principalStr, ok := stmt.Principal.(string)
		if !ok || principalStr != "*" {
			continue
		}
		
		// 检查 Action 是否包含 GetObject
		actions := []string{}
		switch v := stmt.Action.(type) {
		case string:
			actions = append(actions, v)
		case []interface{}:
			for _, a := range v {
				if s, ok := a.(string); ok {
					actions = append(actions, s)
				}
			}
		}
		
		for _, action := range actions {
			if action == "s3:GetObject" || action == "s3:*" {
				return true
			}
		}
	}
	
	return false
}

// PublicReadPolicy 创建公开读策略
func PublicReadPolicy(bucketName string) *BucketPolicy {
	return &BucketPolicy{
		Version: "2012-10-17",
		Statement: []PolicyStatement{
			{
				Effect:    "Allow",
				Principal: "*",
				Action:    "s3:GetObject",
				Resource:  "arn:aws:s3:::" + bucketName + "/*",
			},
		},
	}
}

// ParseBucketPolicy 解析 Bucket Policy JSON
func ParseBucketPolicy(data []byte) (*BucketPolicy, error) {
	var policy BucketPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, err
	}
	return &policy, nil
}
