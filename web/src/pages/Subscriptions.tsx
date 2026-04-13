import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography } from 'antd'
import {
  createResourcePackCodes,
  createSubscriptionPlan,
  listResourcePackCodes,
  listSubscriptionPlans,
  updateSubscriptionPlan,
  type ResourcePackCodeRecord,
  type SubscriptionPlanRecord,
} from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const { Title, Paragraph, Text } = Typography

export default function Subscriptions() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { isAdmin, hasPermission } = useAuth()
  const canManageSubscriptions = isAdmin || hasPermission('subscription:manage')
  const canViewSubscriptions = canManageSubscriptions || hasPermission('subscription:read')
  const canManageRedeemCodes = isAdmin || hasPermission('redemption:manage', 'subscription:manage')

  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(true),
    enabled: canViewSubscriptions,
  })
  const { data: resourcePackCodes = [] } = useQuery({
    queryKey: ['resource-pack-codes'],
    queryFn: () => listResourcePackCodes(100),
    enabled: canViewSubscriptions || canManageRedeemCodes,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
    queryClient.invalidateQueries({ queryKey: ['resource-pack-codes'] })
  }

  const saveSubscriptionPlanMutation = useMutation({
    mutationFn: (values: {
      id?: number
      name: string
      code: string
      description?: string
      storageBytes: number
      trafficBytes: number
      objectQuota: number
      durationDays: number
      priceCents: number
      status: string
    }) => values.id ? updateSubscriptionPlan(values.id, values) : createSubscriptionPlan(values),
    onSuccess: () => {
      invalidate()
      message.success('订阅档位已保存')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '保存订阅档位失败'),
  })

  const createResourcePackCodesMutation = useMutation({
    mutationFn: createResourcePackCodes,
    onSuccess: (items: ResourcePackCodeRecord[]) => {
      invalidate()
      message.success(`已生成 ${items.length} 个兑换码`)
    },
    onError: (error: any) => message.error(error.response?.data?.error || '生成兑换码失败'),
  })

  return (
    <>
      <section className="console-hero">
        <Title level={2} style={{ margin: 0 }}>订阅资源</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          独立管理订阅档位、兑换码和 OSS 资源包发放。
        </Paragraph>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Text strong>订阅档位 {subscriptionPlans.length}</Text></Card>
        <Card variant="borderless"><Text strong>兑换码 {resourcePackCodes.length}</Text></Card>
        <Card variant="borderless"><Text strong>可用兑换码 {resourcePackCodes.filter((item) => item.status === 'active').length}</Text></Card>
        <Card variant="borderless"><Text strong>已使用 {resourcePackCodes.filter((item) => item.status === 'redeemed').length}</Text></Card>
      </div>

      <Row gutter={[20, 20]}>
        {canManageSubscriptions && (
          <Col xs={24} xl={12}>
            <Card title="订阅档位" variant="borderless">
              <Form
                layout="vertical"
                initialValues={{ durationDays: 30, priceCents: 0, status: 'active', storageBytes: 0, trafficBytes: 0, objectQuota: 0 }}
                onFinish={(values: { name: string; code: string; description?: string; storageBytes: number; trafficBytes: number; objectQuota: number; durationDays: number; priceCents: number; status: string }) =>
                  saveSubscriptionPlanMutation.mutate(values)
                }
              >
                <Form.Item label="档位名称" name="name" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item label="档位编码" name="code" rules={[{ required: true }]}><Input placeholder="BASIC-100G" /></Form.Item>
                <Form.Item label="描述" name="description"><Input.TextArea rows={3} /></Form.Item>
                <Row gutter={12}>
                  <Col span={8}><Form.Item label="存储字节" name="storageBytes"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="流量字节" name="trafficBytes"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="对象数" name="objectQuota"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                </Row>
                <Row gutter={12}>
                  <Col span={8}><Form.Item label="有效期天数" name="durationDays"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="价格分" name="priceCents"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="状态" name="status"><Select options={[{ value: 'active', label: '启用' }, { value: 'disabled', label: '停用' }]} /></Form.Item></Col>
                </Row>
                <Button type="primary" htmlType="submit" block loading={saveSubscriptionPlanMutation.isPending}>保存档位</Button>
              </Form>
            </Card>
          </Col>
        )}

        {canManageRedeemCodes && (
          <Col xs={24} xl={12}>
            <Card title="兑换码生成" variant="borderless">
              <Form
                layout="vertical"
                initialValues={{ quantity: 1, durationDays: 30 }}
                onFinish={(values: { planId?: number; label?: string; code?: string; storageBytes?: number; trafficBytes?: number; objectQuota?: number; durationDays?: number; expiresAt?: string; quantity?: number }) =>
                  createResourcePackCodesMutation.mutate(values)
                }
              >
                <Form.Item label="关联档位" name="planId">
                  <Select allowClear options={subscriptionPlans.map((item: SubscriptionPlanRecord) => ({ value: item.id, label: `${item.name} (${item.code})` }))} />
                </Form.Item>
                <Form.Item label="标签" name="label"><Input /></Form.Item>
                <Form.Item label="固定兑换码" name="code"><Input placeholder="留空自动生成" /></Form.Item>
                <Row gutter={12}>
                  <Col span={8}><Form.Item label="存储字节" name="storageBytes"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="流量字节" name="trafficBytes"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="对象数" name="objectQuota"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                </Row>
                <Row gutter={12}>
                  <Col span={8}><Form.Item label="有效期天数" name="durationDays"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
                  <Col span={8}><Form.Item label="失效时间" name="expiresAt"><Input placeholder="RFC3339，可留空" /></Form.Item></Col>
                  <Col span={8}><Form.Item label="生成数量" name="quantity"><InputNumber style={{ width: '100%' }} min={1} max={100} /></Form.Item></Col>
                </Row>
                <Button type="primary" htmlType="submit" block loading={createResourcePackCodesMutation.isPending}>生成兑换码</Button>
              </Form>
            </Card>
          </Col>
        )}
      </Row>

      {canViewSubscriptions && (
        <Card title="档位列表" variant="borderless">
          <Table<SubscriptionPlanRecord>
            rowKey="id"
            dataSource={subscriptionPlans}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 960 }}
            columns={[
              { title: '名称', dataIndex: 'name', render: (value: string, record) => <Space><Text strong>{value}</Text><Tag>{record.code}</Tag></Space> },
              { title: '资源', render: (_: unknown, record) => `${record.storageBytes}/${record.trafficBytes}/${record.objectQuota}` },
              { title: '有效期', dataIndex: 'durationDays', width: 96, render: (value: number) => `${value} 天` },
              { title: '价格', dataIndex: 'priceCents', width: 120, render: (value: number) => `¥ ${(value || 0) / 100}` },
              { title: '状态', dataIndex: 'status', width: 96, render: (value: string) => <Tag color={value === 'active' ? 'green' : 'default'}>{value}</Tag> },
            ]}
          />
        </Card>
      )}

      {(canManageRedeemCodes || canViewSubscriptions) && (
        <Card title="兑换码列表" variant="borderless">
          <Table<ResourcePackCodeRecord>
            rowKey="id"
            dataSource={resourcePackCodes}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 960 }}
            columns={[
              { title: '兑换码', dataIndex: 'code', render: (value: string) => <Text copyable>{value}</Text> },
              { title: '标签', dataIndex: 'label', render: (value?: string) => value || '-' },
              { title: '资源', render: (_: unknown, record) => `${record.storageBytes}/${record.trafficBytes}/${record.objectQuota}` },
              { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <Tag color={value === 'redeemed' ? 'blue' : value === 'active' ? 'green' : 'default'}>{value}</Tag> },
              { title: '使用人', dataIndex: 'redeemedByUserId', width: 100, render: (value?: number | null) => value || '-' },
            ]}
          />
        </Card>
      )}
    </>
  )
}
