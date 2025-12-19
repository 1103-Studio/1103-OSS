// AWS Signature V4 实现
// 参考: https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html

interface SignatureParams {
  method: string
  url: string
  headers: Record<string, string>
  body?: string | ArrayBuffer | Blob | null
  accessKey: string
  secretKey: string
  region?: string
  service?: string
}

// SHA256 哈希
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// HMAC-SHA256
export async function hmacSha256(key: Uint8Array | string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const messageData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData as BufferSource)
  const signatureArray = Array.from(new Uint8Array(signature))
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 生成签名密钥（内部使用，返回 Uint8Array）
async function hmacSha256Bytes(key: Uint8Array | string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const messageData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData as BufferSource)
  return new Uint8Array(signature)
}

// 生成签名密钥
async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<Uint8Array> {
  const kDate = await hmacSha256Bytes('AWS4' + secretKey, dateStamp)
  const kRegion = await hmacSha256Bytes(kDate, region)
  const kService = await hmacSha256Bytes(kRegion, service)
  const kSigning = await hmacSha256Bytes(kService, 'aws4_request')
  return kSigning
}

// 规范化 URI
function canonicalUri(pathname: string): string {
  if (!pathname || pathname === '') return '/'
  // 直接使用传入的路径，因为调用方已经正确编码过了
  // 不要做双重编码/解码，否则会导致签名不匹配
  return pathname
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
  
  // 创建一个小写key到原始value的映射
  const lowerCaseHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    lowerCaseHeaders[key.toLowerCase()] = value
  }
  
  // 获取所有小写的key并排序
  const headerKeys = Object.keys(lowerCaseHeaders).sort()
  
  for (const key of headerKeys) {
    const value = lowerCaseHeaders[key] || ''
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

  // 获取路径：parsedUrl.pathname 会自动解码，所以我们需要手动提取原始编码的路径
  // URL 格式：http://host:port/path?query
  const urlStr = url
  const schemeEnd = urlStr.indexOf('://') + 3
  const pathStart = urlStr.indexOf('/', schemeEnd)
  const queryStart = urlStr.indexOf('?', pathStart)
  const hashStart = urlStr.indexOf('#', pathStart)
  
  let pathname: string
  if (pathStart === -1) {
    pathname = '/'
  } else if (queryStart > 0) {
    pathname = urlStr.substring(pathStart, queryStart)
  } else if (hashStart > 0) {
    pathname = urlStr.substring(pathStart, hashStart)
  } else {
    pathname = urlStr.substring(pathStart)
  }

  // 调试输出
  console.log('Frontend URL:', urlStr)
  console.log('Frontend pathname:', pathname)

  // 构建规范请求
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(pathname),
    canonicalQueryString(parsedUrl.searchParams),
    canonicalHeaders(headers),
    signedHeaders(headers),
    payloadHash
  ].join('\n')

  // 调试输出
  console.log('Frontend CanonicalRequest:')
  console.log(canonicalRequest)

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
  const encoder = new TextEncoder()
  const signatureArrayBuffer = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      signingKey as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    encoder.encode(stringToSign) as BufferSource
  )
  const signature = Array.from(new Uint8Array(signatureArrayBuffer))
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
  let requestBody: string | ArrayBuffer | Blob | null = null
  if (typeof body === 'string') {
    requestBody = body
  } else if (body instanceof File || body instanceof Blob || body instanceof ArrayBuffer) {
    requestBody = body as ArrayBuffer | Blob
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
