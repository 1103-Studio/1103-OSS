import axios, { type AxiosRequestConfig } from 'axios'

export interface StoredCredentials {
  accessKey: string
  sessionToken: string
  endpoint: string
  publicEndpoint?: string
  username?: string
  displayName?: string
  isAdmin?: boolean
  subscription?: SubscriptionProfileRecord
  roles?: RoleRecord[]
  permissions?: string[]
}

export interface RoleRecord {
  id: number
  name: string
  description: string
  permissions: string[]
}

export interface UserRecord {
  id: number
  username: string
  displayName?: string
  email?: string
  status: string
  isAdmin: boolean
  subscription?: SubscriptionProfileRecord
  roles?: RoleRecord[]
  permissions?: string[]
}

export interface UserSubscriptionRecord {
  id: number
  userId: number
  planId?: number | null
  resourceCodeId?: number | null
  source: string
  status: string
  storageBytes: number
  trafficBytes: number
  objectQuota: number
  startedAt: string
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface SubscriptionProfileRecord {
  activePlans: UserSubscriptionRecord[]
  totalStorageBytes: number
  totalTrafficBytes: number
  totalObjectQuota: number
  expiresAt?: string | null
}

export interface SubscriptionPlanRecord {
  id: number
  name: string
  code: string
  description: string
  storageBytes: number
  trafficBytes: number
  objectQuota: number
  durationDays: number
  priceCents: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface ResourcePackCodeRecord {
  id: number
  planId: number
  code: string
  label: string
  storageBytes: number
  trafficBytes: number
  objectQuota: number
  durationDays: number
  status: string
  redeemedByUserId?: number | null
  redeemedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CredentialRecord {
  id: number
  userId: number
  accessKey: string
  description?: string
  status: string
  createdAt: string
  expiresAt?: string | null
}

export interface BucketAdminRecord {
  id: number
  name: string
  ownerId: number
  region: string
  acl: string
  defaultExpiry: string
  maxSizeBytes: number
  maxTrafficBytes: number
  usedTrafficBytes: number
  maxObjects: number
  createdAt: string
}

export interface BucketAccessRecord {
  id: number
  bucketId: number
  userId: number
  permission: string
  createdAt: string
  updatedAt: string
}

export interface TicketRecord {
  id: number
  requesterId: number
  assigneeId?: number | null
  title: string
  description: string
  category: string
  priority: string
  status: string
  bucketId?: number | null
  bucketName?: string
  requester?: string
  assignee?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
}

export interface TicketMessageRecord {
  id: number
  ticketId: number
  authorId: number
  author?: string
  message: string
  isInternal: boolean
  createdAt: string
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

export interface MigrationJobRecord {
  id: number
  userId: number
  sourceEndpoint: string
  region: string
  status: string
  currentBucket?: string
  currentObject?: string
  totalBuckets: number
  totalObjects: number
  completedObjects: number
  errorCount: number
  lastError?: string
  startedAt: string
  updatedAt: string
  completedAt?: string | null
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
}

function normalizeMigrationJob(value: any): MigrationJobRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    userId: readField<number>(value, 'userId', 'UserID') || 0,
    sourceEndpoint: readField<string>(value, 'sourceEndpoint', 'SourceEndpoint') || '',
    region: readField<string>(value, 'region', 'Region') || '',
    status: readField<string>(value, 'status', 'Status') || '',
    currentBucket: readField<string>(value, 'currentBucket', 'CurrentBucket') || '',
    currentObject: readField<string>(value, 'currentObject', 'CurrentObject') || '',
    totalBuckets: readField<number>(value, 'totalBuckets', 'TotalBuckets') || 0,
    totalObjects: readField<number>(value, 'totalObjects', 'TotalObjects') || 0,
    completedObjects: readField<number>(value, 'completedObjects', 'CompletedObjects') || 0,
    errorCount: readField<number>(value, 'errorCount', 'ErrorCount') || 0,
    lastError: readField<string>(value, 'lastError', 'LastError') || '',
    startedAt: readField<string>(value, 'startedAt', 'StartedAt') || '',
    updatedAt: readField<string>(value, 'updatedAt', 'UpdatedAt') || '',
    completedAt: readField<string | null>(value, 'completedAt', 'CompletedAt') ?? null,
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const CREDENTIALS_KEY = 'oss_credentials'

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function readField<T = any>(value: any, lower: string, upper: string): T | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  return value[lower] ?? value[upper]
}

function normalizeRole(value: any): RoleRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    name: readField<string>(value, 'name', 'Name') || '',
    description: readField<string>(value, 'description', 'Description') || '',
    permissions: readField<string[]>(value, 'permissions', 'Permissions') || [],
  }
}

function normalizeUser(value: any): UserRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    username: readField<string>(value, 'username', 'Username') || '',
    displayName: readField<string>(value, 'displayName', 'DisplayName') || '',
    email: readField<string>(value, 'email', 'Email') || '',
    status: readField<string>(value, 'status', 'Status') || '',
    isAdmin: !!readField<boolean>(value, 'isAdmin', 'IsAdmin'),
    subscription: normalizeSubscriptionProfile(readField<any>(value, 'subscription', 'Subscription')),
    roles: (readField<any[]>(value, 'roles', 'Roles') || []).map(normalizeRole),
    permissions: readField<string[]>(value, 'permissions', 'Permissions') || [],
  }
}

function normalizeUserSubscription(value: any): UserSubscriptionRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    userId: readField<number>(value, 'userId', 'UserID') || 0,
    planId: readField<number | null>(value, 'planId', 'PlanID') ?? null,
    resourceCodeId: readField<number | null>(value, 'resourceCodeId', 'ResourceCodeID') ?? null,
    source: readField<string>(value, 'source', 'Source') || '',
    status: readField<string>(value, 'status', 'Status') || '',
    storageBytes: readField<number>(value, 'storageBytes', 'StorageBytes') || 0,
    trafficBytes: readField<number>(value, 'trafficBytes', 'TrafficBytes') || 0,
    objectQuota: readField<number>(value, 'objectQuota', 'ObjectQuota') || 0,
    startedAt: readField<string>(value, 'startedAt', 'StartedAt') || '',
    expiresAt: readField<string | null>(value, 'expiresAt', 'ExpiresAt') ?? null,
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
    updatedAt: readField<string>(value, 'updatedAt', 'UpdatedAt') || '',
  }
}

function normalizeSubscriptionProfile(value: any): SubscriptionProfileRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  return {
    activePlans: (readField<any[]>(value, 'activePlans', 'ActivePlans') || []).map(normalizeUserSubscription),
    totalStorageBytes: readField<number>(value, 'totalStorageBytes', 'TotalStorageBytes') || 0,
    totalTrafficBytes: readField<number>(value, 'totalTrafficBytes', 'TotalTrafficBytes') || 0,
    totalObjectQuota: readField<number>(value, 'totalObjectQuota', 'TotalObjectQuota') || 0,
    expiresAt: readField<string | null>(value, 'expiresAt', 'ExpiresAt') ?? null,
  }
}

function normalizeSubscriptionPlan(value: any): SubscriptionPlanRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    name: readField<string>(value, 'name', 'Name') || '',
    code: readField<string>(value, 'code', 'Code') || '',
    description: readField<string>(value, 'description', 'Description') || '',
    storageBytes: readField<number>(value, 'storageBytes', 'StorageBytes') || 0,
    trafficBytes: readField<number>(value, 'trafficBytes', 'TrafficBytes') || 0,
    objectQuota: readField<number>(value, 'objectQuota', 'ObjectQuota') || 0,
    durationDays: readField<number>(value, 'durationDays', 'DurationDays') || 0,
    priceCents: readField<number>(value, 'priceCents', 'PriceCents') || 0,
    status: readField<string>(value, 'status', 'Status') || '',
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
    updatedAt: readField<string>(value, 'updatedAt', 'UpdatedAt') || '',
  }
}

function normalizeResourcePackCode(value: any): ResourcePackCodeRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    planId: readField<number>(value, 'planId', 'PlanID') || 0,
    code: readField<string>(value, 'code', 'Code') || '',
    label: readField<string>(value, 'label', 'Label') || '',
    storageBytes: readField<number>(value, 'storageBytes', 'StorageBytes') || 0,
    trafficBytes: readField<number>(value, 'trafficBytes', 'TrafficBytes') || 0,
    objectQuota: readField<number>(value, 'objectQuota', 'ObjectQuota') || 0,
    durationDays: readField<number>(value, 'durationDays', 'DurationDays') || 0,
    status: readField<string>(value, 'status', 'Status') || '',
    redeemedByUserId: readField<number | null>(value, 'redeemedByUserId', 'RedeemedByUserID') ?? null,
    redeemedAt: readField<string | null>(value, 'redeemedAt', 'RedeemedAt') ?? null,
    expiresAt: readField<string | null>(value, 'expiresAt', 'ExpiresAt') ?? null,
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
    updatedAt: readField<string>(value, 'updatedAt', 'UpdatedAt') || '',
  }
}

function normalizeBucket(value: any): BucketAdminRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    name: readField<string>(value, 'name', 'Name') || '',
    ownerId: readField<number>(value, 'ownerId', 'OwnerID') || 0,
    region: readField<string>(value, 'region', 'Region') || '',
    acl: readField<string>(value, 'acl', 'ACL') || '',
    defaultExpiry: readField<string>(value, 'defaultExpiry', 'DefaultExpiry') || '',
    maxSizeBytes: readField<number>(value, 'maxSizeBytes', 'MaxSizeBytes') || 0,
    maxTrafficBytes: readField<number>(value, 'maxTrafficBytes', 'MaxTrafficBytes') || 0,
    usedTrafficBytes: readField<number>(value, 'usedTrafficBytes', 'UsedTrafficBytes') || 0,
    maxObjects: readField<number>(value, 'maxObjects', 'MaxObjects') || 0,
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
  }
}

function normalizeBucketAccess(value: any): BucketAccessRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    bucketId: readField<number>(value, 'bucketId', 'BucketID') || 0,
    userId: readField<number>(value, 'userId', 'UserID') || 0,
    permission: readField<string>(value, 'permission', 'Permission') || '',
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
    updatedAt: readField<string>(value, 'updatedAt', 'UpdatedAt') || '',
  }
}

function normalizeTicket(value: any): TicketRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    requesterId: readField<number>(value, 'requesterId', 'RequesterID') || 0,
    assigneeId: readField<number | null>(value, 'assigneeId', 'AssigneeID') ?? null,
    title: readField<string>(value, 'title', 'Title') || '',
    description: readField<string>(value, 'description', 'Description') || '',
    category: readField<string>(value, 'category', 'Category') || '',
    priority: readField<string>(value, 'priority', 'Priority') || '',
    status: readField<string>(value, 'status', 'Status') || '',
    bucketId: readField<number | null>(value, 'bucketId', 'BucketID') ?? null,
    bucketName: readField<string>(value, 'bucketName', 'BucketName') || '',
    requester: readField<string>(value, 'requester', 'Requester') || '',
    assignee: readField<string>(value, 'assignee', 'Assignee') || '',
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
    updatedAt: readField<string>(value, 'updatedAt', 'UpdatedAt') || '',
    resolvedAt: readField<string | null>(value, 'resolvedAt', 'ResolvedAt') ?? null,
  }
}

function normalizeTicketMessage(value: any): TicketMessageRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    ticketId: readField<number>(value, 'ticketId', 'TicketID') || 0,
    authorId: readField<number>(value, 'authorId', 'AuthorID') || 0,
    author: readField<string>(value, 'author', 'Author') || '',
    message: readField<string>(value, 'message', 'Message') || '',
    isInternal: !!readField<boolean>(value, 'isInternal', 'IsInternal'),
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
  }
}

function normalizeCredential(value: any): CredentialRecord {
  return {
    id: readField<number>(value, 'id', 'ID') || 0,
    userId: readField<number>(value, 'userId', 'UserID') || 0,
    accessKey: readField<string>(value, 'accessKey', 'AccessKey') || '',
    description: readField<string>(value, 'description', 'Description') || '',
    status: readField<string>(value, 'status', 'Status') || '',
    createdAt: readField<string>(value, 'createdAt', 'CreatedAt') || '',
    expiresAt: readField<string | null>(value, 'expiresAt', 'ExpiresAt') ?? null,
  }
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

  if (typeof window !== 'undefined') {
    try {
      const resolved = new URL(toAbsoluteUrl(normalized))
      const browserOrigin = new URL(getBrowserOrigin())

      if (LOOPBACK_HOSTS.has(resolved.hostname) && resolved.origin !== browserOrigin.origin) {
        return '/api'
      }
    } catch {
      return '/api'
    }
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
  const stored = sessionStorage.getItem(CREDENTIALS_KEY) || localStorage.getItem(CREDENTIALS_KEY)
  if (!stored) {
    return null
  }

  try {
    const parsed = JSON.parse(stored) as StoredCredentials
    if (!sessionStorage.getItem(CREDENTIALS_KEY)) {
      sessionStorage.setItem(CREDENTIALS_KEY, stored)
      localStorage.removeItem(CREDENTIALS_KEY)
    }
    return parsed
  } catch {
    sessionStorage.removeItem(CREDENTIALS_KEY)
    localStorage.removeItem(CREDENTIALS_KEY)
    return null
  }
}

export function getStorageEndpoint() {
  const credentials = getCredentials()
  const endpoint = credentials?.publicEndpoint || getApiEndpoint()
  return trimTrailingSlash(toAbsoluteUrl(endpoint))
}

const api = axios.create({
  baseURL: API_BASE_URL,
})

async function generateAuthHeader(
  _method: string,
  _path: string,
  _body?: unknown,
  _additionalHeaders?: Record<string, string>
) {
  const credentials = getCredentials()
  if (!credentials?.sessionToken) {
    return {}
  }
  return { Authorization: `Bearer ${credentials.sessionToken}` }
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
  const response = await api.post<StoredCredentials>('/auth/login', { username, password })
  return {
    ...response.data,
    subscription: normalizeSubscriptionProfile((response.data as any).subscription || (response.data as any).Subscription),
    displayName: response.data.displayName || (response.data as any).DisplayName || '',
    roles: (response.data.roles || (response.data as any).Roles || []).map(normalizeRole),
    permissions: response.data.permissions || (response.data as any).Permissions || [],
    endpoint: getApiEndpoint(),
    publicEndpoint: resolvePublicEndpoint(response.data?.endpoint),
    sessionToken: response.data.sessionToken || (response.data as any).SessionToken || '',
  }
}

export async function logoutUser() {
  const response = await signedRequest('POST', '/auth/logout')
  return response.data
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

export async function listMigrationJobs(limit = 20): Promise<MigrationJobRecord[]> {
  try {
    const response = await signedRequest<{ jobs: any[] }>('GET', `/admin/migration/jobs?limit=${limit}`)
    return (response.data.jobs || []).map(normalizeMigrationJob)
  } catch (error: any) {
    if (error?.response?.status === 500) {
      return []
    }
    throw error
  }
}

export async function getMigrationJob(id: number): Promise<MigrationJobRecord> {
  const response = await signedRequest<{ job: any }>('GET', `/admin/migration/jobs/${id}`)
  return normalizeMigrationJob(response.data.job)
}

export async function cancelMigrationJob(id: number) {
  const response = await signedRequest('POST', `/admin/migration/jobs/${id}/cancel`)
  return response.data
}

export async function listUsers() {
  const response = await signedRequest<UserRecord[]>('GET', '/admin/users')
  return (response.data || []).map(normalizeUser)
}

export async function listSubscriptionPlans(includeDisabled = true) {
  const suffix = includeDisabled ? '' : '?active=true'
  const response = await signedRequest<{ plans: any[] }>('GET', `/admin/subscription/plans${suffix}`)
  return (response.data.plans || []).map(normalizeSubscriptionPlan)
}

export async function listPublicSubscriptionPlans() {
  const response = await signedRequest<{ plans: any[] }>('GET', '/user/subscription/plans')
  return (response.data.plans || []).map(normalizeSubscriptionPlan)
}

export async function createSubscriptionPlan(data: {
  name: string
  code: string
  description?: string
  storageBytes: number
  trafficBytes: number
  objectQuota: number
  durationDays: number
  priceCents: number
  status: string
}) {
  const response = await signedRequest<{ plan: any }>('POST', '/admin/subscription/plans', data)
  return normalizeSubscriptionPlan(response.data.plan)
}

export async function updateSubscriptionPlan(id: number, data: {
  name: string
  code: string
  description?: string
  storageBytes: number
  trafficBytes: number
  objectQuota: number
  durationDays: number
  priceCents: number
  status: string
}) {
  const response = await signedRequest<{ plan: any }>('PUT', `/admin/subscription/plans/${id}`, data)
  return normalizeSubscriptionPlan(response.data.plan)
}

export async function listResourcePackCodes(limit = 100) {
  const response = await signedRequest<{ codes: any[] }>('GET', `/admin/resource-pack-codes?limit=${limit}`)
  return (response.data.codes || []).map(normalizeResourcePackCode)
}

export async function createResourcePackCodes(data: {
  planId?: number
  label?: string
  code?: string
  storageBytes?: number
  trafficBytes?: number
  objectQuota?: number
  durationDays?: number
  expiresAt?: string
  quantity?: number
}) {
  const response = await signedRequest<{ codes: any[] }>('POST', '/admin/resource-pack-codes', data)
  return (response.data.codes || []).map(normalizeResourcePackCode)
}

export async function getMySubscriptionProfile() {
  try {
    const response = await signedRequest<{ profile: any }>('GET', '/user/subscription/profile')
    return normalizeSubscriptionProfile(response.data.profile)
  } catch (error: any) {
    if (error?.response?.status === 500) {
      return {
        activePlans: [],
        totalStorageBytes: 0,
        totalTrafficBytes: 0,
        totalObjectQuota: 0,
        expiresAt: null,
      }
    }
    throw error
  }
}

export async function redeemResourcePackCode(code: string) {
  const response = await signedRequest<{ profile?: any; subscription?: any; code?: any }>('POST', '/user/subscription/redeem', { code })
  return {
    profile: normalizeSubscriptionProfile(response.data.profile),
    subscription: response.data.subscription ? normalizeUserSubscription(response.data.subscription) : undefined,
    code: response.data.code ? normalizeResourcePackCode(response.data.code) : undefined,
  }
}

export async function createUser(data: {
  username: string
  password: string
  displayName?: string
  email?: string
  isAdmin?: boolean
  roleIds?: number[]
  bucketNames?: string[]
}) {
  const response = await signedRequest('POST', '/admin/users', data)
  return {
    ...response.data,
    user: response.data?.user ? normalizeUser(response.data.user) : undefined,
  }
}

export async function updateUser(id: number, data: {
  password?: string
  displayName?: string
  email?: string
  status?: string
  isAdmin?: boolean
  roleIds?: number[]
}) {
  const response = await signedRequest('PUT', `/admin/users/${id}`, data)
  return {
    ...response.data,
    user: response.data?.user ? normalizeUser(response.data.user) : undefined,
  }
}

export async function deleteUser(id: number) {
  const response = await signedRequest('DELETE', `/admin/users/${id}`)
  return response.data
}

export async function listRoles() {
  const response = await signedRequest<RoleRecord[]>('GET', '/admin/roles')
  return (response.data || []).map(normalizeRole)
}

export async function createRole(data: {
  name: string
  description?: string
  permissions?: string[]
}) {
  const response = await signedRequest<RoleRecord>('POST', '/admin/roles', data)
  return normalizeRole(response.data)
}

export async function updateRole(id: number, data: {
  name: string
  description?: string
  permissions?: string[]
}) {
  const response = await signedRequest<RoleRecord>('PUT', `/admin/roles/${id}`, data)
  return normalizeRole(response.data)
}

export async function deleteRole(id: number) {
  const response = await signedRequest('DELETE', `/admin/roles/${id}`)
  return response.data
}

export async function listAdminBuckets() {
  const response = await signedRequest<BucketAdminRecord[]>('GET', '/admin/buckets')
  return (response.data || []).map(normalizeBucket)
}

export async function updateAdminBucket(id: number, data: {
  defaultExpiry?: string
  maxSizeBytes?: number
  maxTrafficBytes?: number
  maxObjects?: number
  acl?: string
}) {
  const response = await signedRequest<BucketAdminRecord>('PUT', `/admin/buckets/${id}`, data)
  return normalizeBucket(response.data)
}

export async function listBucketAccess(bucketId: number) {
  const response = await signedRequest<BucketAccessRecord[]>('GET', `/admin/buckets/${bucketId}/access`)
  return (response.data || []).map(normalizeBucketAccess)
}

export async function upsertBucketAccess(bucketId: number, data: { userId: number; permission: string }) {
  const response = await signedRequest('POST', `/admin/buckets/${bucketId}/access`, data)
  return response.data
}

export async function deleteBucketAccess(bucketId: number, userId: number) {
  const response = await signedRequest('DELETE', `/admin/buckets/${bucketId}/access/${userId}`)
  return response.data
}

export async function createCredential(data: {
  userId: number
  description?: string
  expiresAt?: string | null
}) {
  const response = await signedRequest('POST', '/admin/credentials', data)
  return {
    ...response.data,
    credential: response.data?.credential ? normalizeCredential(response.data.credential) : undefined,
  }
}

export async function updateCredential(id: number, data: {
  description?: string
  status?: string
  expiresAt?: string | null
}) {
  const response = await signedRequest('PUT', `/admin/credentials/${id}`, data)
  return {
    ...response.data,
    credential: response.data?.credential ? normalizeCredential(response.data.credential) : undefined,
  }
}

export async function deleteCredential(id: number) {
  const response = await signedRequest('DELETE', `/admin/credentials/${id}`)
  return response.data
}

export async function listCredentials(userId?: number) {
  const users = await listUsers()
  const credentialTasks = users
    .filter((item) => !userId || item.id === userId)
    .map(async (item) => {
      try {
        const response = await signedRequest<CredentialRecord[]>('GET', `/admin/users/${item.id}/credentials`)
        return (response.data || []).map((credential) => ({
          ...normalizeCredential(credential),
          userId: item.id,
        }))
      } catch {
        return [] as CredentialRecord[]
      }
    })

  const groups = await Promise.all(credentialTasks)
  return groups.flat()
}

export async function listTickets(scope: 'user' | 'admin' = 'user', params?: {
  status?: string
  category?: string
  priority?: string
}) {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.category) query.set('category', params.category)
  if (params?.priority) query.set('priority', params.priority)
  const prefix = scope === 'admin' ? '/admin/tickets' : '/user/tickets'
  const response = await signedRequest<TicketRecord[]>('GET', `${prefix}${query.toString() ? `?${query.toString()}` : ''}`)
  return (response.data || []).map(normalizeTicket)
}

export async function getTicket(id: number, scope: 'user' | 'admin' = 'user') {
  const prefix = scope === 'admin' ? '/admin/tickets' : '/user/tickets'
  const response = await signedRequest<{ ticket: TicketRecord; messages: TicketMessageRecord[] }>('GET', `${prefix}/${id}`)
  return {
    ticket: normalizeTicket(response.data.ticket),
    messages: (response.data.messages || []).map(normalizeTicketMessage),
  }
}

export async function createTicket(data: {
  title: string
  description: string
  category?: string
  priority?: string
  bucketId?: number | null
}) {
  const response = await signedRequest<TicketRecord>('POST', '/user/tickets', data)
  return normalizeTicket(response.data)
}

export async function updateTicket(id: number, data: {
  status?: string
  priority?: string
  category?: string
  assigneeId?: number | null
  description?: string
}, scope: 'user' | 'admin' = 'user') {
  const prefix = scope === 'admin' ? '/admin/tickets' : '/user/tickets'
  const response = await signedRequest<TicketRecord>('PUT', `${prefix}/${id}`, data)
  return normalizeTicket(response.data)
}

export async function createTicketMessage(id: number, data: {
  message: string
  isInternal?: boolean
}, scope: 'user' | 'admin' = 'user') {
  const prefix = scope === 'admin' ? '/admin/tickets' : '/user/tickets'
  const response = await signedRequest('POST', `${prefix}/${id}/messages`, data)
  return response.data
}

export async function getPresignedUrl(bucket: string, key: string, expiresInSeconds?: number) {
  const params = new URLSearchParams({
    bucket,
    key,
    method: 'GET',
  })
  if (expiresInSeconds) {
    params.set('expiresInSeconds', String(expiresInSeconds))
  }
  const response = await signedRequest<{ url: string }>('GET', `/user/presign?${params.toString()}`)
  return response.data.url
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
