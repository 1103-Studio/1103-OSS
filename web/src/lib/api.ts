import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

// 获取凭证
function getCredentials() {
  const stored = localStorage.getItem('oss_credentials')
  if (stored) {
    return JSON.parse(stored)
  }
  return null
}

// 简化的签名 (实际生产环境需要完整的 AWS Signature V4)
function generateAuthHeader(method: string, path: string) {
  const creds = getCredentials()
  if (!creds) return {}

  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  
  return {
    'X-Amz-Date': date,
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'Authorization': `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${date.slice(0, 8)}/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=placeholder`
  }
}

// Bucket 操作
export async function listBuckets() {
  const headers = generateAuthHeader('GET', '/')
  const response = await api.get('/', { headers })
  return response.data
}

export async function createBucket(name: string) {
  const headers = generateAuthHeader('PUT', `/${name}`)
  await api.put(`/${name}`, null, { headers })
}

export async function deleteBucket(name: string) {
  const headers = generateAuthHeader('DELETE', `/${name}`)
  await api.delete(`/${name}`, { headers })
}

// Object 操作
export async function listObjects(bucket: string, prefix = '', delimiter = '/') {
  const headers = generateAuthHeader('GET', `/${bucket}`)
  const params = new URLSearchParams()
  if (prefix) params.set('prefix', prefix)
  if (delimiter) params.set('delimiter', delimiter)
  
  const response = await api.get(`/${bucket}?${params.toString()}`, { headers })
  return response.data
}

export async function uploadObject(bucket: string, key: string, file: File, onProgress?: (percent: number) => void) {
  const headers = {
    ...generateAuthHeader('PUT', `/${bucket}/${key}`),
    'Content-Type': file.type || 'application/octet-stream',
  }
  
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
  const headers = generateAuthHeader('DELETE', `/${bucket}/${key}`)
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
