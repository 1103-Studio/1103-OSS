import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  createCredential,
  createRole,
  createUser,
  deleteBucketAccess,
  deleteRole,
  deleteUser,
  listAdminBuckets,
  listBucketAccess,
  listRoles,
  listUsers,
  updateAdminBucket,
  upsertBucketAccess,
} from '../lib/api'

const permissionOptions = [
  'user:manage',
  'credential:manage',
  'role:manage',
  'bucket:manage',
  'bucket:read',
  'bucket:write',
  'bucket:assign',
  'bucket:policy',
  'bucket:quota',
  'bucket:traffic',
  'ticket:create',
  'ticket:read',
  'ticket:manage',
]

function parseCsvPermissions(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatBytes(value: number) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx++
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

export default function AccessControl() {
  const queryClient = useQueryClient()
  const [roleName, setRoleName] = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [rolePerms, setRolePerms] = useState('bucket:read,bucket:write,ticket:create,ticket:read')
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    displayName: '',
    email: '',
    isAdmin: false,
    roleIds: '',
    bucketNames: '',
  })
  const [selectedBucketId, setSelectedBucketId] = useState<number | null>(null)
  const [bucketAccessUserId, setBucketAccessUserId] = useState('')
  const [bucketAccessPerm, setBucketAccessPerm] = useState('read')
  const [credentialUserId, setCredentialUserId] = useState('')
  const [credentialDesc, setCredentialDesc] = useState('')
  const [credentialExpiresAt, setCredentialExpiresAt] = useState('')
  const [bucketQuotaForm, setBucketQuotaForm] = useState<Record<number, {
    defaultExpiry: string
    maxSizeBytes: string
    maxTrafficBytes: string
    maxObjects: string
    acl: string
  }>>({})

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listUsers,
  })
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listRoles,
  })
  const { data: buckets = [], isLoading: bucketsLoading } = useQuery({
    queryKey: ['admin-buckets'],
    queryFn: listAdminBuckets,
  })
  const { data: accessList = [] } = useQuery({
    queryKey: ['bucket-access', selectedBucketId],
    queryFn: () => listBucketAccess(selectedBucketId as number),
    enabled: !!selectedBucketId,
  })

  const usersById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users])

  const invalidateAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
    queryClient.invalidateQueries({ queryKey: ['admin-buckets'] })
    queryClient.invalidateQueries({ queryKey: ['bucket-access'] })
  }

  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      invalidateAdmin()
      setRoleName('')
      setRoleDesc('')
      toast.success('角色已创建')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '创建角色失败'),
  })

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      invalidateAdmin()
      setUserForm({
        username: '',
        password: '',
        displayName: '',
        email: '',
        isAdmin: false,
        roleIds: '',
        bucketNames: '',
      })
      toast.success('用户已创建')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '创建用户失败'),
  })

  const createCredentialMutation = useMutation({
    mutationFn: createCredential,
    onSuccess: (data: any) => {
      toast.success(`Key 已创建: ${data?.credential?.accessKey || ''}`)
      setCredentialUserId('')
      setCredentialDesc('')
      setCredentialExpiresAt('')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '创建 key 失败'),
  })

  const updateBucketMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAdminBucket(id, data),
    onSuccess: () => {
      invalidateAdmin()
      toast.success('存储桶配额已更新')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '更新存储桶失败'),
  })

  const bucketAccessMutation = useMutation({
    mutationFn: ({ bucketId, userId, permission }: { bucketId: number; userId: number; permission: string }) =>
      upsertBucketAccess(bucketId, { userId, permission }),
    onSuccess: () => {
      invalidateAdmin()
      setBucketAccessUserId('')
      toast.success('桶授权已更新')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '桶授权失败'),
  })

  const deleteBucketAccessMutation = useMutation({
    mutationFn: ({ bucketId, userId }: { bucketId: number; userId: number }) => deleteBucketAccess(bucketId, userId),
    onSuccess: () => {
      invalidateAdmin()
      toast.success('桶授权已移除')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '删除桶授权失败'),
  })

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      invalidateAdmin()
      toast.success('用户已删除')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '删除用户失败'),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      invalidateAdmin()
      toast.success('角色已删除')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '删除角色失败'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">访问控制</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">用户、角色、存储桶配额、桶授权和 Access Key 管理。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">创建角色</h2>
          <input className="input" placeholder="角色名" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
          <input className="input" placeholder="描述" value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} />
          <input className="input" placeholder="权限，逗号分隔" value={rolePerms} onChange={(e) => setRolePerms(e.target.value)} />
          <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            {permissionOptions.map((item) => <span key={item} className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">{item}</span>)}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => createRoleMutation.mutate({ name: roleName, description: roleDesc, permissions: parseCsvPermissions(rolePerms) })}
            disabled={!roleName.trim()}
          >
            创建角色
          </button>
        </section>

        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">创建用户</h2>
          <input className="input" placeholder="用户名" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
          <input className="input" placeholder="密码" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          <input className="input" placeholder="显示名" value={userForm.displayName} onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })} />
          <input className="input" placeholder="邮箱" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          <input className="input" placeholder="角色 ID，逗号分隔" value={userForm.roleIds} onChange={(e) => setUserForm({ ...userForm, roleIds: e.target.value })} />
          <input className="input" placeholder="预授权桶名，逗号分隔" value={userForm.bucketNames} onChange={(e) => setUserForm({ ...userForm, bucketNames: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={userForm.isAdmin} onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.checked })} />
            管理员
          </label>
          <button
            className="btn btn-primary"
            onClick={() => createUserMutation.mutate({
              username: userForm.username,
              password: userForm.password,
              displayName: userForm.displayName,
              email: userForm.email,
              isAdmin: userForm.isAdmin,
              roleIds: parseCsvPermissions(userForm.roleIds).map((item) => Number(item)).filter(Boolean),
              bucketNames: parseCsvPermissions(userForm.bucketNames),
            })}
            disabled={!userForm.username.trim() || !userForm.password.trim()}
          >
            创建用户
          </button>
        </section>
      </div>

      <section className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">创建 Access Key</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input" placeholder="用户 ID" value={credentialUserId} onChange={(e) => setCredentialUserId(e.target.value)} />
          <input className="input" placeholder="描述" value={credentialDesc} onChange={(e) => setCredentialDesc(e.target.value)} />
          <input className="input" placeholder="过期时间 RFC3339，可空" value={credentialExpiresAt} onChange={(e) => setCredentialExpiresAt(e.target.value)} />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => createCredentialMutation.mutate({
            userId: Number(credentialUserId),
            description: credentialDesc,
            expiresAt: credentialExpiresAt || null,
          })}
          disabled={!credentialUserId.trim()}
        >
          创建 Key
        </button>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">用户列表</h2>
        {usersLoading ? <div className="text-sm text-gray-500">加载中...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2">ID</th>
                  <th className="py-2">用户名</th>
                  <th className="py-2">显示名</th>
                  <th className="py-2">状态</th>
                  <th className="py-2">角色</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2">{user.id}</td>
                    <td className="py-2">{user.username}</td>
                    <td className="py-2">{user.displayName || '-'}</td>
                    <td className="py-2">{user.isAdmin ? 'admin' : user.status}</td>
                    <td className="py-2">{user.roles?.map((role) => role.name).join(', ') || '-'}</td>
                    <td className="py-2">
                      <button className="text-red-600" onClick={() => deleteUserMutation.mutate(user.id)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">角色列表</h2>
        {rolesLoading ? <div className="text-sm text-gray-500">加载中...</div> : (
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{role.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{role.description || '无描述'}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {role.permissions?.map((item) => <span key={item} className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">{item}</span>)}
                    </div>
                  </div>
                  <button className="text-red-600 text-sm" onClick={() => deleteRoleMutation.mutate(role.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">桶配额与授权</h2>
        {bucketsLoading ? <div className="text-sm text-gray-500">加载中...</div> : (
          <div className="space-y-4">
            {buckets.map((bucket) => {
              const form = bucketQuotaForm[bucket.id] || {
                defaultExpiry: bucket.defaultExpiry || '7d',
                maxSizeBytes: String(bucket.maxSizeBytes || 0),
                maxTrafficBytes: String(bucket.maxTrafficBytes || 0),
                maxObjects: String(bucket.maxObjects || 0),
                acl: bucket.acl || 'private',
              }
              return (
                <div key={bucket.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{bucket.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        已用流量 {formatBytes(bucket.usedTrafficBytes)} / 限额 {formatBytes(bucket.maxTrafficBytes)}
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setSelectedBucketId(bucket.id)}>
                      查看授权
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input className="input" placeholder="默认过期" value={form.defaultExpiry} onChange={(e) => setBucketQuotaForm({ ...bucketQuotaForm, [bucket.id]: { ...form, defaultExpiry: e.target.value } })} />
                    <input className="input" placeholder="容量字节" value={form.maxSizeBytes} onChange={(e) => setBucketQuotaForm({ ...bucketQuotaForm, [bucket.id]: { ...form, maxSizeBytes: e.target.value } })} />
                    <input className="input" placeholder="流量字节" value={form.maxTrafficBytes} onChange={(e) => setBucketQuotaForm({ ...bucketQuotaForm, [bucket.id]: { ...form, maxTrafficBytes: e.target.value } })} />
                    <input className="input" placeholder="对象数" value={form.maxObjects} onChange={(e) => setBucketQuotaForm({ ...bucketQuotaForm, [bucket.id]: { ...form, maxObjects: e.target.value } })} />
                    <select className="input" value={form.acl} onChange={(e) => setBucketQuotaForm({ ...bucketQuotaForm, [bucket.id]: { ...form, acl: e.target.value } })}>
                      <option value="private">private</option>
                      <option value="public-read">public-read</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => updateBucketMutation.mutate({
                      id: bucket.id,
                      data: {
                        defaultExpiry: form.defaultExpiry,
                        maxSizeBytes: Number(form.maxSizeBytes) || 0,
                        maxTrafficBytes: Number(form.maxTrafficBytes) || 0,
                        maxObjects: Number(form.maxObjects) || 0,
                        acl: form.acl,
                      },
                    })}
                  >
                    保存配额
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedBucketId && (
        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">桶授权详情 #{selectedBucketId}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="input" placeholder="用户 ID" value={bucketAccessUserId} onChange={(e) => setBucketAccessUserId(e.target.value)} />
            <select className="input" value={bucketAccessPerm} onChange={(e) => setBucketAccessPerm(e.target.value)}>
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={() => bucketAccessMutation.mutate({
                bucketId: selectedBucketId,
                userId: Number(bucketAccessUserId),
                permission: bucketAccessPerm,
              })}
              disabled={!bucketAccessUserId.trim()}
            >
              保存授权
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2">用户</th>
                  <th className="py-2">权限</th>
                  <th className="py-2">更新时间</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {accessList.map((record) => (
                  <tr key={record.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-2">{usersById.get(record.userId)?.username || `#${record.userId}`}</td>
                    <td className="py-2">{record.permission}</td>
                    <td className="py-2">{new Date(record.updatedAt).toLocaleString('zh-CN')}</td>
                    <td className="py-2">
                      <button className="text-red-600" onClick={() => deleteBucketAccessMutation.mutate({ bucketId: selectedBucketId, userId: record.userId })}>移除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
