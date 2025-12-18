import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, X } from 'lucide-react'
import { listBuckets, createBucket, deleteBucket } from '../lib/api'
import toast from 'react-hot-toast'

export default function Buckets() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newBucketName, setNewBucketName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['buckets'],
    queryFn: listBuckets,
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
    if (confirm(`Are you sure you want to delete bucket "${name}"?`)) {
      deleteMutation.mutate(name)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Buckets</h1>
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
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No buckets yet</h3>
          <p className="text-gray-500 mb-4">Create your first bucket to get started</p>
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
                  <FolderOpen className="w-10 h-10 text-primary-500 flex-shrink-0" />
                  <div className="ml-3 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{bucket.Name}</h3>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(bucket.CreationDate).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(bucket.Name)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Bucket</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <p className="text-xs text-gray-500 mt-1">
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
