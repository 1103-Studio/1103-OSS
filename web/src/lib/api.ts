import axios from 'axios'
import { getSignedHeaders } from './aws-signature-v4'

// 直接连接到后端 API，不使用代理
// 这样可以确保签名的 host 与实际请求的 host 一致
const api = axios.create({
  baseURL: 'http://localhost:9000',
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

// Bucket 操作
export async function listBuckets() {
  const headers = await generateAuthHeader('GET', '/')
  const response = await api.get('/', { headers })
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
  
  const response = await api.get(path, { headers })
  return response.data
}

export async function uploadObject(bucket: string, key: string, file: File, onProgress?: (percent: number) => void) {
  const additionalHeaders = {
    'Content-Type': file.type || 'application/octet-stream',
  }
  
  const headers = await generateAuthHeader('PUT', `/${bucket}/${key}`, file, additionalHeaders)
  
  await api.put(`/${bucket}/${key}`, file, {
    headers,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
}

export async function deleteObject(bucket: string, key: string) {
  const headers = await generateAuthHeader('DELETE', `/${bucket}/${key}`)
  await api.delete(`/${bucket}/${key}`, { headers })
}

export async function getObjectUrl(bucket: string, key: string) {
  return `/api/${bucket}/${key}`
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
