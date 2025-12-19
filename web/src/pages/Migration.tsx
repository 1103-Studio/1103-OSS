import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

interface MigrationForm {
  sourceEndpoint: string
  accessKey: string
  secretKey: string
  region: string
}

export default function Migration() {
  const [formData, setFormData] = useState<MigrationForm>({
    sourceEndpoint: '',
    accessKey: '',
    secretKey: '',
    region: 'us-east-1'
  })

  const [showSecret, setShowSecret] = useState(false)
  const [detectedService, setDetectedService] = useState<string>('')

  const migrationMutation = useMutation({
    mutationFn: async (data: MigrationForm) => {
      const response = await api.post('/admin/migration/start', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('迁移任务已启动，请稍候查看进度')
      setFormData({
        sourceEndpoint: '',
        accessKey: '',
        secretKey: '',
        region: 'us-east-1'
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || '迁移启动失败')
    }
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // 自动检测服务类型
    if (name === 'sourceEndpoint') {
      detectServiceType(value)
    }
  }

  const detectServiceType = (endpoint: string) => {
    const lower = endpoint.toLowerCase()
    if (lower.includes('minio')) {
      setDetectedService('MinIO')
    } else if (lower.includes('amazonaws.com')) {
      setDetectedService('AWS S3')
    } else if (lower.includes('aliyun')) {
      setDetectedService('阿里云 OSS')
    } else if (lower.includes('qcloud')) {
      setDetectedService('腾讯云 COS')
    } else {
      setDetectedService('S3 兼容服务')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.sourceEndpoint || !formData.accessKey || !formData.secretKey) {
      toast.error('请填写所有必填项')
      return
    }

    migrationMutation.mutate(formData)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          存储桶迁移
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          从其他 S3 兼容服务迁移存储桶到本系统
        </p>
      </div>

      {/* 信息提示 */}
      <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-2">支持的服务类型：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>MinIO</li>
              <li>AWS S3</li>
              <li>阿里云 OSS</li>
              <li>腾讯云 COS</li>
              <li>其他 S3 兼容服务</li>
            </ul>
            <p className="mt-3 font-medium">迁移内容：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>所有存储桶及其配置</li>
              <li>存储桶内的所有对象（文件）</li>
              <li>对象元数据（Content-Type、ETag 等）</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 迁移表单 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 源端点 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              源服务端点 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="sourceEndpoint"
              value={formData.sourceEndpoint}
              onChange={handleInputChange}
              placeholder="例如: http://minio.example.com:9000 或 https://s3.amazonaws.com"
              className="input w-full"
              disabled={migrationMutation.isPending}
            />
            {detectedService && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                检测到服务类型: <span className="font-medium text-primary-600 dark:text-primary-400">{detectedService}</span>
              </p>
            )}
          </div>

          {/* Access Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Access Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="accessKey"
              value={formData.accessKey}
              onChange={handleInputChange}
              placeholder="源服务的 Access Key"
              className="input w-full font-mono"
              disabled={migrationMutation.isPending}
              autoComplete="off"
            />
          </div>

          {/* Secret Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Secret Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                name="secretKey"
                value={formData.secretKey}
                onChange={handleInputChange}
                placeholder="源服务的 Secret Key"
                className="input w-full font-mono pr-24"
                disabled={migrationMutation.isPending}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                {showSecret ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Region（可选）
            </label>
            <input
              type="text"
              name="region"
              value={formData.region}
              onChange={handleInputChange}
              placeholder="us-east-1"
              className="input w-full"
              disabled={migrationMutation.isPending}
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              对于 AWS S3，请填写实际 region；其他服务通常使用 us-east-1
            </p>
          </div>

          {/* 提交按钮 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              {migrationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在启动迁移任务...</span>
                </>
              ) : migrationMutation.isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>迁移任务已启动</span>
                </>
              ) : migrationMutation.isError ? (
                <>
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>启动失败，请检查配置</span>
                </>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={migrationMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {migrationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  启动中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  开始迁移
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 注意事项 */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-300">
            <p className="font-medium mb-2">重要提示：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>迁移过程将在后台执行，可能需要较长时间</li>
              <li>迁移期间请勿关闭浏览器或刷新页面</li>
              <li>如果存储桶已存在，将跳过创建但仍会迁移对象</li>
              <li>大量数据迁移可能占用较多网络带宽和磁盘空间</li>
              <li>请确保源服务的凭证拥有读取权限</li>
              <li>迁移不会删除源服务的数据</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 常见问题 */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          常见问题
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Q: 如何获取 Access Key 和 Secret Key？
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A: 请登录源服务的管理控制台，在 IAM 或凭证管理页面创建或查看访问密钥。
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Q: 迁移失败怎么办？
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A: 请检查端点地址、凭证是否正确，以及源服务是否可访问。可以查看服务器日志获取详细错误信息。
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              Q: 迁移会影响源服务吗？
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A: 不会。迁移只是读取源服务的数据并复制到本系统，不会修改或删除源服务的任何内容。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
