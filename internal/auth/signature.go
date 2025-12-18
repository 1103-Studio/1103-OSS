package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	SignatureV4Algorithm = "AWS4-HMAC-SHA256"
	ServiceName          = "s3"
	TerminationString    = "aws4_request"
	TimeFormat           = "20060102T150405Z"
	DateFormat           = "20060102"
)

// SignatureV4 AWS Signature V4 验证器
type SignatureV4 struct {
	accessKey string
	secretKey string
	region    string
}

// NewSignatureV4 创建签名验证器
func NewSignatureV4(accessKey, secretKey, region string) *SignatureV4 {
	return &SignatureV4{
		accessKey: accessKey,
		secretKey: secretKey,
		region:    region,
	}
}

// ParsedAuth 解析后的认证信息
type ParsedAuth struct {
	AccessKey       string
	SignedHeaders   []string
	Signature       string
	Region          string
	Date            string
	Service         string
	ContentSHA256   string
	SignatureMethod string
}

// ParseAuthorizationHeader 解析 Authorization 头
func ParseAuthorizationHeader(authHeader string) (*ParsedAuth, error) {
	if !strings.HasPrefix(authHeader, SignatureV4Algorithm) {
		return nil, fmt.Errorf("unsupported signature algorithm")
	}

	auth := &ParsedAuth{SignatureMethod: "header"}

	// 解析 Credential
	credRegex := regexp.MustCompile(`Credential=([^/]+)/(\d{8})/([^/]+)/([^/]+)/aws4_request`)
	credMatch := credRegex.FindStringSubmatch(authHeader)
	if len(credMatch) != 5 {
		return nil, fmt.Errorf("invalid credential format")
	}
	auth.AccessKey = credMatch[1]
	auth.Date = credMatch[2]
	auth.Region = credMatch[3]
	auth.Service = credMatch[4]

	// 解析 SignedHeaders
	headersRegex := regexp.MustCompile(`SignedHeaders=([^,\s]+)`)
	headersMatch := headersRegex.FindStringSubmatch(authHeader)
	if len(headersMatch) != 2 {
		return nil, fmt.Errorf("invalid signed headers")
	}
	auth.SignedHeaders = strings.Split(headersMatch[1], ";")

	// 解析 Signature
	sigRegex := regexp.MustCompile(`Signature=([a-f0-9]+)`)
	sigMatch := sigRegex.FindStringSubmatch(authHeader)
	if len(sigMatch) != 2 {
		return nil, fmt.Errorf("invalid signature")
	}
	auth.Signature = sigMatch[1]

	return auth, nil
}

// ParseQueryAuth 解析 URL 查询参数签名 (预签名 URL)
func ParseQueryAuth(query url.Values) (*ParsedAuth, error) {
	auth := &ParsedAuth{SignatureMethod: "query"}

	algorithm := query.Get("X-Amz-Algorithm")
	if algorithm != SignatureV4Algorithm {
		return nil, fmt.Errorf("unsupported algorithm: %s", algorithm)
	}

	credential := query.Get("X-Amz-Credential")
	parts := strings.Split(credential, "/")
	if len(parts) != 5 {
		return nil, fmt.Errorf("invalid credential")
	}
	auth.AccessKey = parts[0]
	auth.Date = parts[1]
	auth.Region = parts[2]
	auth.Service = parts[3]

	auth.SignedHeaders = strings.Split(query.Get("X-Amz-SignedHeaders"), ";")
	auth.Signature = query.Get("X-Amz-Signature")
	auth.ContentSHA256 = query.Get("X-Amz-Content-Sha256")

	return auth, nil
}

// VerifyRequest 验证请求签名
func (s *SignatureV4) VerifyRequest(r *http.Request, secretKey string) error {
	var auth *ParsedAuth
	var err error

	// 检查是否是预签名 URL
	if r.URL.Query().Get("X-Amz-Algorithm") != "" {
		auth, err = ParseQueryAuth(r.URL.Query())
		if err != nil {
			return err
		}
		return s.verifyQuerySignature(r, auth, secretKey)
	}

	// Header 签名
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return fmt.Errorf("missing authorization header")
	}

	auth, err = ParseAuthorizationHeader(authHeader)
	if err != nil {
		return err
	}

	return s.verifyHeaderSignature(r, auth, secretKey)
}

func (s *SignatureV4) verifyHeaderSignature(r *http.Request, auth *ParsedAuth, secretKey string) error {
	// 获取请求时间
	dateTime := r.Header.Get("X-Amz-Date")
	if dateTime == "" {
		dateTime = r.Header.Get("Date")
	}

	t, err := time.Parse(TimeFormat, dateTime)
	if err != nil {
		return fmt.Errorf("invalid date format")
	}

	// 检查时间偏差 (允许 15 分钟)
	if time.Since(t).Abs() > 15*time.Minute {
		return fmt.Errorf("request time too skewed")
	}

	// 计算签名
	contentSHA256 := r.Header.Get("X-Amz-Content-Sha256")
	if contentSHA256 == "" {
		contentSHA256 = "UNSIGNED-PAYLOAD"
	}

	canonicalRequest := s.buildCanonicalRequest(r, auth.SignedHeaders, contentSHA256)
	stringToSign := s.buildStringToSign(dateTime, auth.Date, auth.Region, canonicalRequest)
	signature := s.calculateSignature(secretKey, auth.Date, auth.Region, stringToSign)

	if signature != auth.Signature {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

func (s *SignatureV4) verifyQuerySignature(r *http.Request, auth *ParsedAuth, secretKey string) error {
	query := r.URL.Query()

	// 获取请求时间
	dateTime := query.Get("X-Amz-Date")
	t, err := time.Parse(TimeFormat, dateTime)
	if err != nil {
		return fmt.Errorf("invalid date format")
	}

	// 检查过期时间
	expires := query.Get("X-Amz-Expires")
	if expires != "" {
		var expireSeconds int
		fmt.Sscanf(expires, "%d", &expireSeconds)
		if time.Since(t) > time.Duration(expireSeconds)*time.Second {
			return fmt.Errorf("request expired")
		}
	}

	// 构建不含签名的查询字符串
	queryWithoutSig := make(url.Values)
	for k, v := range query {
		if k != "X-Amz-Signature" {
			queryWithoutSig[k] = v
		}
	}

	// 重建请求用于签名验证
	reqCopy := *r
	reqCopy.URL = &url.URL{
		Scheme:   r.URL.Scheme,
		Host:     r.URL.Host,
		Path:     r.URL.Path,
		RawQuery: queryWithoutSig.Encode(),
	}

	contentSHA256 := "UNSIGNED-PAYLOAD"
	canonicalRequest := s.buildCanonicalRequestForQuery(&reqCopy, auth.SignedHeaders, contentSHA256)
	stringToSign := s.buildStringToSign(dateTime, auth.Date, auth.Region, canonicalRequest)
	signature := s.calculateSignature(secretKey, auth.Date, auth.Region, stringToSign)

	if signature != auth.Signature {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

func (s *SignatureV4) buildCanonicalRequest(r *http.Request, signedHeaders []string, contentSHA256 string) string {
	// HTTP Method
	method := r.Method

	// Canonical URI
	uri := r.URL.Path
	if uri == "" {
		uri = "/"
	}

	// Canonical Query String
	queryString := s.buildCanonicalQueryString(r.URL.Query())

	// Canonical Headers
	canonicalHeaders := s.buildCanonicalHeaders(r, signedHeaders)

	// Signed Headers
	signedHeadersStr := strings.Join(signedHeaders, ";")

	return fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		method, uri, queryString, canonicalHeaders, signedHeadersStr, contentSHA256)
}

func (s *SignatureV4) buildCanonicalRequestForQuery(r *http.Request, signedHeaders []string, contentSHA256 string) string {
	method := r.Method

	uri := r.URL.Path
	if uri == "" {
		uri = "/"
	}

	queryString := s.buildCanonicalQueryString(r.URL.Query())
	canonicalHeaders := s.buildCanonicalHeaders(r, signedHeaders)
	signedHeadersStr := strings.Join(signedHeaders, ";")

	return fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		method, uri, queryString, canonicalHeaders, signedHeadersStr, contentSHA256)
}

func (s *SignatureV4) buildCanonicalQueryString(query url.Values) string {
	var keys []string
	for k := range query {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var pairs []string
	for _, k := range keys {
		for _, v := range query[k] {
			pairs = append(pairs, url.QueryEscape(k)+"="+url.QueryEscape(v))
		}
	}
	return strings.Join(pairs, "&")
}

func (s *SignatureV4) buildCanonicalHeaders(r *http.Request, signedHeaders []string) string {
	var headers []string
	for _, h := range signedHeaders {
		var value string
		if h == "host" {
			value = r.Host
		} else {
			value = r.Header.Get(h)
		}
		headers = append(headers, strings.ToLower(h)+":"+strings.TrimSpace(value)+"\n")
	}
	return strings.Join(headers, "")
}

func (s *SignatureV4) buildStringToSign(dateTime, date, region, canonicalRequest string) string {
	hash := sha256.Sum256([]byte(canonicalRequest))
	return fmt.Sprintf("%s\n%s\n%s/%s/%s/%s\n%s",
		SignatureV4Algorithm,
		dateTime,
		date, region, ServiceName, TerminationString,
		hex.EncodeToString(hash[:]))
}

func (s *SignatureV4) calculateSignature(secretKey, date, region, stringToSign string) string {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), []byte(date))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(ServiceName))
	kSigning := hmacSHA256(kService, []byte(TerminationString))
	signature := hmacSHA256(kSigning, []byte(stringToSign))
	return hex.EncodeToString(signature)
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

// GeneratePresignedURL 生成预签名 URL
func (s *SignatureV4) GeneratePresignedURL(method, bucket, key string, expires time.Duration, host string) string {
	now := time.Now().UTC()
	dateTime := now.Format(TimeFormat)
	date := now.Format(DateFormat)

	credential := fmt.Sprintf("%s/%s/%s/%s/%s",
		s.accessKey, date, s.region, ServiceName, TerminationString)

	query := url.Values{}
	query.Set("X-Amz-Algorithm", SignatureV4Algorithm)
	query.Set("X-Amz-Credential", credential)
	query.Set("X-Amz-Date", dateTime)
	query.Set("X-Amz-Expires", fmt.Sprintf("%d", int(expires.Seconds())))
	query.Set("X-Amz-SignedHeaders", "host")

	path := "/" + bucket + "/" + key
	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\nhost:%s\n\nhost\nUNSIGNED-PAYLOAD",
		method, path, query.Encode(), host)

	stringToSign := s.buildStringToSign(dateTime, date, s.region, canonicalRequest)
	signature := s.calculateSignature(s.secretKey, date, s.region, stringToSign)

	query.Set("X-Amz-Signature", signature)

	return fmt.Sprintf("http://%s%s?%s", host, path, query.Encode())
}
