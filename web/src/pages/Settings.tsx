import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Key, Server, Shield, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'

export default function Settings() {
  const { credentials } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('新密码和确认密码不匹配')
      return
    }

    if (newPassword.length < 8) {
      toast.error('新密码至少需要 8 位')
      return
    }

    setIsChangingPassword(true)
    try {
      const { getSignedHeaders } = await import('../lib/aws-signature-v4')
      const creds = JSON.parse(localStorage.getItem('oss_credentials') || '{}')
      
      const body = { oldPassword, newPassword }
      const headers = await getSignedHeaders(
        'POST',
        'http://localhost:9000/user/change-password',
        creds.accessKey,
        creds.secretKey,
        body
      )
      
      await axios.post('http://localhost:9000/user/change-password', body, { headers })

      toast.success('密码修改成功')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('旧密码不正确')
      } else {
        toast.error(error.response?.data?.error || '密码修改失败')
      }
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">设置</h1>

      <div className="space-y-6">
        {/* Change Password */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Lock className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">修改密码</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                旧密码
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="input"
                required
                disabled={isChangingPassword}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                required
                minLength={8}
                disabled={isChangingPassword}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">至少 8 位字符</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                required
                minLength={8}
                disabled={isChangingPassword}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>

        {/* Connection Info */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Server className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">连接信息</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                端点地址
              </label>
              <div className="font-mono text-sm bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                {credentials?.endpoint || 'http://localhost:9000'}
              </div>
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Key className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API 凭证</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Access Key
              </label>
              <div className="font-mono text-sm bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                {credentials?.accessKey || '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Secret Key
              </label>
              <div className="font-mono text-sm bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                ••••••••••••••••••••
              </div>
            </div>
          </div>
        </div>

        {/* SDK Examples */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Shield className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SDK 配置示例</h2>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">AWS CLI</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`aws configure set aws_access_key_id ${credentials?.accessKey || 'YOUR_ACCESS_KEY'}
aws configure set aws_secret_access_key YOUR_SECRET_KEY
aws configure set default.region us-east-1

# Use with endpoint
aws --endpoint-url ${credentials?.endpoint || 'http://localhost:9000'} s3 ls`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Python (boto3)</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`import boto3

s3 = boto3.client('s3',
    endpoint_url='${credentials?.endpoint || 'http://localhost:9000'}',
    aws_access_key_id='${credentials?.accessKey || 'YOUR_ACCESS_KEY'}',
    aws_secret_access_key='YOUR_SECRET_KEY'
)

# List buckets
response = s3.list_buckets()
print(response['Buckets'])`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">JavaScript (AWS SDK)</h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: '${credentials?.endpoint || 'http://localhost:9000'}',
  region: 'us-east-1',
  credentials: {
    accessKeyId: '${credentials?.accessKey || 'YOUR_ACCESS_KEY'}',
    secretAccessKey: 'YOUR_SECRET_KEY'
  },
  forcePathStyle: true
});

const response = await client.send(new ListBucketsCommand({}));
console.log(response.Buckets);`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
