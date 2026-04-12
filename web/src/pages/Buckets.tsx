import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, X, Info, Copy, Check, Lock, Unlock, ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import {
  listBuckets,
  createBucket,
  deleteBucket,
  getBucketSettings,
  updateBucketSettings,
  listAllObjects,
  getBucketPublicStatus,
  getStorageEndpoint,
  setBucketPrivate,
  setBucketPublic,
} from '../lib/api'
import toast from 'react-hot-toast'

// Helper function to strip protocol from URL
const stripProtocol = (url: string) => url.replace(/^https?:\/\//, '')

// 目录树节点类型
interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  size?: number
  children?: TreeNode[]
}

// 构建目录树
function buildDirectoryTree(objects: { Key: string; Size: number }[]): TreeNode[] {
  const root: TreeNode[] = []
  
  for (const obj of objects) {
    const parts = obj.Key.split('/').filter(Boolean)
    let currentLevel = root
    let currentPath = ''
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = i === parts.length - 1
      
      let existing = currentLevel.find(n => n.name === part)
      
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          size: isFile ? obj.Size : undefined,
          children: isFile ? undefined : []
        }
        currentLevel.push(existing)
      }
      
      if (!isFile && existing.children) {
        currentLevel = existing.children
      }
    }
  }
  
  // 排序：文件夹在前，然后按名称排序
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    }).map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined
    }))
  }
  
  return sortNodes(root)
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 目录树节点组件
function TreeNodeItem({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2) // 默认展开前两层
  
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0
  
  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {node.type === 'folder' ? (
          <>
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
              )
            ) : (
              <span className="w-4 mr-1" />
            )}
            <Folder className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
          </>
        ) : (
          <>
            <span className="w-4 mr-1" />
            <File className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          </>
        )}
        <span className="text-sm text-gray-900 dark:text-white truncate flex-1">
          {node.name}{node.type === 'folder' ? '/' : ''}
        </span>
        {node.type === 'file' && node.size !== undefined && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {formatSize(node.size)}
          </span>
        )}
      </div>
      {hasChildren && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Buckets() {
  const storageEndpoint = getStorageEndpoint()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<{ Name: string; CreationDate: string } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false)
  const [defaultExpiry, setDefaultExpiry] = useState('7d')
  const [isUpdatingExpiry, setIsUpdatingExpiry] = useState(false)
  const [bucketPolicies, setBucketPolicies] = useState<Record<string, boolean>>({})
  const [togglingBucket, setTogglingBucket] = useState<string | null>(null)
  const [directoryTree, setDirectoryTree] = useState<TreeNode[]>([])
  const [isLoadingTree, setIsLoadingTree] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['buckets'],
    queryFn: async () => {
      const result = await listBuckets()

      // 获取每个 bucket 的权限状态
      const buckets = result?.ListAllMyBucketsResult?.Buckets?.Bucket || []
      const policies = Object.fromEntries(await Promise.all(
        buckets.map(async (bucket: { Name: string }) => [bucket.Name, await getBucketPublicStatus(bucket.Name)] as const)
      ))
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBucketName.trim()) return
    createMutation.mutate(newBucketName.trim().toLowerCase())
  }

  const handleDelete = (name: string) => {
    if (confirm(`确定要删除存储桶 "${name}" 吗？\n\n注意：存储桶必须为空才能删除。如果存储桶中有文件，请先删除所有文件。`)) {
      deleteMutation.mutate(name, {
        onError: (error: any) => {
          if (error.response?.status === 409) {
            toast.error(`无法删除存储桶 "${name}"：存储桶不为空！\n\n请先删除存储桶中的所有对象，然后再尝试删除存储桶。`)
          } else {
            toast.error(`删除存储桶失败: ${error.message}`)
          }
        }
      })
    }
  }

  const handleShowInfo = async (bucket: { Name: string; CreationDate: string }) => {
    setSelectedBucket(bucket)
    setShowInfoModal(true)
  }

  useEffect(() => {
    if (selectedBucket) {
      // 获取 bucket policy 判断是否公开
      const fetchPolicy = async () => {
        setIsPublic(await getBucketPublicStatus(selectedBucket.Name))
      }
      
      // 获取 bucket 设置
      const fetchSettings = async () => {
        try {
          const settings = await getBucketSettings(selectedBucket.Name)
          setDefaultExpiry(settings.default_expiry || '7d')
        } catch (err) {
          setDefaultExpiry('7d')
        }
      }
      
      // 获取目录树
      const fetchDirectoryTree = async () => {
        setIsLoadingTree(true)
        try {
          const result = await listAllObjects(selectedBucket.Name)
          const objects = result?.ListBucketResult?.Contents || []
          const tree = buildDirectoryTree(objects)
          setDirectoryTree(tree)
        } catch (err) {
          console.error('Failed to load directory tree:', err)
          setDirectoryTree([])
        } finally {
          setIsLoadingTree(false)
        }
      }
      
      fetchPolicy()
      fetchSettings()
      fetchDirectoryTree()
    }
  }, [selectedBucket])

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
                          const isCurrentlyPublic = bucketPolicies[bucket.Name]

                          if (!isCurrentlyPublic) {
                            await setBucketPublic(bucket.Name)
                            setBucketPolicies(prev => ({ ...prev, [bucket.Name]: true }))
                            toast.success(`${bucket.Name} 已设为公开`)
                          } else {
                            await setBucketPrivate(bucket.Name)
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
                    {storageEndpoint}/{selectedBucket.Name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${storageEndpoint}/${selectedBucket.Name}`, 'endpoint')}
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
                    s3://{stripProtocol(storageEndpoint)}/{selectedBucket.Name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`s3://${stripProtocol(storageEndpoint)}/${selectedBucket.Name}`, 's3endpoint')}
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
                        if (!isPublic) {
                          await setBucketPublic(selectedBucket.Name)
                          setIsPublic(true)
                          setBucketPolicies(prev => ({ ...prev, [selectedBucket.Name]: true }))
                          toast.success('已设置为公开读')
                        } else {
                          await setBucketPrivate(selectedBucket.Name)
                          setIsPublic(false)
                          setBucketPolicies(prev => ({ ...prev, [selectedBucket.Name]: false }))
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

              {/* 外链时效性设置 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  分享链接默认有效期
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={defaultExpiry}
                    onChange={(e) => setDefaultExpiry(e.target.value)}
                    placeholder="例如: 7d, 4w, 2h30m"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={async () => {
                      setIsUpdatingExpiry(true)
                      try {
                        await updateBucketSettings(selectedBucket.Name, defaultExpiry)
                        toast.success('有效期设置已更新')
                      } catch (err: any) {
                        toast.error(err.response?.data?.Message || '更新失败')
                      } finally {
                        setIsUpdatingExpiry(false)
                      }
                    }}
                    disabled={isUpdatingExpiry}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {isUpdatingExpiry ? '更新中...' : '保存'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  支持格式: w(周) d(天) h(小时) m(分钟) s(秒)，例如 "30s", "5m", "2h30m", "7d"，范围: 10秒-30天
                </p>
              </div>

              {/* 目录结构 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  目录结构
                </label>
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded max-h-64 overflow-y-auto">
                  {isLoadingTree ? (
                    <div className="flex items-center justify-center py-8 text-gray-500">
                      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-2" />
                      加载中...
                    </div>
                  ) : directoryTree.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                      存储桶为空
                    </div>
                  ) : (
                    <div className="py-2">
                      {directoryTree.map((node) => (
                        <TreeNodeItem key={node.path} node={node} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Usage Example */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AWS CLI Example
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white break-all">
                    aws s3 ls s3://{selectedBucket.Name} --endpoint-url={storageEndpoint}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`aws s3 ls s3://${selectedBucket.Name} --endpoint-url=${storageEndpoint}`, 'cli')}
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
