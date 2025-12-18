import { useState } from 'react'
import { Database } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import axios from 'axios'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username || !password) {
      toast.error('请输入用户名和密码')
      return
    }

    setIsLoading(true)
    try {
      const response = await axios.post('http://localhost:9000/auth/login', {
        username,
        password
      })

      const { accessKey, secretKey, endpoint } = response.data
      login({ accessKey, secretKey, endpoint: endpoint || 'http://localhost:9000' })
      toast.success('登录成功')
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('用户名或密码错误')
      } else if (error.response?.status === 403) {
        toast.error('账户已被禁用')
      } else {
        toast.error('登录失败，请稍后重试')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Database className="w-12 h-12 text-primary-600" />
          <span className="ml-3 text-3xl font-bold text-gray-900">1103-OSS</span>
        </div>

        <h2 className="text-2xl font-semibold text-center text-gray-900 mb-2">
          Welcome Back
        </h2>
        <p className="text-center text-gray-500 mb-8">
          Enter your credentials to access the console
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="请输入用户名"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="请输入密码"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full py-3"
            disabled={isLoading}
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          S3-compatible object storage system
        </p>
      </div>
    </div>
  )
}
