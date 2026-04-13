import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { App, Breadcrumb, Button, Card, Col, Descriptions, Form, Input, Modal, Progress, Row, Space, Statistic, Table, Tag, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { createFolder, deleteFolder, deleteObject, getPresignedUrl, listObjects, uploadObject, type ObjectSummary } from '../lib/api'

const { Title, Paragraph, Text } = Typography
const { Dragger } = Upload

type RowItem =
  | { type: 'folder'; key: string; name: string }
  | { type: 'file'; key: string; name: string; size: number; lastModified: string }

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx += 1
  }
  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

export default function Objects() {
  const { message } = App.useApp()
  const { bucket, '*': path = '' } = useParams()
  const queryClient = useQueryClient()
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [selected, setSelected] = useState<RowItem | null>(null)

  const prefix = path ? `${path}/` : ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['objects', bucket, prefix],
    queryFn: () => listObjects(bucket!, prefix),
    enabled: !!bucket,
  })

  const deleteMutation = useMutation({
    mutationFn: ({ key }: { key: string }) => deleteObject(bucket!, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucket] })
      message.success('对象已删除')
      setSelected(null)
    },
    onError: () => message.error('删除对象失败'),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderPrefix: string) => deleteFolder(bucket!, folderPrefix),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucket] })
      message.success('目录已删除')
      setSelected(null)
    },
    onError: () => message.error('删除目录失败'),
  })

  const handleUploadFile = async (file: File) => {
    const key = prefix + file.name
    setUploadProgress((prev) => ({ ...prev, [key]: 0 }))
    try {
      await uploadObject(bucket!, key, file, (percent) => {
        setUploadProgress((prev) => ({ ...prev, [key]: percent }))
      })
      message.success(`已上传 ${file.name}`)
    } catch {
      message.error(`上传失败: ${file.name}`)
    } finally {
      setUploadProgress((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['objects', bucket] })
    }
  }

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    disabled: !bucket,
    beforeUpload(file) {
      void handleUploadFile(file as File)
      return Upload.LIST_IGNORE
    },
  }

  const objects = data?.ListBucketResult?.Contents || []
  const prefixes = data?.ListBucketResult?.CommonPrefixes || []

  const rows = useMemo<RowItem[]>(() => {
    const folderRows = prefixes.map((item) => ({
      type: 'folder' as const,
      key: item.Prefix,
      name: item.Prefix.replace(prefix, '').replace(/\/$/, ''),
    }))
    const fileRows = objects
      .filter((item) => item.Key.replace(prefix, ''))
      .map((item: ObjectSummary) => ({
        type: 'file' as const,
        key: item.Key,
        name: item.Key.replace(prefix, ''),
        size: item.Size,
        lastModified: item.LastModified,
      }))
    return [...folderRows, ...fileRows]
  }, [objects, prefix, prefixes])

  const totalObjects = rows.length
  const totalSize = objects.reduce((sum, item) => sum + item.Size, 0)
  const pathParts = path ? path.split('/').filter(Boolean) : []

  return (
    <>
      <section className="console-hero">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Link to="/buckets"><Button icon={<ArrowLeftOutlined />}>返回 Bucket 列表</Button></Link>
          <Title level={2} style={{ margin: 0 }}>Bucket `{bucket}` 对象控制台</Title>
          <Paragraph style={{ maxWidth: 760, marginTop: 0, marginBottom: 0 }}>
            对齐云厂商对象浏览页，支持目录导航、上传、分享、下载和删除。
          </Paragraph>
          <Breadcrumb
            items={[
              { title: <Link to="/buckets">Buckets</Link> },
              { title: <Link to={`/buckets/${bucket}`}>{bucket}</Link> },
              ...pathParts.map((part, index) => ({
                title: <Link to={`/buckets/${bucket}/${pathParts.slice(0, index + 1).join('/')}`}>{part}</Link>,
              })),
            ]}
          />
        </Space>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Statistic title="资源数量" value={totalObjects} /></Card>
        <Card variant="borderless"><Statistic title="文件体积" value={formatSize(totalSize)} /></Card>
        <Card variant="borderless"><Statistic title="当前前缀" value={prefix || '/'} /></Card>
        <Card variant="borderless"><Statistic title="Bucket" value={bucket || '-'} /></Card>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={16}>
          <Card
            title="对象操作"
            variant="borderless"
            extra={
              <Space wrap>
                <Button icon={<FolderAddOutlined />} onClick={() => setCreateFolderOpen(true)}>新建目录</Button>
                <Button icon={<ReloadOutlined />} onClick={() => refetch()}>刷新</Button>
              </Space>
            }
          >
            <Dragger {...uploadProps} className="console-upload-dragger" style={{ marginBottom: 20 }}>
              <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
                <InboxOutlined style={{ fontSize: 32, color: '#1677ff' }} />
                <Text strong>拖拽文件到这里，或点击上传到当前目录</Text>
                <Text type="secondary">上传将保留文件名，并按当前前缀写入对象存储。</Text>
              </div>
            </Dragger>

            {Object.entries(uploadProgress).length > 0 && (
              <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: 20 }}>
                {Object.entries(uploadProgress).map(([key, value]) => (
                  <Card key={key} size="small">
                    <Text>{key}</Text>
                    <Progress percent={value} style={{ marginTop: 10 }} />
                  </Card>
                ))}
              </Space>
            )}

            <Table<RowItem>
              rowKey="key"
              dataSource={rows}
              loading={isLoading}
              scroll={{ x: 900 }}
              onRow={(record) => ({ onClick: () => setSelected(record) })}
              columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  render: (_: string, record) =>
                    record.type === 'folder' ? (
                      <Space>
                        <FolderOpenOutlined style={{ color: '#1677ff' }} />
                        <Link to={`/buckets/${bucket}/${record.key.replace(/\/$/, '')}`}><Text strong>{record.name}/</Text></Link>
                      </Space>
                    ) : (
                      <Text>{record.name}</Text>
                    ),
                },
                {
                  title: '类型',
                  width: 120,
                  render: (_: unknown, record) => <Tag color={record.type === 'folder' ? 'blue' : 'default'}>{record.type === 'folder' ? 'Folder' : 'File'}</Tag>,
                },
                {
                  title: '大小',
                  width: 140,
                  render: (_: unknown, record) => record.type === 'file' ? formatSize(record.size) : '-',
                },
                {
                  title: '更新时间',
                  width: 180,
                  render: (_: unknown, record) => record.type === 'file' ? new Date(record.lastModified).toLocaleString('zh-CN') : '-',
                },
                {
                  title: '操作',
                  width: 220,
                  render: (_: unknown, record) => (
                    <Space>
                      {record.type === 'file' && (
                        <>
                          <Button
                            size="small"
                            icon={<LinkOutlined />}
                            onClick={async () => {
                              const url = await getPresignedUrl(bucket!, record.key)
                              await navigator.clipboard.writeText(url)
                              message.success('分享链接已复制')
                            }}
                          />
                          <Button
                            size="small"
                            icon={<CloudDownloadOutlined />}
                            onClick={async () => {
                              const url = await getPresignedUrl(bucket!, record.key)
                              window.open(url, '_blank')
                            }}
                          />
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => deleteMutation.mutate({ key: record.key })}
                          />
                        </>
                      )}
                      {record.type === 'folder' && (
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => deleteFolderMutation.mutate(record.key)}
                        >
                          删除目录
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card title="资源详情" variant="borderless">
            {selected ? (
              <Descriptions bordered column={1}>
                <Descriptions.Item label="名称">{selected.name}</Descriptions.Item>
                <Descriptions.Item label="对象 Key">{selected.key}</Descriptions.Item>
                <Descriptions.Item label="类型">{selected.type === 'folder' ? '逻辑目录' : '对象文件'}</Descriptions.Item>
                {selected.type === 'file' && (
                  <>
                    <Descriptions.Item label="大小">{formatSize(selected.size)}</Descriptions.Item>
                    <Descriptions.Item label="最后修改">{new Date(selected.lastModified).toLocaleString('zh-CN')}</Descriptions.Item>
                  </>
                )}
              </Descriptions>
            ) : (
              <Paragraph type="secondary">选择左侧资源后，这里会显示对象详情。</Paragraph>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="新建目录"
        open={createFolderOpen}
        onCancel={() => setCreateFolderOpen(false)}
        footer={null}
      >
        <Form
          layout="vertical"
          onFinish={async (values: { folderName: string }) => {
            if (values.folderName.includes('/')) {
              message.error('目录名称不能包含 /')
              return
            }
            await createFolder(bucket!, prefix + values.folderName)
            message.success('目录创建成功')
            setCreateFolderOpen(false)
            refetch()
          }}
        >
          <Form.Item name="folderName" label="目录名称" rules={[{ required: true, message: '请输入目录名称' }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>创建目录</Button>
        </Form>
      </Modal>
    </>
  )
}
