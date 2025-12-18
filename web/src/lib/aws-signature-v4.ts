// AWS Signature V4 实现
// 参考: https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

interface SignatureParams {
  method: string
  url: string
  headers: Record<string, string>
  body?: string | ArrayBuffer | null
  accessKey: string
  secretKey: string
  region?: string
  service?: string
}

// SHA256 哈希
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// HMAC-SHA256
async function hmacSha256(key: Uint8Array | string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const messageData = encoder.encode(message)
  
  // @ts-ignore - Uint8Array is compatible with BufferSource at runtime
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return new Uint8Array(signature)
}

// 生成签名密钥
async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<Uint8Array> {
  const kDate = await hmacSha256('AWS4' + secretKey, dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  return kSigning
}

// 规范化 URI
function canonicalUri(pathname: string): string {
  if (!pathname || pathname === '') return '/'
  // 对路径进行 URI 编码，但保留斜杠
  return pathname.split('/').map(segment => 
    encodeURIComponent(decodeURIComponent(segment))
  ).join('/')
}

// 规范化查询字符串
function canonicalQueryString(searchParams: URLSearchParams): string {
  const params: [string, string][] = []
  searchParams.forEach((value, key) => {
    params.push([encodeURIComponent(key), encodeURIComponent(value)])
  })
  params.sort((a, b) => {
    if (a[0] < b[0]) return -1
    if (a[0] > b[0]) return 1
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0
  })
  return params.map(([key, value]) => `${key}=${value}`).join('&')
}

// 规范化请求头
function canonicalHeaders(headers: Record<string, string>): string {
  const canonical: string[] = []
  const headerKeys = Object.keys(headers).map(k => k.toLowerCase()).sort()
  
  for (const key of headerKeys) {
    const value = headers[key] || headers[key.toLowerCase()] || ''
    canonical.push(`${key}:${value.trim()}\n`)
  }
  
  return canonical.join('')
}

// 获取签名的请求头列表
function signedHeaders(headers: Record<string, string>): string {
  return Object.keys(headers).map(k => k.toLowerCase()).sort().join(';')
}

// 生成 AWS Signature V4
export async function signRequest(params: SignatureParams): Promise<Record<string, string>> {
  const {
    method,
    url,
    headers: originalHeaders,
    body,
    accessKey,
    secretKey,
    region = 'us-east-1',
    service = 's3'
  } = params

  const parsedUrl = new URL(url)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  // 计算 payload hash
  let payloadHash: string
  if (body === null || body === undefined) {
    payloadHash = await sha256('')
  } else if (typeof body === 'string') {
    payloadHash = await sha256(body)
  } else {
    // 对于二进制数据，使用 UNSIGNED-PAYLOAD
    payloadHash = 'UNSIGNED-PAYLOAD'
  }

  // 构建请求头
  const headers: Record<string, string> = {
    ...originalHeaders,
    'host': parsedUrl.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash
  }

  // 构建规范请求
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(parsedUrl.pathname),
    canonicalQueryString(parsedUrl.searchParams),
    canonicalHeaders(headers),
    signedHeaders(headers),
    payloadHash
  ].join('\n')

  // 计算规范请求的哈希
  const canonicalRequestHash = await sha256(canonicalRequest)

  // 构建待签名字符串
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n')

  // 计算签名
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service)
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = Array.from(signatureBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 构建 Authorization 头
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders(headers)}, Signature=${signature}`

  // 返回签名头部（不包含 Host，浏览器会自动设置）
  return {
    'Authorization': authorization,
    'X-Amz-Date': amzDate,
    'X-Amz-Content-Sha256': payloadHash
  }
}

// 便捷函数：为 axios 请求生成签名头
export async function getSignedHeaders(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string,
  body?: any,
  additionalHeaders?: Record<string, string>
): Promise<Record<string, string>> {
  const headers = additionalHeaders || {}
  
  // 对于 File/Blob 等二进制数据，直接传递原始对象
  // signRequest 会将其处理为 UNSIGNED-PAYLOAD
  let requestBody: string | ArrayBuffer | null = null
  if (typeof body === 'string') {
    requestBody = body
  } else if (body instanceof File || body instanceof Blob || body instanceof ArrayBuffer) {
    requestBody = body
  } else if (body !== null && body !== undefined) {
    requestBody = JSON.stringify(body)
  }
  
  const signedHeaders = await signRequest({
    method,
    url,
    headers,
    body: requestBody,
    accessKey,
    secretKey,
    region: 'us-east-1',
    service: 's3'
  })

  return {
    ...headers,
    ...signedHeaders
  }
}
