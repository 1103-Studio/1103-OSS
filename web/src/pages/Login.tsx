import { useState } from 'react'
import { Database } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [endpoint, setEndpoint] = useState('http://localhost:9000')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!accessKey || !secretKey) {
      toast.error('Please enter access key and secret key')
      return
    }

    try {
      login({ accessKey, secretKey, endpoint })
      toast.success('Logged in successfully')
      // 强制刷新页面以触发重新渲染
      window.location.reload()
    } catch (error) {
      toast.error('Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Database className="w-12 h-12 text-primary-600" />
          <span className="ml-3 text-3xl font-bold text-gray-900">GoOSS</span>
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
              Endpoint
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="input"
              placeholder="http://localhost:9000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Key
            </label>
            <input
              type="text"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              className="input"
              placeholder="Enter your access key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secret Key
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="input"
              placeholder="Enter your secret key"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full py-3">
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          S3-compatible object storage system
        </p>
      </div>
    </div>
  )
}
