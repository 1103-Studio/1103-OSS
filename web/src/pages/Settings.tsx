import { useAuth } from '../hooks/useAuth'
import { Key, Server, Shield } from 'lucide-react'

export default function Settings() {
  const { credentials } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Connection Info */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Server className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold">Connection</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Endpoint
              </label>
              <div className="font-mono text-sm bg-gray-50 px-3 py-2 rounded border">
                {credentials?.endpoint || 'http://localhost:9000'}
              </div>
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Key className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold">Credentials</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Access Key
              </label>
              <div className="font-mono text-sm bg-gray-50 px-3 py-2 rounded border">
                {credentials?.accessKey || '-'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Secret Key
              </label>
              <div className="font-mono text-sm bg-gray-50 px-3 py-2 rounded border">
                ••••••••••••••••••••
              </div>
            </div>
          </div>
        </div>

        {/* SDK Examples */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <Shield className="w-5 h-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold">SDK Configuration</h2>
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
