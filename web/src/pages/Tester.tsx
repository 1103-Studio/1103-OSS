import { useState } from 'react'
import { App, Button, Card, Col, Form, Input, Row, Space, Table, Tag, Typography } from 'antd'
import { CheckCircleOutlined, PlayCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { getMySubscriptionProfile, listBuckets } from '../lib/api'

const { Title, Paragraph, Text } = Typography

interface TestCaseResult {
  key: string
  name: string
  status: 'pending' | 'running' | 'success' | 'failed'
  detail: string
}

const initialCases: TestCaseResult[] = [
  { key: 'health-buckets', name: 'Bucket 列表读取', status: 'pending', detail: '未执行' },
  { key: 'health-subscription', name: '资源包资料读取', status: 'pending', detail: '未执行' },
  { key: 'path-parse', name: 'OSS 地址格式检查', status: 'pending', detail: '未执行' },
]

export default function Tester() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [results, setResults] = useState<TestCaseResult[]>(initialCases)
  const [running, setRunning] = useState(false)

  const updateCase = (key: string, patch: Partial<TestCaseResult>) => {
    setResults((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  const runTests = async (values: { endpoint?: string }) => {
    setRunning(true)
    setResults(initialCases)

    updateCase('health-buckets', { status: 'running', detail: '正在请求 Bucket 列表' })
    try {
      const buckets = await listBuckets()
      const count = buckets.ListAllMyBucketsResult?.Buckets?.Bucket?.length || 0
      updateCase('health-buckets', { status: 'success', detail: `读取成功，共 ${count} 个 Bucket` })
    } catch (error: any) {
      updateCase('health-buckets', { status: 'failed', detail: error?.response?.data?.error || error?.message || 'Bucket 列表读取失败' })
    }

    updateCase('health-subscription', { status: 'running', detail: '正在请求资源包资料' })
    try {
      const profile = await getMySubscriptionProfile()
      const total = profile?.activePlans?.length || 0
      updateCase('health-subscription', { status: 'success', detail: `读取成功，已生效资源包 ${total} 个` })
    } catch (error: any) {
      updateCase('health-subscription', { status: 'failed', detail: error?.response?.data?.error || error?.message || '资源包资料读取失败' })
    }

    updateCase('path-parse', { status: 'running', detail: '正在检查 OSS 地址' })
    const rawEndpoint = (values.endpoint || '').trim()
    if (!rawEndpoint) {
      updateCase('path-parse', { status: 'success', detail: '未填写自定义 OSS 地址，已跳过' })
    } else {
      try {
        const parsed = new URL(rawEndpoint)
        const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
        updateCase('path-parse', {
          status: isHttp ? 'success' : 'failed',
          detail: isHttp ? `地址合法，主机 ${parsed.host}` : '仅支持 http/https 地址',
        })
      } catch {
        updateCase('path-parse', { status: 'failed', detail: 'OSS 地址格式不合法' })
      }
    }

    setRunning(false)
    message.success('测试执行完成')
  }

  return (
    <>
      <section className="console-hero">
        <Title level={2} style={{ margin: 0 }}>控制台测试器</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          用于快速校验当前账号、Bucket 接口和资源包资料是否正常，顺手检查 OSS 地址格式。
        </Paragraph>
      </section>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card title="执行测试" variant="borderless">
            <Form form={form} layout="vertical" onFinish={runTests}>
              <Form.Item label="自定义 OSS 地址" name="endpoint">
                <Input placeholder="https://your-oss-endpoint.example.com" />
              </Form.Item>
              <Space style={{ width: '100%' }}>
                <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={running}>
                  开始测试
                </Button>
                <Button onClick={() => { form.resetFields(); setResults(initialCases) }}>
                  重置
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card title="测试结果" variant="borderless">
            <Table<TestCaseResult>
              rowKey="key"
              pagination={false}
              dataSource={results}
              columns={[
                { title: '测试项', dataIndex: 'name' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 120,
                  render: (value: TestCaseResult['status']) => {
                    if (value === 'success') return <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
                    if (value === 'failed') return <Tag icon={<WarningOutlined />} color="error">失败</Tag>
                    if (value === 'running') return <Tag color="processing">执行中</Tag>
                    return <Tag>待执行</Tag>
                  },
                },
                {
                  title: '详情',
                  dataIndex: 'detail',
                  render: (value: string) => <Text type={value.includes('失败') ? 'danger' : undefined}>{value}</Text>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  )
}
