import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { getAuditLogStats, listAuditLogs, type AuditLogRecord } from '../lib/api'

const { Title, Paragraph, Text } = Typography

function getStatusColor(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 400) return 'error'
  return 'default'
}

function getActionColor(action: string) {
  if (action.includes('CREATE')) return 'green'
  if (action.includes('DELETE')) return 'red'
  if (action.includes('UPDATE') || action.includes('UPLOAD')) return 'blue'
  return 'default'
}

export default function AuditLogs() {
  const [filter, setFilter] = useState({
    action: '',
    resource_type: '',
    bucket_name: '',
    limit: 50,
  })

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filter],
    queryFn: () => listAuditLogs(filter),
  })

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: getAuditLogStats,
  })

  const latestFailure = useMemo(() => logs.find((item) => item.status_code >= 400) || null, [logs])

  return (
    <>
      <section className="console-hero">
        <Title level={2} style={{ margin: 0 }}>审计中心</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          统一查看对象操作、配置变更和风险轨迹，支撑追责与故障定位。
        </Paragraph>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Statistic title="总操作数" value={stats?.total_operations || 0} /></Card>
        <Card variant="borderless"><Statistic title="活跃用户" value={stats?.unique_users || 0} /></Card>
        <Card variant="borderless"><Statistic title="失败操作" value={stats?.failed_operations || 0} /></Card>
        <Card variant="borderless"><Statistic title="对象操作量" value={stats?.object_operations || 0} /></Card>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card title="筛选条件" variant="borderless">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Select
                value={filter.action || undefined}
                allowClear
                placeholder="所有操作"
                onChange={(value) => setFilter({ ...filter, action: value || '' })}
                options={[
                  { value: 'CREATE_BUCKET', label: '创建 Bucket' },
                  { value: 'DELETE_BUCKET', label: '删除 Bucket' },
                  { value: 'UPLOAD_OBJECT', label: '上传对象' },
                  { value: 'DELETE_OBJECT', label: '删除对象' },
                  { value: 'SET_BUCKET_POLICY', label: '设置权限' },
                ]}
              />
              <Select
                value={filter.resource_type || undefined}
                allowClear
                placeholder="所有资源类型"
                onChange={(value) => setFilter({ ...filter, resource_type: value || '' })}
                options={[
                  { value: 'BUCKET', label: 'Bucket' },
                  { value: 'OBJECT', label: 'Object' },
                  { value: 'POLICY', label: 'Policy' },
                  { value: 'USER', label: 'User' },
                ]}
              />
              <Input
                placeholder="Bucket 名称"
                value={filter.bucket_name}
                onChange={(e) => setFilter({ ...filter, bucket_name: e.target.value })}
              />
              <Select
                value={filter.limit}
                onChange={(value) => setFilter({ ...filter, limit: value })}
                options={[
                  { value: 50, label: '50 条' },
                  { value: 100, label: '100 条' },
                  { value: 200, label: '200 条' },
                ]}
              />
            </Space>
          </Card>

          <Card title="最近失败事件" variant="borderless">
            {latestFailure ? (
              <Alert
                type="error"
                showIcon
                message={`${latestFailure.action} · ${latestFailure.status_code}`}
                description={latestFailure.bucket_name || latestFailure.resource_name || latestFailure.error_message || '未命名资源'}
              />
            ) : (
              <Alert type="success" showIcon message="当前筛选结果内暂无失败操作。" />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card title="审计明细" variant="borderless">
            <Table<AuditLogRecord>
              rowKey="id"
              loading={isLoading}
              dataSource={logs}
              scroll={{ x: 1100 }}
              pagination={{ pageSize: 20 }}
              columns={[
                {
                  title: '时间',
                  dataIndex: 'created_at',
                  width: 180,
                  render: (value: string) => new Date(value).toLocaleString('zh-CN'),
                },
                {
                  title: '用户',
                  dataIndex: 'username',
                  width: 140,
                  render: (value: string) => <Text strong>{value || 'Unknown'}</Text>,
                },
                {
                  title: '动作',
                  dataIndex: 'action',
                  width: 160,
                  render: (value: string) => <Tag color={getActionColor(value)}>{value}</Tag>,
                },
                {
                  title: '资源',
                  width: 260,
                  render: (_: unknown, record) => (
                    <Space direction="vertical" size={0}>
                      {record.bucket_name && <Text type="secondary">Bucket: {record.bucket_name}</Text>}
                      {record.object_key && <Text type="secondary">Key: {record.object_key}</Text>}
                      {record.resource_name && <Text>{record.resource_name}</Text>}
                    </Space>
                  ),
                },
                {
                  title: 'IP',
                  dataIndex: 'ip_address',
                  width: 140,
                  render: (value: string) => <span className="console-mono">{value}</span>,
                },
                {
                  title: '状态',
                  dataIndex: 'status_code',
                  width: 120,
                  render: (value: number) => <Tag color={getStatusColor(value)}>{value}</Tag>,
                },
                {
                  title: '错误',
                  dataIndex: 'error_message',
                  ellipsis: true,
                  render: (value?: string) => value || '-',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
