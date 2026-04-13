import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Descriptions, Drawer, Form, Grid, Input, Popconfirm, Space, Statistic, Switch, Table, Tag, Typography } from 'antd'
import {
  createBucket,
  deleteBucket,
  getBucketPublicStatus,
  getBucketSettings,
  getStorageEndpoint,
  listBuckets,
  setBucketPrivate,
  setBucketPublic,
  updateBucketSettings,
  type BucketSummary,
} from '../lib/api'

const { Title, Paragraph, Text } = Typography
const { useBreakpoint } = Grid

export default function Buckets() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const screens = useBreakpoint()
  const [createForm] = Form.useForm()
  const [settingsForm] = Form.useForm()
  const storageEndpoint = getStorageEndpoint()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<BucketSummary | null>(null)
  const [bucketPublicMap, setBucketPublicMap] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['buckets'],
    queryFn: listBuckets,
  })

  const buckets = data?.ListAllMyBucketsResult?.Buckets?.Bucket || []
  const publicCount = Object.values(bucketPublicMap).filter(Boolean).length

  const createMutation = useMutation({
    mutationFn: createBucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] })
      createForm.resetFields()
      message.success('Bucket 已创建')
    },
    onError: (error: any) => message.error(error?.message || '创建 Bucket 失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] })
      message.success('Bucket 已删除')
    },
    onError: (error: any) => message.error(error?.message || '删除 Bucket 失败'),
  })

  useEffect(() => {
    let cancelled = false

    if (!buckets.length) {
      setBucketPublicMap({})
      return () => {
        cancelled = true
      }
    }

    void Promise.all(
      buckets.map(async (bucket) => {
        try {
          const value = await getBucketPublicStatus(bucket.Name)
          return [bucket.Name, value] as const
        } catch {
          return [bucket.Name, false] as const
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return
      }

      setBucketPublicMap(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [buckets])

  useEffect(() => {
    if (!selectedBucket) return
    getBucketSettings(selectedBucket.Name)
      .then((settings) => settingsForm.setFieldsValue({ defaultExpiry: settings.default_expiry || '7d' }))
      .catch(() => settingsForm.setFieldsValue({ defaultExpiry: '7d' }))
  }, [selectedBucket, settingsForm])

  const openBucketDrawer = (bucket: BucketSummary) => {
    settingsForm.setFieldsValue({ defaultExpiry: '7d' })
    setSelectedBucket(bucket)
    setDrawerOpen(true)
  }

  const copyText = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedField(field)
    message.success('已复制到剪贴板')
    setTimeout(() => setCopiedField(''), 1200)
  }

  const createBucketAction = (
    <Form
      form={createForm}
      layout={screens.md ? 'inline' : 'vertical'}
      onFinish={(values: { name: string }) => createMutation.mutate(values.name.trim().toLowerCase())}
      style={{ width: '100%' }}
    >
      <Form.Item
        name="name"
        rules={[{ required: true, message: '请输入 Bucket 名称' }]}
        style={{ marginBottom: screens.md ? 0 : 12, minWidth: screens.md ? 240 : undefined }}
      >
        <Input placeholder="bucket-name" />
      </Form.Item>
      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createMutation.isPending} block={!screens.md}>
        新建存储桶
      </Button>
    </Form>
  )

  return (
    <>
      <section className="console-hero">
        <Title level={2} style={{ margin: 0 }}>Bucket 资源池</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          统一管理存储桶、公开策略、默认分享时效和对象入口。交互模型对齐云厂商 OSS 控制台。
        </Paragraph>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Statistic title="Bucket 数量" value={buckets.length} /></Card>
        <Card variant="borderless"><Statistic title="公开读 Bucket" value={publicCount} /></Card>
        <Card variant="borderless"><Statistic title="标准端点" value="S3 Compatible" /></Card>
        <Card variant="borderless"><Statistic title="控制模式" value="Enterprise" /></Card>
      </div>

      <Card variant="borderless">
        <div className="console-toolbar">
          <div>
            <Text strong style={{ fontSize: 16 }}>快速新建 Bucket</Text>
            <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
              保持小写与短横线命名，创建后可直接进入对象管理和权限配置。
            </Paragraph>
          </div>
          <div className="console-toolbar-form">
            {createBucketAction}
          </div>
        </div>
      </Card>

      <Card title="Bucket 列表" variant="borderless">
        <Table<BucketSummary>
          rowKey="Name"
          loading={isLoading}
          dataSource={buckets}
          scroll={{ x: 980 }}
          columns={[
            {
              title: 'Bucket 名称',
              dataIndex: 'Name',
              render: (value: string) => (
                <Space>
                  <FolderOpenOutlined style={{ color: '#1677ff' }} />
                  <Link to={`/buckets/${value}`}><Text strong>{value}</Text></Link>
                </Space>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'CreationDate',
              width: 180,
              render: (value: string) => new Date(value).toLocaleString('zh-CN'),
            },
            {
              title: '访问级别',
              width: 160,
              render: (_: unknown, record) => (
                <Tag color={bucketPublicMap[record.Name] ? 'green' : 'default'}>
                  {bucketPublicMap[record.Name] ? 'Public Read' : 'Private'}
                </Tag>
              ),
            },
            {
              title: '快速切换',
              width: 140,
              render: (_: unknown, record) => (
                <Switch
                  checked={bucketPublicMap[record.Name]}
                  checkedChildren={<UnlockOutlined />}
                  unCheckedChildren="私有"
                  onChange={async (checked) => {
                    try {
                      if (checked) {
                        await setBucketPublic(record.Name)
                      } else {
                        await setBucketPrivate(record.Name)
                      }
                      setBucketPublicMap((prev) => ({ ...prev, [record.Name]: checked }))
                      message.success(`${record.Name} 已设为${checked ? '公开' : '私有'}`)
                    } catch (error: any) {
                      message.error(error?.response?.data?.message || '切换权限失败')
                    }
                  }}
                />
              ),
            },
            {
              title: '操作',
              width: 220,
              render: (_: unknown, record) => (
                <Space>
                  <Link to={`/buckets/${record.Name}`}><Button size="small">对象管理</Button></Link>
                  <Button size="small" icon={<InfoCircleOutlined />} onClick={() => openBucketDrawer(record)}>详情</Button>
                  <Popconfirm title={`删除 ${record.Name}？`} onConfirm={() => deleteMutation.mutate(record.Name)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={selectedBucket ? `Bucket 详情 · ${selectedBucket.Name}` : 'Bucket 详情'}
        width={screens.md ? 720 : '100%'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedBucket && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Bucket 名称">{selectedBucket.Name}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(selectedBucket.CreationDate).toLocaleString('zh-CN')}</Descriptions.Item>
              <Descriptions.Item label="API Endpoint">{`${storageEndpoint}/${selectedBucket.Name}`}</Descriptions.Item>
              <Descriptions.Item label="S3 Endpoint">{`s3://${storageEndpoint.replace(/^https?:\/\//, '')}/${selectedBucket.Name}`}</Descriptions.Item>
              <Descriptions.Item label="Storage Path">{`/data/oss/buckets/${selectedBucket.Name}`}</Descriptions.Item>
            </Descriptions>

            <Space wrap>
              <Button icon={copiedField === 'endpoint' ? <CheckOutlined /> : <CopyOutlined />} onClick={() => copyText(`${storageEndpoint}/${selectedBucket.Name}`, 'endpoint')}>
                复制 API Endpoint
              </Button>
              <Button icon={copiedField === 's3' ? <CheckOutlined /> : <CopyOutlined />} onClick={() => copyText(`s3://${storageEndpoint.replace(/^https?:\/\//, '')}/${selectedBucket.Name}`, 's3')}>
                复制 S3 Endpoint
              </Button>
            </Space>

            <Card title="默认分享时效" size="small">
              <Form
                form={settingsForm}
                layout={screens.md ? 'inline' : 'vertical'}
                onFinish={(values: { defaultExpiry: string }) =>
                  updateBucketSettings(selectedBucket.Name, values.defaultExpiry).then(() => {
                    message.success('默认时效已更新')
                    settingsForm.setFieldsValue({ defaultExpiry: values.defaultExpiry })
                  })
                }
              >
                <Form.Item name="defaultExpiry" style={{ marginBottom: screens.md ? 0 : 12 }}>
                  <Input />
                </Form.Item>
                <Button type="primary" htmlType="submit" block={!screens.md}>保存</Button>
              </Form>
            </Card>
          </Space>
        )}
      </Drawer>
    </>
  )
}
