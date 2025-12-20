import axios from 'axios'
import { getSignedHeaders } from './aws-signature-v4'

// API 地址配置
// 优先级：环境变量 > 当前域名同端口 > localhost
const getApiBaseUrl = () => {
  // Vite 环境变量
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // 生产环境：使用当前域名的 9000 端口
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    return `${protocol}//${hostname}:9000`
  }
  
  // 开发环境：使用 localhost
  return 'http://localhost:9000'
}

export const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
})

// 获取凭证
function getCredentials() {
  const stored = localStorage.getItem('oss_credentials')
  if (stored) {
    return JSON.parse(stored)
  }
  return null
}

// 生成签名的请求头
async function generateAuthHeader(method: string, path: string, body?: any, additionalHeaders?: Record<string, string>) {
  const creds = getCredentials()
  if (!creds) return {}

  // 使用实际的后端 URL 进行签名，而不是代理路径
  // 签名必须基于实际的服务器地址
  const signUrl = `${creds.endpoint}${path}`
  
  try {
    const headers = await getSignedHeaders(
      method,
      signUrl,
      creds.accessKey,
      creds.secretKey,
      body,
      additionalHeaders
    )
    
    // 移除 Host 头部，让浏览器自动设置
    // 浏览器会根据实际请求的 URL 设置正确的 Host
    delete headers['Host']
    
    return headers
  } catch (error) {
    console.error('Failed to generate signature:', error)
    return {}
  }
}

// 解析 ListBuckets XML 响应
function parseListBucketsXML(xmlString: string) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
  
  const bucketsElement = xmlDoc.querySelector('Buckets')
  if (!bucketsElement) {
    return { ListAllMyBucketsResult: { Buckets: { Bucket: [] } } }
  }
  
  const bucketElements = bucketsElement.querySelectorAll('Bucket')
  const buckets = Array.from(bucketElements).map(bucket => {
    return {
      Name: bucket.querySelector('Name')?.textContent || '',
      CreationDate: bucket.querySelector('CreationDate')?.textContent || ''
    }
  })
  
  return {
    ListAllMyBucketsResult: {
      Buckets: {
        Bucket: buckets
      }
    }
  }
}

// 解析 ListObjects XML 响应
function parseListObjectsXML(xmlString: string) {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml')
  
  const contentsElements = xmlDoc.querySelectorAll('Contents')
  const contents = Array.from(contentsElements).map(content => {
    return {
      Key: content.querySelector('Key')?.textContent || '',
      LastModified: content.querySelector('LastModified')?.textContent || '',
      ETag: content.querySelector('ETag')?.textContent || '',
      Size: parseInt(content.querySelector('Size')?.textContent || '0'),
      StorageClass: content.querySelector('StorageClass')?.textContent || 'STANDARD'
    }
  })
  
  const prefixElements = xmlDoc.querySelectorAll('CommonPrefixes')
  const commonPrefixes = Array.from(prefixElements).map(prefix => {
    return {
      Prefix: prefix.querySelector('Prefix')?.textContent || ''
    }
  })
  
  return {
    ListBucketResult: {
      Name: xmlDoc.querySelector('Name')?.textContent || '',
      Prefix: xmlDoc.querySelector('Prefix')?.textContent || '',
      Marker: xmlDoc.querySelector('Marker')?.textContent || '',
      MaxKeys: parseInt(xmlDoc.querySelector('MaxKeys')?.textContent || '1000'),
      Delimiter: xmlDoc.querySelector('Delimiter')?.textContent || '',
      IsTruncated: xmlDoc.querySelector('IsTruncated')?.textContent === 'true',
      Contents: contents,
      CommonPrefixes: commonPrefixes
    }
  }
}

// Bucket 操作
export async function listBuckets() {
  const headers = await generateAuthHeader('GET', '/')
  const response = await api.get('/', { 
    headers,
    responseType: 'text'
  })
  
  // 如果响应是 XML 字符串，解析它
  if (typeof response.data === 'string' && response.data.includes('<ListAllMyBucketsResult')) {
    return parseListBucketsXML(response.data)
  }
  
  return response.data
}

export async function createBucket(name: string) {
  const headers = await generateAuthHeader('PUT', `/${name}`)
  await api.put(`/${name}`, null, { headers })
}

export async function deleteBucket(name: string) {
  const headers = await generateAuthHeader('DELETE', `/${name}`)
  await api.delete(`/${name}`, { headers })
}

// Object 操作
export async function listObjects(bucket: string, prefix = '', delimiter = '/') {
  const params = new URLSearchParams()
  if (prefix) params.set('prefix', prefix)
  if (delimiter) params.set('delimiter', delimiter)
  
  const path = `/${bucket}${params.toString() ? '?' + params.toString() : ''}`
  const headers = await generateAuthHeader('GET', path)
  
  const response = await api.get(path, { 
    headers,
    responseType: 'text'
  })
  
  // 如果响应是 XML 字符串，解析它
  if (typeof response.data === 'string' && response.data.includes('<ListBucketResult')) {
    return parseListObjectsXML(response.data)
  }
  
  return response.data
}

export async function uploadObject(bucket: string, key: string, file: File, onProgress?: (percent: number) => void) {
  const additionalHeaders = {
    'Content-Type': file.type || 'application/octet-stream',
  }
  
  // 对路径进行编码，确保签名时使用的 URL 和实际请求的 URL 一致
  // axios 会自动编码 URL，所以我们需要在签名时也使用编码后的路径
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const path = `/${bucket}/${encodedKey}`
  
  console.log('=== UPLOAD FILE ===')
  console.log('Bucket:', bucket)
  console.log('Key:', key)
  console.log('Encoded Path:', path)
  console.log('File Type:', file.type)
  
  const headers = await generateAuthHeader('PUT', path, file, additionalHeaders)
  
  console.log('Generated Headers:', headers)
  
  await api.put(path, file, {
    headers,
    onUploadProgress: (e: any) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
}

export async function deleteObject(bucket: string, key: string) {
  // 对路径进行编码
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const path = `/${bucket}/${encodedKey}`
  
  const headers = await generateAuthHeader('DELETE', path)
  await api.delete(path, { headers })
}

export async function getObjectUrl(bucket: string, key: string) {
  return `/api/${bucket}/${key}`
}

// 解析时间格式（如 "7d", "4w", "2h30m"）为秒数
function parseDuration(duration: string): number {
  const regex = /(\d+)([wdhms])/g
  let totalSeconds = 0
  let match
  
  while ((match = regex.exec(duration)) !== null) {
    const value = parseInt(match[1])
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
  
  return totalSeconds || 604800 // 默认7天
}

// 生成预签名 URL（外链分享，有效期从 bucket 配置获取）
export async function getPresignedUrl(bucket: string, key: string, expiresInSeconds?: number) {
  // 如果没有指定过期时间，从 bucket 设置中获取
  if (!expiresInSeconds) {
    try {
      const settings = await getBucketSettings(bucket)
      expiresInSeconds = parseDuration(settings.default_expiry || '7d')
    } catch (error) {
      console.error('Failed to get bucket settings, using default expiry:', error)
      expiresInSeconds = 604800 // 默认7天
    }
  }
  const creds = getCredentials()
  if (!creds) throw new Error('No credentials')
  
  const { sha256 } = await import('./aws-signature-v4')
  
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const path = `/${bucket}/${encodedKey}`
  
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const region = 'us-east-1'
  const service = 's3'
  
  // 构建 Credential Scope
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  
  // 提取文件名用于下载
  const fileName = key.split('/').pop() || 'download'
  
  // 构建查询参数（按字母顺序排序，这很重要）
  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${creds.accessKey}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresInSeconds.toString(),
    'X-Amz-SignedHeaders': 'host',
    'response-content-disposition': `attachment;filename="${encodeURIComponent(fileName)}"`
  }
  
  // 构建规范查询字符串（按字母顺序）
  const sortedKeys = Object.keys(params).sort()
  const canonicalQueryString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  
  // 构建规范请求
  const canonicalRequest = [
    'GET',
    path,
    canonicalQueryString,
    `host:${new URL(creds.endpoint).host}\n`,
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n')
  
  // 构建待签名字符串
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n')
  
  // 计算签名 - 需要使用字节数组进行密钥派生
  const encoder = new TextEncoder()
  let kDate = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      encoder.encode('AWS4' + creds.secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    encoder.encode(dateStamp)
  )
  let kRegion = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      kDate,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    encoder.encode(region)
  )
  let kService = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      kRegion,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    encoder.encode(service)
  )
  let kSigning = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      kService,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    encoder.encode('aws4_request')
  )
  
  // 最后一步使用 kSigning 对 stringToSign 进行签名
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      kSigning,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    encoder.encode(stringToSign)
  )
  
  // 转换为十六进制字符串
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // 构建最终URL
  const finalUrl = `${creds.endpoint}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`
  
  return finalUrl
}

// 获取存储桶设置
export async function getBucketSettings(bucket: string) {
  const path = `/${bucket}?settings`
  const headers = await generateAuthHeader('GET', path)
  const response = await api.get(path, { headers })
  return response.data
}

// 更新存储桶设置
export async function updateBucketSettings(bucket: string, defaultExpiry: string) {
  const path = `/${bucket}?settings`
  const body = { default_expiry: defaultExpiry }
  const headers = await generateAuthHeader('PUT', path, body)
  const response = await api.put(path, body, { headers })
  return response.data
}

// 统计
export async function getStats() {
  // 这里可以添加统计 API
  return {
    totalBuckets: 0,
    totalObjects: 0,
    totalSize: 0,
  }
}

export default api
