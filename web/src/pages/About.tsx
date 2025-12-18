import { Database, Github, Heart } from 'lucide-react'

export default function About() {
  const version = '1.0.0'
  const buildDate = '2025-12-18'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">关于</h1>

      <div className="max-w-3xl space-y-6">
        {/* 系统信息 */}
        <div className="card p-6">
          <div className="flex items-center mb-6">
            <Database className="w-12 h-12 text-primary-600 dark:text-primary-400" />
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">1103-OSS</h2>
              <p className="text-gray-500 dark:text-gray-400">对象存储系统</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">版本</span>
              <span className="font-mono text-gray-900 dark:text-white">{version}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">构建日期</span>
              <span className="font-mono text-gray-900 dark:text-white">{buildDate}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">协议</span>
              <span className="font-mono text-gray-900 dark:text-white">S3 Compatible</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-600 dark:text-gray-400">存储引擎</span>
              <span className="font-mono text-gray-900 dark:text-white">Local Filesystem</span>
            </div>
          </div>
        </div>

        {/* 功能特性 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">功能特性</h3>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">✓</span>
              <span>S3 API 兼容，支持主流 SDK</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">✓</span>
              <span>AWS Signature V4 签名验证</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">✓</span>
              <span>完整的用户权限管理</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">✓</span>
              <span>分片上传支持</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">✓</span>
              <span>深色模式与多语言支持</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-600 dark:text-primary-400 mr-2">✓</span>
              <span>现代化管理界面</span>
            </li>
          </ul>
        </div>

        {/* 技术栈 */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">技术栈</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">后端</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• Go 1.21+</li>
                <li>• Gin Framework</li>
                <li>• PostgreSQL</li>
                <li>• bcrypt</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">前端</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>• React 18</li>
                <li>• TypeScript</li>
                <li>• TailwindCSS</li>
                <li>• React Query</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 开源信息 */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Heart className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-gray-600 dark:text-gray-400">
                使用开源技术构建
              </span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Github className="w-5 h-5 mr-1" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 1103-OSS. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
