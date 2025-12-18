import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, X, Info, Copy, Check, Lock, Unlock } from 'lucide-react'
import { listBuckets, createBucket, deleteBucket } from '../lib/api'
import { getSignedHeaders } from '../lib/aws-signature-v4'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function Buckets() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<{ Name: string; CreationDate: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false)
  const [bucketPolicies, setBucketPolicies] = useState<Record<string, boolean>>({})
  const [togglingBucket, setTogglingBucket] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['buckets'],
    queryFn: async () => {
      const result = await listBuckets()
      console.log('🔍 ListBuckets API Response:', result)
      console.log('🔍 Buckets data:', result?.ListAllMyBucketsResult?.Buckets?.Bucket)
      
      // 获取每个 bucket 的权限状态
      const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || []
      const policies: Record<string, boolean> = {}
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      
      for (const bucket of buckets) {
        try {
          const headers = await getSignedHeaders(
            'GET',
            `http://localhost:9000/${bucket.Name}?policy`,
            creds.accessKey,
            creds.secretKey
          )
          const response = await axios.get(`http://localhost:9000/${bucket.Name}?policy`, { headers })
          policies[bucket.Name] = response.data?.Statement?.some((s: any) => 
            s.Effect === 'Allow' && s.Principal === '*' && 
            (s.Action === 's3:GetObject' || s.Action?.includes('s3:GetObject'))
          ) || false
        } catch (err) {
          policies[bucket.Name] = false
        }
      }
      
      setBucketPolicies(policies)
      return result
    },
  })

  const createMutation = useMutation({
    mutationFn: createBucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] })
      setShowCreateModal(false)
      setNewBucketName('')
      toast.success('Bucket created successfully')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create bucket')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] })
      toast.success('Bucket deleted successfully')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete bucket')
    },
  })

  const buckets = data?.ListAllMyBucketsResult?.Buckets?.Bucket || []
  
  console.log('🎯 Final buckets array:', buckets)
  console.log('🎯 Is loading:', isLoading)
  console.log('🎯 Error:', error)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBucketName.trim()) return
    createMutation.mutate(newBucketName.trim().toLowerCase())
  }

  const handleDelete = (name: string) => {
    if (confirm(`Are you sure you want to delete bucket "${name}"?`)) {
      deleteMutation.mutate(name)
    }
  }

  const handleShowInfo = async (bucket: { Name: string; CreationDate: string }) => {
    setSelectedBucket(bucket)
    setShowInfoModal(true)
    
    // 检查 bucket 是否公开
    try {
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      const headers = await getSignedHeaders(
        'GET',
        `http://localhost:9000/${bucket.Name}?policy`,
        creds.accessKey,
        creds.secretKey
      )
      const response = await axios.get(`http://localhost:9000/${bucket.Name}?policy`, { headers })
      // 如果有 policy 且包含公开读，设置为 true
      setIsPublic(response.data?.Statement?.some((s: any) => 
        s.Effect === 'Allow' && s.Principal === '*' && 
        (s.Action === 's3:GetObject' || s.Action?.includes('s3:GetObject'))
      ) || false)
    } catch (err) {
      // 没有 policy 或访问失败，默认私有
      setIsPublic(false)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Buckets</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Bucket
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : buckets.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No buckets yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first bucket to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create Bucket
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buckets.map((bucket: { Name: string; CreationDate: string }) => (
            <div key={bucket.Name} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <Link
                  to={`/buckets/${bucket.Name}`}
                  className="flex items-center flex-1 min-w-0"
                >
                  <FolderOpen className="w-10 h-10 text-primary-500 dark:text-primary-400 flex-shrink-0" />
                  <div className="ml-3 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{bucket.Name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Created: {new Date(bucket.CreationDate).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  {/* 权限状态显示 */}
                  <div className="flex items-center gap-2">
                    {bucketPolicies[bucket.Name] ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                        <Unlock className="w-3 h-3" />
                        Public
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                        <Lock className="w-3 h-3" />
                        Private
                      </span>
                    )}
                    
                    {/* 快速切换按钮 */}
                    <button
                      onClick={async () => {
                        if (togglingBucket === bucket.Name) return
                        
                        setTogglingBucket(bucket.Name)
                        try {
                          const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
                          const isCurrentlyPublic = bucketPolicies[bucket.Name]
                          
                          if (!isCurrentlyPublic) {
                            // 设置为公开
                            const policy = {
                              Version: '2012-10-17',
                              Statement: [{
                                Effect: 'Allow',
                                Principal: '*',
                                Action: 's3:GetObject',
                                Resource: `arn:aws:s3:::${bucket.Name}/*`
                              }]
                            }
                            const headers = await getSignedHeaders(
                              'PUT',
                              `http://localhost:9000/${bucket.Name}?policy`,
                              creds.accessKey,
                              creds.secretKey,
                              JSON.stringify(policy)
                            )
                            await axios.put(
                              `http://localhost:9000/${bucket.Name}?policy`,
                              JSON.stringify(policy),
                              { 
                                headers,
                                validateStatus: (status) => status < 500
                              }
                            )
                            setBucketPolicies(prev => ({ ...prev, [bucket.Name]: true }))
                            toast.success(`${bucket.Name} 已设为公开`)
                          } else {
                            // 设置为私有
                            const headers = await getSignedHeaders(
                              'DELETE',
                              `http://localhost:9000/${bucket.Name}?policy`,
                              creds.accessKey,
                              creds.secretKey
                            )
                            await axios.delete(
                              `http://localhost:9000/${bucket.Name}?policy`,
                              { 
                                headers,
                                validateStatus: (status) => status < 500
                              }
                            )
                            setBucketPolicies(prev => ({ ...prev, [bucket.Name]: false }))
                            toast.success(`${bucket.Name} 已设为私有`)
                          }
                        } catch (err: any) {
                          console.error('Toggle policy error:', err)
                          const message = err.response?.data?.message || err.message || '切换失败'
                          toast.error(`切换失败: ${message}`)
                        } finally {
                          setTogglingBucket(null)
                        }
                      }}
                      disabled={togglingBucket === bucket.Name}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
                      title={bucketPolicies[bucket.Name] ? '切换为私有' : '切换为公开'}
                    >
                      {togglingBucket === bucket.Name ? (
                        <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      ) : bucketPolicies[bucket.Name] ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  <div className="flex gap-1 border-l border-gray-200 dark:border-gray-700 pl-2">
                    <button
                      onClick={() => handleShowInfo(bucket)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
                      title="View bucket info"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(bucket.Name)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete bucket"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bucket Info Modal */}
      {showInfoModal && selectedBucket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bucket Information</h2>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Bucket Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bucket Name
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white">
                    {selectedBucket.Name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(selectedBucket.Name, 'name')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === 'name' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* API Endpoint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Endpoint
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white break-all">
                    http://localhost:9000/{selectedBucket.Name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`http://localhost:9000/${selectedBucket.Name}`, 'endpoint')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === 'endpoint' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* S3 Endpoint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  S3 Compatible Endpoint
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white break-all">
                    s3://localhost:9000/{selectedBucket.Name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`s3://localhost:9000/${selectedBucket.Name}`, 's3endpoint')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === 's3endpoint' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Storage Path */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Server Storage Path
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white break-all">
                    /data/oss/buckets/{selectedBucket.Name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`/data/oss/buckets/${selectedBucket.Name}`, 'path')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === 'path' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Creation Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Created At
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-900 dark:text-white">
                  {new Date(selectedBucket.CreationDate).toLocaleString()}
                </div>
              </div>

              {/* 权限设置 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Access Permission
                </label>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Unlock className="w-5 h-5 text-green-500" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {isPublic ? 'Public Read' : 'Private'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isPublic ? '任何人可直接访问对象' : '需要签名认证访问'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      setIsUpdatingPolicy(true)
                      try {
                        const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
                        if (!isPublic) {
                          // 设置为公开读
                          const policy = {
                            Version: '2012-10-17',
                            Statement: [{
                              Effect: 'Allow',
                              Principal: '*',
                              Action: 's3:GetObject',
                              Resource: `arn:aws:s3:::${selectedBucket?.Name}/*`
                            }]
                          }
                          const headers = await getSignedHeaders(
                            'PUT',
                            `http://localhost:9000/${selectedBucket?.Name}?policy`,
                            creds.accessKey,
                            creds.secretKey,
                            JSON.stringify(policy)
                          )
                          await axios.put(
                            `http://localhost:9000/${selectedBucket?.Name}?policy`,
                            JSON.stringify(policy),
                            { headers }
                          )
                          setIsPublic(true)
                          toast.success('已设置为公开读')
                        } else {
                          // 设置为私有（删除 policy）
                          const headers = await getSignedHeaders(
                            'DELETE',
                            `http://localhost:9000/${selectedBucket?.Name}?policy`,
                            creds.accessKey,
                            creds.secretKey
                          )
                          await axios.delete(
                            `http://localhost:9000/${selectedBucket?.Name}?policy`,
                            { headers }
                          )
                          setIsPublic(false)
                          toast.success('已设置为私有')
                        }
                      } catch (err: any) {
                        toast.error(err.message || '设置失败')
                      } finally {
                        setIsUpdatingPolicy(false)
                      }
                    }}
                    disabled={isUpdatingPolicy}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isUpdatingPolicy ? '处理中...' : `切换为${isPublic ? '私有' : '公开读'}`}
                  </button>
                </div>
              </div>

              {/* Usage Example */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AWS CLI Example
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white break-all">
                    aws s3 ls s3://{selectedBucket.Name} --endpoint-url=http://localhost:9000
                  </code>
                  <button
                    onClick={() => copyToClipboard(`aws s3 ls s3://${selectedBucket.Name} --endpoint-url=http://localhost:9000`, 'cli')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === 'cli' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Bucket</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bucket Name
                </label>
                <input
                  type="text"
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  className="input"
                  placeholder="my-bucket"
                  pattern="[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]"
                  title="Bucket name must be 3-63 characters, lowercase letters, numbers, and hyphens"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  3-63 characters, lowercase letters, numbers, and hyphens only
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
