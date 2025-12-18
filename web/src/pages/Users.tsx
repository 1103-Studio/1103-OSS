import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'

interface User {
  id: number
  username: string
  email: string
  status: string
  isAdmin: boolean
  createdAt: string
  updatedAt: string
}

export default function Users() {
  const { credentials } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // 获取用户列表
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { getSignedHeaders } = await import('../lib/aws-signature-v4')
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      
      const headers = await getSignedHeaders(
        'GET',
        'http://localhost:9000/admin/users',
        creds.accessKey,
        creds.secretKey
      )
      
      const response = await axios.get('http://localhost:9000/admin/users', { headers })
      return response.data as User[]
    },
    enabled: !!credentials
  })

  // 创建用户
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { getSignedHeaders } = await import('../lib/aws-signature-v4')
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      
      const headers = await getSignedHeaders(
        'POST',
        'http://localhost:9000/admin/users',
        creds.accessKey,
        creds.secretKey,
        data
      )
      
      await axios.post('http://localhost:9000/admin/users', data, { headers })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateModal(false)
      toast.success(`用户 ${variables.username} 创建成功`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '创建用户失败')
    }
  })

  // 更新用户
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const { getSignedHeaders } = await import('../lib/aws-signature-v4')
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      
      const headers = await getSignedHeaders(
        'PUT',
        `http://localhost:9000/admin/users/${id}`,
        creds.accessKey,
        creds.secretKey,
        data
      )
      
      await axios.put(`http://localhost:9000/admin/users/${id}`, data, { headers })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
      toast.success('用户更新成功')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '更新用户失败')
    }
  })

  // 删除用户
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { getSignedHeaders } = await import('../lib/aws-signature-v4')
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      
      const headers = await getSignedHeaders(
        'DELETE',
        `http://localhost:9000/admin/users/${id}`,
        creds.accessKey,
        creds.secretKey
      )
      
      await axios.delete(`http://localhost:9000/admin/users/${id}`, { headers })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('用户删除成功')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '删除用户失败')
    }
  })

  if (isLoading) {
    return <div className="p-8">加载中...</div>
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">用户管理</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          创建用户
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">用户名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">邮箱</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">角色</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">创建时间</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users?.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {user.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {user.isAdmin ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      管理员
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      普通用户
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {user.status === 'active' ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      正常
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      禁用
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="text-primary-600 hover:text-primary-900 dark:text-primary-400 mr-4"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`确定要删除用户 ${user.username} 吗？`)) {
                        deleteMutation.mutate(user.id)
                      }
                    }}
                    className="text-red-600 hover:text-red-900 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 创建用户模态框 */}
      {showCreateModal && (
        <UserFormModal
          title="创建用户"
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {/* 编辑用户模态框 */}
      {editingUser && (
        <UserFormModal
          title="编辑用户"
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingUser.id, data })}
        />
      )}
    </div>
  )
}

function UserFormModal({ title, user, onClose, onSubmit }: {
  title: string
  user?: User
  onClose: () => void
  onSubmit: (data: any) => void
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    password: '',
    email: user?.email || '',
    isAdmin: user?.isAdmin || false,
    status: user?.status || 'active'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: any = {}
    
    if (!user) {
      // 创建用户，所有字段必填
      data.username = formData.username
      data.password = formData.password
      data.email = formData.email
      data.isAdmin = formData.isAdmin
    } else {
      // 更新用户，只传递修改的字段
      if (formData.password) data.password = formData.password
      if (formData.email !== user.email) data.email = formData.email
      if (formData.isAdmin !== user.isAdmin) data.isAdmin = formData.isAdmin
      if (formData.status !== user.status) data.status = formData.status
    }

    onSubmit(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input"
              required
              disabled={!!user}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              密码 {user && '(留空表示不修改)'}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              required={!user}
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              邮箱
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAdmin"
              checked={formData.isAdmin}
              onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="isAdmin" className="text-sm text-gray-700 dark:text-gray-300">
              管理员权限
            </label>
          </div>

          {user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                状态
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
                <option value="active">正常</option>
                <option value="disabled">禁用</option>
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn flex-1">
              取消
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {user ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
