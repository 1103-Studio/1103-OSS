import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Filter, Calendar, User, Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import axios from 'axios'
import { getSignedHeaders } from '../lib/aws-signature-v4'

interface AuditLog {
  id: number
  user_id?: number
  username: string
  action: string
  resource_type: string
  resource_name?: string
  bucket_name?: string
  object_key?: string
  ip_address: string
  status_code: number
  error_message?: string
  created_at: string
}

export default function AuditLogs() {
  const [filter, setFilter] = useState({
    action: '',
    resource_type: '',
    bucket_name: '',
    limit: 50
  })

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', filter],
    queryFn: async () => {
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      const params = new URLSearchParams()
      if (filter.action) params.set('action', filter.action)
      if (filter.resource_type) params.set('resource_type', filter.resource_type)
      if (filter.bucket_name) params.set('bucket_name', filter.bucket_name)
      params.set('limit', filter.limit.toString())

      const url = `http://localhost:9000/admin/audit-logs?${params}`
      const headers = await getSignedHeaders('GET', url, creds.accessKey, creds.secretKey)
      const response = await axios.get(url, { headers })
      return response.data.logs || []
    }
  })

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      const url = `http://localhost:9000/admin/audit-logs/stats`
      const headers = await getSignedHeaders('GET', url, creds.accessKey, creds.secretKey)
      const response = await axios.get(url, { headers })
      return response.data
    }
  })

  const getActionIcon = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    } else if (statusCode >= 400) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    return <Clock className="w-4 h-4 text-gray-400" />
  }

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'text-green-600 dark:text-green-400'
    if (action.includes('DELETE')) return 'text-red-600 dark:text-red-400'
    if (action.includes('UPDATE') || action.includes('UPLOAD')) return 'text-blue-600 dark:text-blue-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">操作审计日志</p>
        </div>
        <FileText className="w-8 h-8 text-primary-500" />
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">总操作数</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.total_operations}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">活跃用户</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.unique_users}
                </p>
              </div>
              <User className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">失败操作</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.failed_operations}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">对象操作</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats.object_operations}
                </p>
              </div>
              <FileText className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* 过滤器 */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">筛选条件</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filter.action}
            onChange={(e) => setFilter({ ...filter, action: e.target.value })}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
          >
            <option value="">所有操作</option>
            <option value="CREATE_BUCKET">创建 Bucket</option>
            <option value="DELETE_BUCKET">删除 Bucket</option>
            <option value="UPLOAD_OBJECT">上传对象</option>
            <option value="DELETE_OBJECT">删除对象</option>
            <option value="SET_BUCKET_POLICY">设置权限</option>
          </select>
          <select
            value={filter.resource_type}
            onChange={(e) => setFilter({ ...filter, resource_type: e.target.value })}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
          >
            <option value="">所有资源类型</option>
            <option value="BUCKET">Bucket</option>
            <option value="OBJECT">Object</option>
            <option value="POLICY">Policy</option>
            <option value="USER">User</option>
          </select>
          <input
            type="text"
            placeholder="Bucket 名称"
            value={filter.bucket_name}
            onChange={(e) => setFilter({ ...filter, bucket_name: e.target.value })}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
          />
          <select
            value={filter.limit}
            onChange={(e) => setFilter({ ...filter, limit: parseInt(e.target.value) })}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
          >
            <option value="50">50 条</option>
            <option value="100">100 条</option>
            <option value="200">200 条</option>
          </select>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">用户</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">资源</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP地址</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">加载中...</td>
                </tr>
              ) : logs?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">暂无日志</td>
                </tr>
              ) : (
                logs?.map((log: AuditLog) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(log.created_at).toLocaleString('zh-CN')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {log.username || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      <div className="max-w-xs truncate">
                        {log.bucket_name && <div className="text-xs text-gray-500">Bucket: {log.bucket_name}</div>}
                        {log.object_key && <div className="text-xs text-gray-500">Key: {log.object_key}</div>}
                        {log.resource_name && <div>{log.resource_name}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {log.ip_address}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.status_code)}
                        <span className={log.status_code >= 400 ? 'text-red-600' : 'text-green-600'}>
                          {log.status_code}
                        </span>
                      </div>
                      {log.error_message && (
                        <div className="text-xs text-red-500 mt-1">{log.error_message}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
