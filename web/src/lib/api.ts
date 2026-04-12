import axios, { type AxiosRequestConfig } from 'axios'
import { getSignedHeaders, sha256 } from './aws-signature-v4'

export interface StoredCredentials {
  accessKey: string
  secretKey: string
  endpoint: string
  publicEndpoint?: string
  username?: string
  isAdmin?: boolean
}

export interface BucketSummary {
  Name: string
  CreationDate: string
}

export interface ListBucketsResponse {
  ListAllMyBucketsResult: {
    Buckets: {
      Bucket: BucketSummary[]
    }
  }
}

export interface ObjectSummary {
  Key: string
  LastModified: string
  ETag: string
  Size: number
  StorageClass: string
}

export interface CommonPrefix {
  Prefix: string
}

export interface ListObjectsResponse {
  ListBucketResult: {
    Name: string
    Prefix: string
    Marker: string
    MaxKeys: number
    Delimiter: string
    IsTruncated: boolean
    Contents: ObjectSummary[]
    CommonPrefixes: CommonPrefix[]
  }
}

export interface BucketSettingsResponse {
  message?: string
  default_expiry?: string
}

export interface AuditLogRecord {
  id: number
  user_id?: number
  username: string
  action: string
  resource_type: string
  resource_name?: string
  bucket_name?: string
  object_key?: string
  ip_address: string
  status_code: number
  error_message?: string
  created_at: string
}

export interface AuditStatsResponse {
  total_operations: number
  unique_users: number
  failed_operations: number
  object_operations: number
  bucket_operations?: number
}

interface BucketPolicyStatement {
  Effect: string
  Principal: string | Record<string, string>
  Action: string | string[]
  Resource: string | string[]
}

interface BucketPolicy {
  Version: string
  Statement: BucketPolicyStatement[]
}

interface AuditLogFilter {
  action?: string
  resource_type?: string
  bucket_name?: string
  limit?: number
}

interface MigrationPayload {
  sourceEndpoint: string
  accessKey: string
  secretKey: string
  region: string
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function getBrowserOrigin() {
  if (typeof window === 'undefined') {
    return 'http://localhost'
  }
  return window.location.origin
}

function normalizeApiBaseUrl(value?: string) {
  const normalized = (value || '').trim()
  if (!normalized) {
    return '/api'
  }
  return trimTrailingSlash(normalized)
}

function normalizeApiPath(path: string) {
  if (!path || path === '/') {
    return '/'
  }
  return path.startsWith('/') ? path : `/${path}`
}

function toAbsoluteUrl(url: string) {
  return new URL(url, getBrowserOrigin()).toString()
}

function joinApiPath(path = '') {
  const base = normalizeApiBaseUrl(import.meta.env.VITE_API_URL)
  if (!path) {
    return base
  }

  const normalizedPath = normalizeApiPath(path)
  if (normalizedPath === '/') {
    return `${base}/`
  }

  return `${base}${normalizedPath}`
}

function isLoopbackUrl(url: string) {
  try {
    const parsed = new URL(toAbsoluteUrl(url))
    return LOOPBACK_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

function resolvePublicEndpoint(endpoint?: string) {
  const fallback = getApiEndpoint()
  if (!endpoint) {
    return fallback
  }

  const resolved = trimTrailingSlash(toAbsoluteUrl(endpoint))
  if (typeof window === 'undefined') {
    return resolved
  }

  if (isLoopbackUrl(resolved) && !isLoopbackUrl(getBrowserOrigin())) {
    return fallback
  }

  return resolved
}

function toHeaderMap(headers?: AxiosRequestConfig['headers']) {
  const mapped: Record<string, string> = {}
  if (!headers) {
    return mapped
  }

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (value !== undefined && value !== null) {
      mapped[key] = String(value)
    }
  }

  return mapped
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL)

export function getApiEndpoint(path = '') {
  const url = toAbsoluteUrl(joinApiPath(path))
  if (!path) {
    return trimTrailingSlash(url)
  }
  return url
}

export function getCredentials(): StoredCredentials | null {
  const stored = localStorage.getItem('oss_credentials')
  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as StoredCredentials
  } catch {
    localStorage.removeItem('oss_credentials')
    return null
  }
}

export function getStorageEndpoint() {
  const credentials = getCredentials()
  const endpoint = credentials?.publicEndpoint || credentials?.endpoint || getApiEndpoint()
  return trimTrailingSlash(toAbsoluteUrl(endpoint))
}

const api = axios.create({
  baseURL: API_BASE_URL,
})

async function generateAuthHeader(
  method: string,
  path: string,
  body?: unknown,
  additionalHeaders?: Record<string, string>
) {
  const credentials = getCredentials()
  if (!credentials) {
    return {}
  }

  try {
    const headers = await getSignedHeaders(
      method,
      getApiEndpoint(path),
      credentials.accessKey,
      credentials.secretKey,
      body,
      additionalHeaders
    )

    delete headers.Host
    delete headers.host

    return headers
  } catch (error) {
    console.error('Failed to generate signature:', error)
    return {}
  }
}

async function signedRequest<T = any>(
  method: string,
  path: string,
  data?: unknown,
  config: AxiosRequestConfig = {}
) {
  const baseHeaders = toHeaderMap(config.headers)
  const authHeaders = await generateAuthHeader(method, path, data, baseHeaders)

  return api.request<T>({
    ...config,
    method,
    url: path,
    data,
    headers: {
      ...baseHeaders,
      ...authHeaders,
    },
  })
}

function parseListBucketsXML(xmlString: string): ListBucketsResponse {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml')

  const bucketsElement = xmlDoc.querySelector('Buckets')
  if (!bucketsElement) {
    return { ListAllMyBucketsResult: { Buckets: { Bucket: [] } } }
  }

  const bucketElements = bucketsElement.querySelectorAll('Bucket')
  const buckets = Array.from(bucketElements).map((bucket) => ({
    Name: bucket.querySelector('Name')?.textContent || '',
    CreationDate: bucket.querySelector('CreationDate')?.textContent || ''
  }))

  return {
    ListAllMyBucketsResult: {
      Buckets: {
        Bucket: buckets,
      },
    },
  }
}

function parseListObjectsXML(xmlString: string): ListObjectsResponse {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml')

  const contentsElements = xmlDoc.querySelectorAll('Contents')
  const contents = Array.from(contentsElements).map((content) => ({
    Key: content.querySelector('Key')?.textContent || '',
    LastModified: content.querySelector('LastModified')?.textContent || '',
    ETag: content.querySelector('ETag')?.textContent || '',
    Size: parseInt(content.querySelector('Size')?.textContent || '0', 10),
    StorageClass: content.querySelector('StorageClass')?.textContent || 'STANDARD'
  }))

  const prefixElements = xmlDoc.querySelectorAll('CommonPrefixes')
  const commonPrefixes = Array.from(prefixElements).map((prefix) => ({
    Prefix: prefix.querySelector('Prefix')?.textContent || ''
  }))

  return {
    ListBucketResult: {
      Name: xmlDoc.querySelector('Name')?.textContent || '',
      Prefix: xmlDoc.querySelector('Prefix')?.textContent || '',
      Marker: xmlDoc.querySelector('Marker')?.textContent || '',
      MaxKeys: parseInt(xmlDoc.querySelector('MaxKeys')?.textContent || '1000', 10),
      Delimiter: xmlDoc.querySelector('Delimiter')?.textContent || '',
      IsTruncated: xmlDoc.querySelector('IsTruncated')?.textContent === 'true',
      Contents: contents,
      CommonPrefixes: commonPrefixes,
    },
  }
}

function parseDuration(duration: string): number {
  const regex = /(\d+)([wdhms])/g
  let totalSeconds = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(duration)) !== null) {
    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 'w':
        totalSeconds += value * 7 * 24 * 3600
        break
      case 'd':
        totalSeconds += value * 24 * 3600
        break
      case 'h':
        totalSeconds += value * 3600
        break
      case 'm':
        totalSeconds += value * 60
        break
      case 's':
        totalSeconds += value
        break
    }
  }

  return totalSeconds || 604800
}

function buildPublicReadPolicy(bucket: string): BucketPolicy {
  return {
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${bucket}/*`,
    }],
  }
}

export function isBucketPublic(policy: BucketPolicy | null | undefined) {
  const statements = Array.isArray(policy?.Statement) ? policy.Statement : []
  return statements.some((statement) => {
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action]
    return statement.Effect === 'Allow' &&
      statement.Principal === '*' &&
      actions.some((action) => action === 's3:GetObject')
  })
}

export async function loginUser(username: string, password: string) {
  const response = await api.post<StoredCredentials & { username?: string; isAdmin?: boolean }>('/auth/login', { username, password })
  return {
    ...response.data,
    endpoint: getApiEndpoint(),
    publicEndpoint: resolvePublicEndpoint(response.data?.endpoint),
  }
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const response = await signedRequest('POST', '/user/change-password', { oldPassword, newPassword })
  return response.data
}

export async function listBuckets(): Promise<ListBucketsResponse> {
  const response = await signedRequest<string>('GET', '/', undefined, { responseType: 'text' })
  if (typeof response.data === 'string' && response.data.includes('<ListAllMyBucketsResult')) {
    return parseListBucketsXML(response.data)
  }
  return response.data as unknown as ListBucketsResponse
}

export async function createBucket(name: string) {
  await signedRequest('PUT', `/${name}`)
}

export async function deleteBucket(name: string) {
  await signedRequest('DELETE', `/${name}`)
}

export async function listObjects(bucket: string, prefix = '', delimiter = '/'): Promise<ListObjectsResponse> {
  const params = new URLSearchParams()
  if (prefix) params.set('prefix', prefix)
  if (delimiter) params.set('delimiter', delimiter)

  const path = `/${bucket}${params.toString() ? `?${params.toString()}` : ''}`
  const response = await signedRequest<string>('GET', path, undefined, { responseType: 'text' })

  if (typeof response.data === 'string' && response.data.includes('<ListBucketResult')) {
    return parseListObjectsXML(response.data)
  }

  return response.data as unknown as ListObjectsResponse
}

export async function uploadObject(
  bucket: string,
  key: string,
  file: File,
  onProgress?: (percent: number) => void
) {
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  const path = `/${bucket}/${encodedKey}`
  const headers = {
    'Content-Type': file.type || 'application/octet-stream',
  }

  await signedRequest('PUT', path, file, {
    headers,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total))
      }
    },
  })
}

export async function createFolder(bucket: string, folderPath: string) {
  const key = folderPath.endsWith('/') ? folderPath : `${folderPath}/`
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  const path = `/${bucket}/${encodedKey}`
  const emptyBlob = new Blob([], { type: 'application/x-directory' })

  await signedRequest('PUT', path, emptyBlob, {
    headers: {
      'Content-Type': 'application/x-directory',
      'Content-Length': '0',
    },
  })
}

export async function deleteObject(bucket: string, key: string) {
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  await signedRequest('DELETE', `/${bucket}/${encodedKey}`)
}

export async function deleteFolder(bucket: string, folderPrefix: string) {
  const prefix = folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`
  const result = await listAllObjects(bucket, prefix)
  const objects = result?.ListBucketResult?.Contents || []

  for (const obj of objects) {
    await deleteObject(bucket, obj.Key)
  }

  try {
    await deleteObject(bucket, prefix)
  } catch {
    // 目录标记不存在时忽略
  }
}

export async function getBucketPolicy(bucket: string): Promise<BucketPolicy> {
  const response = await signedRequest<BucketPolicy>('GET', `/${bucket}?policy`)
  return response.data
}

export async function getBucketPublicStatus(bucket: string) {
  try {
    const policy = await getBucketPolicy(bucket)
    return isBucketPublic(policy)
  } catch {
    return false
  }
}

export async function setBucketPublic(bucket: string) {
  const policy = JSON.stringify(buildPublicReadPolicy(bucket))
  await signedRequest('PUT', `/${bucket}?policy`, policy, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function setBucketPrivate(bucket: string) {
  await signedRequest('DELETE', `/${bucket}?policy`)
}

export async function getBucketSettings(bucket: string): Promise<BucketSettingsResponse> {
  const response = await signedRequest<BucketSettingsResponse>('GET', `/${bucket}?settings`)
  return response.data
}

export async function updateBucketSettings(bucket: string, defaultExpiry: string): Promise<BucketSettingsResponse> {
  const response = await signedRequest<BucketSettingsResponse>('PUT', `/${bucket}?settings`, { default_expiry: defaultExpiry })
  return response.data
}

export async function listAllObjects(bucket: string, prefix = ''): Promise<ListObjectsResponse> {
  const params = new URLSearchParams()
  if (prefix) params.set('prefix', prefix)

  const path = `/${bucket}${params.toString() ? `?${params.toString()}` : ''}`
  const response = await signedRequest<string>('GET', path, undefined, { responseType: 'text' })

  if (typeof response.data === 'string' && response.data.includes('<ListBucketResult')) {
    return parseListObjectsXML(response.data)
  }

  return response.data as unknown as ListObjectsResponse
}

export async function listAuditLogs(filter: AuditLogFilter): Promise<AuditLogRecord[]> {
  const params = new URLSearchParams()
  if (filter.action) params.set('action', filter.action)
  if (filter.resource_type) params.set('resource_type', filter.resource_type)
  if (filter.bucket_name) params.set('bucket_name', filter.bucket_name)
  params.set('limit', String(filter.limit || 50))

  const response = await signedRequest<{ logs: AuditLogRecord[] }>('GET', `/admin/audit-logs?${params.toString()}`)
  return response.data.logs || []
}

export async function getAuditLogStats(): Promise<AuditStatsResponse> {
  const response = await signedRequest<AuditStatsResponse>('GET', '/admin/audit-logs/stats')
  return response.data
}

export async function startMigration(data: MigrationPayload) {
  const response = await signedRequest('POST', '/admin/migration/start', data)
  return response.data
}

export async function getPresignedUrl(bucket: string, key: string, expiresInSeconds?: number) {
  if (!expiresInSeconds) {
    try {
      const settings = await getBucketSettings(bucket)
      expiresInSeconds = parseDuration(settings.default_expiry || '7d')
    } catch {
      expiresInSeconds = 604800
    }
  }

  const credentials = getCredentials()
  if (!credentials) {
    throw new Error('No credentials')
  }

  const endpoint = getStorageEndpoint()
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  const path = `/${bucket}/${encodedKey}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const region = 'us-east-1'
  const service = 's3'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const fileName = key.split('/').pop() || 'download'

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${credentials.accessKey}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
    'response-content-disposition': `attachment;filename="${encodeURIComponent(fileName)}"`,
  }

  const canonicalQueryString = Object.keys(params)
    .sort()
    .map((paramKey) => `${encodeURIComponent(paramKey)}=${encodeURIComponent(params[paramKey])}`)
    .join('&')

  const canonicalRequest = [
    'GET',
    path,
    canonicalQueryString,
    `host:${new URL(endpoint).host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n')

  const encoder = new TextEncoder()
  const signHmac = async (rawKey: BufferSource, message: string) =>
    crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
      encoder.encode(message)
    )

  const kDate = await signHmac(encoder.encode(`AWS4${credentials.secretKey}`), dateStamp)
  const kRegion = await signHmac(kDate, region)
  const kService = await signHmac(kRegion, service)
  const kSigning = await signHmac(kService, 'aws4_request')
  const signatureBytes = await signHmac(kSigning, stringToSign)
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return `${endpoint}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`
}

export function getObjectUrl(bucket: string, key: string) {
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `${getStorageEndpoint()}/${bucket}/${encodedKey}`
}

export async function getStats() {
  return {
    totalBuckets: 0,
    totalObjects: 0,
    totalSize: 0,
  }
}

export default api
