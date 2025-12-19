import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { 
  File, Folder, Upload, Trash2, Download, ChevronRight, 
  Home, RefreshCw, Share2 
} from 'lucide-react'
import { listObjects, uploadObject, deleteObject, getObjectUrl, getPresignedUrl } from '../lib/api'
import toast from 'react-hot-toast'

export default function Objects() {
  const { bucket, '*': path = '' } = useParams()
  const queryClient = useQueryClient()
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  const prefix = path ? `${path}/` : ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['objects', bucket, prefix],
    queryFn: () => listObjects(bucket!, prefix),
    enabled: !!bucket,
  })

  const deleteMutation = useMutation({
    mutationFn: ({ key }: { key: string }) => deleteObject(bucket!, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucket] })
      toast.success('Object deleted')
    },
    onError: () => {
      toast.error('Failed to delete object')
    },
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const key = prefix + file.name
      setUploadProgress(prev => ({ ...prev, [key]: 0 }))
      
      try {
        await uploadObject(bucket!, key, file, (percent) => {
          setUploadProgress(prev => ({ ...prev, [key]: percent }))
        })
        toast.success(`Uploaded ${file.name}`)
      } catch {
        toast.error(`Failed to upload ${file.name}`)
      } finally {
        setUploadProgress(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
    }
    refetch()
  }, [bucket, prefix, refetch])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  const objects = data?.ListBucketResult?.Contents || []
  const prefixes = data?.ListBucketResult?.CommonPrefixes || []

  const handleDelete = (key: string) => {
    if (confirm(`Delete "${key}"?`)) {
      deleteMutation.mutate({ key })
    }
  }

  const handleDownload = async (key: string) => {
    try {
      const url = await getPresignedUrl(bucket!, key)
      window.open(url, '_blank')
    } catch (error) {
      toast.error('生成下载链接失败')
      console.error('Failed to generate download URL:', error)
    }
  }

  const handleShare = async (key: string) => {
    try {
      const url = await getPresignedUrl(bucket!, key)
      await navigator.clipboard.writeText(url)
      toast.success('分享链接已复制到剪贴板（有效期7天）')
    } catch (error) {
      toast.error('生成分享链接失败')
      console.error('Failed to generate presigned URL:', error)
    }
  }

  // Build breadcrumb
  const pathParts = path ? path.split('/').filter(Boolean) : []
  const breadcrumbs = [
    { name: bucket!, path: `/buckets/${bucket}` },
    ...pathParts.map((part, i) => ({
      name: part,
      path: `/buckets/${bucket}/${pathParts.slice(0, i + 1).join('/')}`
    }))
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center text-sm">
          <Link to="/buckets" className="text-gray-500 hover:text-gray-700">
            <Home className="w-4 h-4" />
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900">{crumb.name}</span>
              ) : (
                <Link to={crumb.path} className="text-gray-500 hover:text-gray-700">
                  {crumb.name}
                </Link>
              )}
            </span>
          ))}
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`card p-8 mb-6 border-2 border-dashed text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">
          {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
        </p>
      </div>

      {/* Upload Progress */}
      {Object.entries(uploadProgress).map(([key, progress]) => (
        <div key={key} className="card p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium truncate">{key}</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ))}

      {/* Objects List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Size</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Modified</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Folders */}
              {prefixes.map((p: { Prefix: string }) => {
                const folderName = p.Prefix.replace(prefix, '').replace(/\/$/, '')
                return (
                  <tr key={p.Prefix} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/buckets/${bucket}/${p.Prefix.replace(/\/$/, '')}`}
                        className="flex items-center text-primary-600 hover:text-primary-700"
                      >
                        <Folder className="w-5 h-5 mr-3 text-yellow-500" />
                        {folderName}/
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">-</td>
                    <td className="px-4 py-3 text-gray-500">-</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                )
              })}
              {/* Files */}
              {objects.map((obj: { Key: string; Size: number; LastModified: string }) => {
                const fileName = obj.Key.replace(prefix, '')
                if (!fileName) return null
                return (
                  <tr key={obj.Key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <File className="w-5 h-5 mr-3 text-gray-400" />
                        <span className="truncate">{fileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatSize(obj.Size)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(obj.LastModified).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleShare(obj.Key)}
                        className="p-1 text-gray-400 hover:text-blue-500 mr-2"
                        title="复制分享链接（有效期7天）"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDownload(obj.Key)}
                        className="p-1 text-gray-400 hover:text-primary-500 mr-2"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(obj.Key)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {prefixes.length === 0 && objects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No objects in this location
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
