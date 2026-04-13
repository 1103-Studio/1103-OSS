import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Progress, Row, Space, Table, Tag, Typography } from 'antd'
import { cancelMigrationJob, getMigrationJob, listMigrationJobs, startMigration, type MigrationJobRecord } from '../lib/api'

const { Text } = Typography

function detectServiceType(endpoint: string) {
  const lower = endpoint.toLowerCase()
  if (lower.includes('aliyun') || lower.includes('oss-')) return '阿里云 OSS'
  if (lower.includes('myqcloud') || lower.includes('cos.')) return '腾讯云 COS'
  if (lower.includes('amazonaws.com')) return 'AWS S3'
  if (lower.includes('minio')) return 'MinIO'
  return 'SigV4 兼容 S3'
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'cancelled':
      return 'default'
    case 'running':
      return 'processing'
    default:
      return 'blue'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '迁移中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

export default function Migration() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [latestJobId, setLatestJobId] = useState<number | null>(null)

  const { data: jobs = [] } = useQuery({
    queryKey: ['migration-jobs'],
    queryFn: () => listMigrationJobs(10),
    refetchInterval: (query) => {
      const items = (query.state.data as MigrationJobRecord[] | undefined) || []
      return items.some((item) => ['queued', 'running'].includes(item.status)) ? 3000 : false
    },
  })

  const { data: latestJob } = useQuery({
    queryKey: ['migration-job', latestJobId],
    queryFn: () => getMigrationJob(latestJobId as number),
    enabled: !!latestJobId,
    refetchInterval: (query) => {
      const job = query.state.data as MigrationJobRecord | undefined
      return job && ['queued', 'running'].includes(job.status) ? 2000 : false
    },
  })

  const startMutation = useMutation({
    mutationFn: startMigration,
    onSuccess: (data: any) => {
      message.success('迁移任务已启动')
      setLatestJobId(data?.job?.id || null)
      form.resetFields()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || '迁移启动失败')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelMigrationJob,
    onSuccess: () => message.success('取消请求已提交'),
    onError: (error: any) => message.error(error.response?.data?.error || '取消迁移失败'),
  })

  const displayedJobs = useMemo(() => {
    if (latestJob && !jobs.find((job) => job.id === latestJob.id)) {
      return [latestJob, ...jobs]
    }
    return jobs
  }, [jobs, latestJob])

  const activeJob = latestJob || displayedJobs[0] || null
  const detectedService = Form.useWatch('sourceEndpoint', form)
  const progressPercent = activeJob?.totalObjects ? Math.round((activeJob.completedObjects / activeJob.totalObjects) * 100) : 0

  return (
    <>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card title="启动迁移任务" variant="borderless">
            <Form
              form={form}
              layout="vertical"
              onFinish={(values: { sourceEndpoint: string; accessKey: string; secretKey: string }) => startMutation.mutate(values)}
            >
              <Form.Item label="OSS 地址" name="sourceEndpoint" rules={[{ required: true, message: '请输入 OSS 地址' }]}>
                <Input placeholder="https://your-oss-endpoint.example.com" />
              </Form.Item>
              <Form.Item label="Access Key" name="accessKey" rules={[{ required: true, message: '请输入 Access Key' }]}>
                <Input className="console-mono" />
              </Form.Item>
              <Form.Item label="Secret Key" name="secretKey" rules={[{ required: true, message: '请输入 Secret Key' }]}>
                <Input.Password className="console-mono" />
              </Form.Item>

              {detectedService && (
                <Alert
                  showIcon
                  type="info"
                  style={{ marginBottom: 16 }}
                  message={`识别服务类型：${detectServiceType(detectedService)}`}
                  description="直接填写源 OSS 地址即可。"
                />
              )}

              <Button type="primary" htmlType="submit" icon={<CloudSyncOutlined />} block loading={startMutation.isPending}>
                开始迁移
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card title="任务详情" variant="borderless">
            {activeJob ? (
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={getStatusColor(activeJob.status)}>{getStatusLabel(activeJob.status)}</Tag>
                  <Tag>Job #{activeJob.id}</Tag>
                  {['queued', 'running'].includes(activeJob.status) && (
                    <Button
                      danger
                      icon={<PauseCircleOutlined />}
                      loading={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(activeJob.id)}
                    >
                      取消任务
                    </Button>
                  )}
                </Space>

                <Progress percent={progressPercent} status={activeJob.status === 'failed' ? 'exception' : activeJob.status === 'completed' ? 'success' : 'active'} />

                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="源端点" span={2}>{activeJob.sourceEndpoint}</Descriptions.Item>
                  <Descriptions.Item label="错误数">{activeJob.errorCount}</Descriptions.Item>
                  <Descriptions.Item label="状态">{getStatusLabel(activeJob.status)}</Descriptions.Item>
                  <Descriptions.Item label="当前 Bucket">{activeJob.currentBucket || '-'}</Descriptions.Item>
                  <Descriptions.Item label="当前对象">{activeJob.currentObject || '-'}</Descriptions.Item>
                  <Descriptions.Item label="对象进度">{activeJob.completedObjects} / {activeJob.totalObjects}</Descriptions.Item>
                  <Descriptions.Item label="Bucket 总数">{activeJob.totalBuckets}</Descriptions.Item>
                  <Descriptions.Item label="开始时间">{activeJob.startedAt ? new Date(activeJob.startedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
                </Descriptions>

                {activeJob.lastError && (
                  <Alert
                    type={activeJob.status === 'cancelled' ? 'warning' : 'error'}
                    showIcon
                    icon={activeJob.status === 'cancelled' ? <PauseCircleOutlined /> : <ExclamationCircleOutlined />}
                    message={activeJob.lastError}
                  />
                )}
              </Space>
            ) : (
              <Alert type="info" showIcon message="当前还没有迁移任务记录。" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="最近迁移任务" variant="borderless">
        <Table<MigrationJobRecord>
          rowKey="id"
          scroll={{ x: 960 }}
          dataSource={displayedJobs}
          pagination={false}
          onRow={(record: MigrationJobRecord) => ({
            onClick: () => setLatestJobId(record.id),
          })}
          columns={[
            {
              title: '任务 ID',
              dataIndex: 'id',
              width: 100,
              render: (value) => <Text strong>#{value}</Text>,
            },
            {
              title: '源端点',
              dataIndex: 'sourceEndpoint',
              ellipsis: true,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (value: string) => <Tag color={getStatusColor(value)}>{getStatusLabel(value)}</Tag>,
            },
            {
              title: '进度',
              width: 180,
              render: (_, record) => `${record.completedObjects}/${record.totalObjects}`,
            },
            {
              title: '错误数',
              dataIndex: 'errorCount',
              width: 100,
            },
            {
              title: '开始时间',
              dataIndex: 'startedAt',
              width: 180,
              render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-',
            },
            {
              title: '操作',
              width: 140,
              render: (_: unknown, record: MigrationJobRecord) => (
                <Space>
                  <Button size="small" onClick={() => setLatestJobId(record.id)}>查看</Button>
                  {['queued', 'running'].includes(record.status) && (
                    <Button size="small" danger onClick={() => cancelMutation.mutate(record.id)}>
                      取消
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />

        <div style={{ marginTop: 20 }}>
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="迁移任务支持状态持久化、失败回写和实时取消。"
          />
        </div>
      </Card>
    </>
  )
}
