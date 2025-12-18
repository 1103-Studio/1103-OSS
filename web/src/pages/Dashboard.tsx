import { useQuery } from '@tanstack/react-query'
import { FolderOpen, File, HardDrive, Activity } from 'lucide-react'
import { listBuckets } from '../lib/api'

export default function Dashboard() {
  const { data: bucketsData } = useQuery({
    queryKey: ['buckets'],
    queryFn: listBuckets,
  })

  const bucketCount = bucketsData?.ListAllMyBucketsResult?.Buckets?.Bucket?.length || 0

  const stats = [
    { 
      label: 'Total Buckets', 
      value: bucketCount, 
      icon: FolderOpen, 
      color: 'bg-blue-500' 
    },
    { 
      label: 'Total Objects', 
      value: '-', 
      icon: File, 
      color: 'bg-green-500' 
    },
    { 
      label: 'Storage Used', 
      value: '-', 
      icon: HardDrive, 
      color: 'bg-purple-500' 
    },
    { 
      label: 'API Requests', 
      value: '-', 
      icon: Activity, 
      color: 'bg-orange-500' 
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-6">
            <div className="flex items-center">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/buckets"
            className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <FolderOpen className="w-8 h-8 text-primary-600 mb-2" />
            <h3 className="font-medium text-gray-900">Create Bucket</h3>
            <p className="text-sm text-gray-500">Start by creating a new bucket</p>
          </a>
          <div className="p-4 border border-gray-200 rounded-lg">
            <File className="w-8 h-8 text-green-600 mb-2" />
            <h3 className="font-medium text-gray-900">Upload Files</h3>
            <p className="text-sm text-gray-500">Upload files to your buckets</p>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <Activity className="w-8 h-8 text-orange-600 mb-2" />
            <h3 className="font-medium text-gray-900">View Metrics</h3>
            <p className="text-sm text-gray-500">Monitor your storage usage</p>
          </div>
        </div>
      </div>
    </div>
  )
}
