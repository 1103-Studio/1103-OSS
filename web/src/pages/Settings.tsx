import { useMemo, useState } from 'react'
import { KeyOutlined, LockOutlined, SafetyCertificateOutlined, SettingOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Col, Descriptions, Form, Input, Row, Space, Table, Tag, Typography } from 'antd'
import { useAuth } from '../hooks/useAuth'
import { changePassword, getMySubscriptionProfile, getStorageEndpoint, listPublicSubscriptionPlans, redeemResourcePackCode, type SubscriptionPlanRecord, type UserSubscriptionRecord } from '../lib/api'

const { Title, Paragraph } = Typography

export default function Settings() {
  const { message } = App.useApp()
  const { credentials } = useAuth()
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const endpoint = credentials?.publicEndpoint || credentials?.endpoint || getStorageEndpoint()
  const { data: profile } = useQuery({
    queryKey: ['my-subscription-profile'],
    queryFn: getMySubscriptionProfile,
  })
  const { data: plans = [] } = useQuery({
    queryKey: ['public-subscription-plans'],
    queryFn: listPublicSubscriptionPlans,
  })
  const redeemMutation = useMutation({
    mutationFn: redeemResourcePackCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription-profile'] })
      message.success('资源包兑换成功')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '兑换失败'),
  })

  const activePlanCount = profile?.activePlans?.length || 0
  const summaryItems = useMemo(() => ([
    { label: '总存储额度', value: profile?.totalStorageBytes || 0 },
    { label: '总流量额度', value: profile?.totalTrafficBytes || 0 },
    { label: '对象额度', value: profile?.totalObjectQuota || 0 },
  ]), [profile])

  const handleChangePassword = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('新密码和确认密码不匹配')
      return
    }
    setLoading(true)
    try {
      await changePassword(values.oldPassword, values.newPassword)
      message.success('密码修改成功')
    } catch (error: any) {
      message.error(error.response?.data?.error || '密码修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="console-hero">
        <Title level={2} style={{ margin: 0 }}>设置中心</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          管理账号密码、控制台连接信息和 SDK 接入模板。浏览器端不再保存 Secret Key，仅展示安全概况和接入方式。
        </Paragraph>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card title="修改密码" variant="borderless">
            <Form layout="vertical" onFinish={handleChangePassword}>
              <Form.Item label="旧密码" name="oldPassword" rules={[{ required: true, message: '请输入旧密码' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item label="新密码" name="newPassword" rules={[{ required: true, min: 8, message: '新密码至少 8 位' }]}>
                <Input.Password prefix={<SafetyCertificateOutlined />} />
              </Form.Item>
              <Form.Item label="确认新密码" name="confirmPassword" rules={[{ required: true, message: '请再次输入新密码' }]}>
                <Input.Password prefix={<SafetyCertificateOutlined />} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>修改密码</Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card title="连接与凭证概览" variant="borderless">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="当前账号">{credentials?.displayName || credentials?.username || credentials?.accessKey}</Descriptions.Item>
              <Descriptions.Item label="Access Key">{credentials?.accessKey || '-'}</Descriptions.Item>
              <Descriptions.Item label="控制台端点">{endpoint}</Descriptions.Item>
              <Descriptions.Item label="已生效资源包">{activePlanCount}</Descriptions.Item>
              <Descriptions.Item label="Secret Key">浏览器侧不展示，统一由服务端管控</Descriptions.Item>
            </Descriptions>

            <Alert
              style={{ marginTop: 20 }}
              type="success"
              showIcon
              message="Web 控制台当前使用会话令牌与服务端预签名，不在浏览器暴露对象存储密钥。"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card title="兑换 OSS 资源包" variant="borderless">
            <Form layout="vertical" onFinish={(values: { code: string }) => redeemMutation.mutate(values.code)}>
              <Form.Item label="兑换码" name="code" rules={[{ required: true, message: '请输入兑换码' }]}>
                <Input placeholder="输入管理员发放的资源包兑换码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={redeemMutation.isPending}>立即兑换</Button>
            </Form>
            <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 16 }}>
              {summaryItems.map((item) => (
                <Alert key={item.label} type="info" showIcon message={`${item.label}: ${item.value}`} />
              ))}
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card title="可选订阅档位" variant="borderless">
            <Table<SubscriptionPlanRecord>
              rowKey="id"
              dataSource={plans}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: '档位', dataIndex: 'name', render: (value: string, record) => <Space><Title level={5} style={{ margin: 0 }}>{value}</Title><Tag>{record.code}</Tag></Space> },
                { title: '资源', render: (_: unknown, record) => `${record.storageBytes}/${record.trafficBytes}/${record.objectQuota}` },
                { title: '有效期', dataIndex: 'durationDays', width: 100, render: (value: number) => `${value} 天` },
                { title: '价格', dataIndex: 'priceCents', width: 120, render: (value: number) => `¥ ${(value || 0) / 100}` },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="我的资源包明细" variant="borderless">
        <Table<UserSubscriptionRecord>
          rowKey="id"
          dataSource={profile?.activePlans || []}
          pagination={false}
          columns={[
            { title: '来源', dataIndex: 'source' },
            { title: '存储额度', dataIndex: 'storageBytes' },
            { title: '流量额度', dataIndex: 'trafficBytes' },
            { title: '对象额度', dataIndex: 'objectQuota' },
            { title: '开始时间', dataIndex: 'startedAt', render: (value: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
            { title: '到期时间', dataIndex: 'expiresAt', render: (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '长期' },
          ]}
        />
      </Card>

      <Card title="SDK 接入示例" variant="borderless">
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={8}>
            <Card size="small" title={<><SettingOutlined /> AWS CLI</>}>
              <pre className="console-mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
{`aws configure set aws_access_key_id ${credentials?.accessKey || 'YOUR_ACCESS_KEY'}
aws configure set aws_secret_access_key YOUR_SECRET_KEY
aws configure set default.region us-east-1
aws --endpoint-url ${endpoint} s3 ls`}
              </pre>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title={<><KeyOutlined /> Python / boto3</>}>
              <pre className="console-mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
{`import boto3

s3 = boto3.client(
  's3',
  endpoint_url='${endpoint}',
  aws_access_key_id='${credentials?.accessKey || 'YOUR_ACCESS_KEY'}',
  aws_secret_access_key='YOUR_SECRET_KEY'
)`}
              </pre>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card size="small" title={<><SafetyCertificateOutlined /> JavaScript / AWS SDK</>}>
              <pre className="console-mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
{`const client = new S3Client({
  endpoint: '${endpoint}',
  region: 'us-east-1',
  credentials: {
    accessKeyId: '${credentials?.accessKey || 'YOUR_ACCESS_KEY'}',
    secretAccessKey: 'YOUR_SECRET_KEY',
  },
  forcePathStyle: true,
})`}
              </pre>
            </Card>
          </Col>
        </Row>
      </Card>
    </>
  )
}
