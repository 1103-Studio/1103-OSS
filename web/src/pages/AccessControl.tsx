import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import {
  createResourcePackCodes,
  createCredential,
  createRole,
  createSubscriptionPlan,
  createUser,
  deleteBucketAccess,
  deleteRole,
  deleteUser,
  listAdminBuckets,
  listBucketAccess,
  listResourcePackCodes,
  listRoles,
  listSubscriptionPlans,
  listUsers,
  updateSubscriptionPlan,
  updateAdminBucket,
  upsertBucketAccess,
  type BucketAccessRecord,
  type BucketAdminRecord,
  type ResourcePackCodeRecord,
  type RoleRecord,
  type SubscriptionPlanRecord,
  type UserRecord,
} from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const { Title, Paragraph, Text } = Typography

const permissionOptions = [
  'user:manage',
  'credential:manage',
  'role:manage',
  'bucket:manage',
  'bucket:read',
  'bucket:write',
  'bucket:assign',
  'bucket:policy',
  'bucket:quota',
  'bucket:traffic',
  'ticket:create',
  'ticket:read',
  'ticket:manage',
  'subscription:manage',
  'subscription:read',
  'redemption:manage',
  'redemption:use',
]

function parseCsvPermissions(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export default function AccessControl() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { isAdmin, hasPermission } = useAuth()
  const canManageUsers = isAdmin || hasPermission('user:manage')
  const canManageCredentials = isAdmin || hasPermission('credential:manage')
  const canManageRoles = isAdmin || hasPermission('role:manage')
  const canManageBucketAssignments = isAdmin || hasPermission('bucket:manage', 'bucket:assign')
  const canManageBucketSettings = isAdmin || hasPermission('bucket:manage', 'bucket:quota', 'bucket:traffic', 'bucket:policy')
  const canManageSubscriptions = isAdmin || hasPermission('subscription:manage')
  const canViewSubscriptions = canManageSubscriptions || hasPermission('subscription:read')
  const canManageRedeemCodes = isAdmin || hasPermission('redemption:manage', 'subscription:manage')

  const [selectedBucketId, setSelectedBucketId] = useState<number | null>(null)

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listUsers,
    enabled: canManageUsers,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listRoles,
    enabled: canManageRoles,
  })
  const { data: buckets = [] } = useQuery({
    queryKey: ['admin-buckets'],
    queryFn: listAdminBuckets,
    enabled: canManageBucketAssignments || canManageBucketSettings,
  })
  const { data: accessList = [] } = useQuery({
    queryKey: ['bucket-access', selectedBucketId],
    queryFn: () => listBucketAccess(selectedBucketId as number),
    enabled: !!selectedBucketId && canManageBucketAssignments,
  })
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(true),
    enabled: canViewSubscriptions,
  })
  const { data: resourcePackCodes = [] } = useQuery({
    queryKey: ['resource-pack-codes'],
    queryFn: () => listResourcePackCodes(100),
    enabled: canManageRedeemCodes || canViewSubscriptions,
  })

  const usersById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
    queryClient.invalidateQueries({ queryKey: ['admin-buckets'] })
    queryClient.invalidateQueries({ queryKey: ['bucket-access'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })
    queryClient.invalidateQueries({ queryKey: ['resource-pack-codes'] })
  }

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      invalidate()
      message.success('用户已创建')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '创建用户失败'),
  })

  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      invalidate()
      message.success('角色已创建')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '创建角色失败'),
  })

  const createCredentialMutation = useMutation({
    mutationFn: createCredential,
    onSuccess: (data: any) => {
      message.success(`Key 已创建: ${data?.credential?.accessKey || ''}`)
    },
    onError: (error: any) => message.error(error.response?.data?.error || '创建 Key 失败'),
  })

  const updateBucketMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateAdminBucket(id, data),
    onSuccess: () => {
      invalidate()
      message.success('存储桶治理配置已更新')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '更新存储桶失败'),
  })

  const bucketAccessMutation = useMutation({
    mutationFn: ({ bucketId, userId, permission }: { bucketId: number; userId: number; permission: string }) =>
      upsertBucketAccess(bucketId, { userId, permission }),
    onSuccess: () => {
      invalidate()
      message.success('桶授权已更新')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '桶授权失败'),
  })

  const deleteBucketAccessMutation = useMutation({
    mutationFn: ({ bucketId, userId }: { bucketId: number; userId: number }) => deleteBucketAccess(bucketId, userId),
    onSuccess: () => {
      invalidate()
      message.success('桶授权已移除')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '删除桶授权失败'),
  })

  const deleteUserMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      invalidate()
      message.success('用户已删除')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '删除用户失败'),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      invalidate()
      message.success('角色已删除')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '删除角色失败'),
  })

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
        <Title level={2} style={{ margin: 0 }}>访问控制中心</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          统一治理 Bucket 授权、桶级治理和权限模板。账号与订阅资源已拆到独立后台页面。
        </Paragraph>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Statistic title="用户总数" value={users.length} /></Card>
        <Card variant="borderless"><Statistic title="角色数量" value={roles.length} /></Card>
        <Card variant="borderless"><Statistic title="Bucket 治理" value={buckets.length} /></Card>
        <Card variant="borderless"><Statistic title="权限模板" value={permissionOptions.length} /></Card>
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

        {canManageUsers && (
          <Col xs={24} xl={12}>
            <Card title="创建用户" variant="borderless">
              <Form
                layout="vertical"
                onFinish={(values: { username: string; password: string; displayName?: string; email?: string; isAdmin?: boolean; roleIds?: string; bucketNames?: string }) =>
                  createUserMutation.mutate({
                    username: values.username,
                    password: values.password,
                    displayName: values.displayName,
                    email: values.email,
                    isAdmin: values.isAdmin,
                    roleIds: values.roleIds ? parseCsvPermissions(values.roleIds).map((item) => Number(item)).filter(Boolean) : undefined,
                    bucketNames: values.bucketNames ? parseCsvPermissions(values.bucketNames) : undefined,
                  })
                }
              >
                <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="密码" name="password" rules={[{ required: true, min: 8 }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item label="显示名" name="displayName"><Input /></Form.Item>
                <Form.Item label="邮箱" name="email"><Input /></Form.Item>
                <Form.Item label="角色 ID，逗号分隔" name="roleIds"><Input /></Form.Item>
                <Form.Item label="预授权 Bucket，逗号分隔" name="bucketNames"><Input /></Form.Item>
                <Button type="primary" htmlType="submit" block loading={createUserMutation.isPending}>创建用户</Button>
              </Form>
            </Card>
          </Col>
        )}

        {canManageRoles && (
          <Col xs={24} xl={12}>
            <Card title="创建角色" variant="borderless">
              <Form
                layout="vertical"
                initialValues={{ permissions: 'bucket:read,bucket:write,ticket:create,ticket:read' }}
                onFinish={(values: { name: string; description?: string; permissions: string }) =>
                  createRoleMutation.mutate({
                    name: values.name,
                    description: values.description,
                    permissions: parseCsvPermissions(values.permissions),
                  })
                }
              >
                <Form.Item label="角色名" name="name" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item label="描述" name="description"><Input /></Form.Item>
                <Form.Item label="权限，逗号分隔" name="permissions"><Input.TextArea rows={4} /></Form.Item>
                <Space wrap style={{ marginBottom: 16 }}>
                  {permissionOptions.map((item) => <Tag key={item}>{item}</Tag>)}
                </Space>
                <Button type="primary" htmlType="submit" block loading={createRoleMutation.isPending}>创建角色</Button>
              </Form>
            </Card>
          </Col>
        )}
      </Row>

      <Row gutter={[20, 20]}>
        {canManageCredentials && (
          <Col xs={24} xl={10}>
            <Card title="创建 Access Key" variant="borderless">
              <Form
                layout="vertical"
                onFinish={(values: { userId: number; description?: string; expiresAt?: string }) =>
                  createCredentialMutation.mutate({
                    userId: Number(values.userId),
                    description: values.description,
                    expiresAt: values.expiresAt || null,
                  })
                }
              >
                <Form.Item label="用户 ID" name="userId" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item label="描述" name="description"><Input /></Form.Item>
                <Form.Item label="过期时间 RFC3339" name="expiresAt"><Input /></Form.Item>
                <Button type="primary" htmlType="submit" block loading={createCredentialMutation.isPending}>创建 Access Key</Button>
              </Form>
            </Card>
          </Col>
        )}

        {(canManageBucketAssignments || canManageBucketSettings) && (
          <Col xs={24} xl={14}>
            <Card title="Bucket 治理" variant="borderless">
              <Table<BucketAdminRecord>
                rowKey="id"
                dataSource={buckets}
                pagination={false}
                scroll={{ x: 900 }}
                columns={[
                  { title: 'Bucket', dataIndex: 'name' },
                  { title: 'ACL', dataIndex: 'acl', width: 120 },
                  { title: '默认时效', dataIndex: 'defaultExpiry', width: 120 },
                  { title: '流量上限', dataIndex: 'maxTrafficBytes', width: 140 },
                  {
                    title: '操作',
                    width: 280,
                    render: (_: unknown, record) => (
                      <Space wrap>
                        {canManageBucketAssignments && (
                          <Button size="small" onClick={() => setSelectedBucketId(record.id)}>查看授权</Button>
                        )}
                        {canManageBucketSettings && (
                          <Button
                            size="small"
                            onClick={() => updateBucketMutation.mutate({
                              id: record.id,
                              data: { defaultExpiry: record.defaultExpiry || '7d', acl: record.acl || 'private' },
                            })}
                          >
                            保存默认配置
                          </Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        )}
      </Row>

      <Row gutter={[20, 20]}>
        {canViewSubscriptions && (
          <Col xs={24} xl={12}>
            <Card title="档位列表" variant="borderless">
              <Table<SubscriptionPlanRecord>
                rowKey="id"
                dataSource={subscriptionPlans}
                pagination={{ pageSize: 6 }}
                columns={[
                  { title: '名称', dataIndex: 'name', render: (value: string, record) => <Space><Text strong>{value}</Text><Tag>{record.code}</Tag></Space> },
                  { title: '资源', render: (_: unknown, record) => `${record.storageBytes}/${record.trafficBytes}/${record.objectQuota}` },
                  { title: '有效期', dataIndex: 'durationDays', width: 96, render: (value: number) => `${value} 天` },
                  { title: '状态', dataIndex: 'status', width: 96, render: (value: string) => <Tag color={value === 'active' ? 'green' : 'default'}>{value}</Tag> },
                ]}
              />
            </Card>
          </Col>
        )}

        {(canManageRedeemCodes || canViewSubscriptions) && (
          <Col xs={24} xl={12}>
            <Card title="兑换码列表" variant="borderless">
              <Table<ResourcePackCodeRecord>
                rowKey="id"
                dataSource={resourcePackCodes}
                pagination={{ pageSize: 6 }}
                columns={[
                  { title: '兑换码', dataIndex: 'code', render: (value: string) => <Text copyable>{value}</Text> },
                  { title: '标签', dataIndex: 'label', render: (value?: string) => value || '-' },
                  { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => <Tag color={value === 'redeemed' ? 'blue' : value === 'active' ? 'green' : 'default'}>{value}</Tag> },
                  { title: '使用人', dataIndex: 'redeemedByUserId', width: 100, render: (value?: number | null) => value || '-' },
                ]}
              />
            </Card>
          </Col>
        )}

        {canManageUsers && (
          <Col xs={24} xl={12}>
            <Card title="账号列表" variant="borderless">
              <Table<UserRecord>
                rowKey="id"
                dataSource={users}
                pagination={{ pageSize: 8 }}
                columns={[
                  { title: '用户名', dataIndex: 'username', render: (value: string) => <Text strong>{value}</Text> },
                  { title: '角色', render: (_: unknown, record) => (record.roles || []).map((role: RoleRecord) => <Tag key={role.id}>{role.name}</Tag>) },
                  { title: '资源包', render: (_: unknown, record) => record.subscription?.activePlans?.length || 0 },
                  { title: '状态', dataIndex: 'status', width: 100 },
                  {
                    title: '操作',
                    width: 100,
                    render: (_: unknown, record) => <Button danger size="small" onClick={() => deleteUserMutation.mutate(record.id)}>删除</Button>,
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        {canManageRoles && (
          <Col xs={24} xl={12}>
            <Card title="角色列表" variant="borderless">
              <Table<RoleRecord>
                rowKey="id"
                dataSource={roles}
                pagination={{ pageSize: 8 }}
                columns={[
                  { title: '角色名', dataIndex: 'name' },
                  { title: '描述', dataIndex: 'description' },
                  { title: '权限', render: (_: unknown, record) => (record.permissions || []).slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>) },
                  {
                    title: '操作',
                    width: 100,
                    render: (_: unknown, record) => <Button danger size="small" onClick={() => deleteRoleMutation.mutate(record.id)}>删除</Button>,
                  },
                ]}
              />
            </Card>
          </Col>
        )}
      </Row>

      {selectedBucketId && canManageBucketAssignments && (
        <Card title={`Bucket 授权中心 · #${selectedBucketId}`} variant="borderless">
          <Row gutter={[20, 20]}>
            <Col xs={24} xl={8}>
              <Form
                layout="vertical"
                initialValues={{ permission: 'read' }}
                onFinish={(values: { userId: number; permission: string }) =>
                  bucketAccessMutation.mutate({
                    bucketId: selectedBucketId,
                    userId: Number(values.userId),
                    permission: values.permission,
                  })
                }
              >
                <Form.Item label="用户 ID" name="userId" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item label="权限" name="permission">
                  <Select options={[{ value: 'read' }, { value: 'write' }, { value: 'admin' }]} />
                </Form.Item>
                <Button type="primary" htmlType="submit" block>保存授权</Button>
              </Form>
            </Col>
            <Col xs={24} xl={16}>
              <Table<BucketAccessRecord>
                rowKey="id"
                dataSource={accessList}
                pagination={false}
                columns={[
                  {
                    title: '用户',
                    render: (_: unknown, record) => usersById.get(record.userId)?.username || `#${record.userId}`,
                  },
                  { title: '权限', dataIndex: 'permission' },
                  { title: '更新时间', dataIndex: 'updatedAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
                  {
                    title: '操作',
                    render: (_: unknown, record) => (
                      <Button danger size="small" onClick={() => deleteBucketAccessMutation.mutate({ bucketId: selectedBucketId, userId: record.userId })}>
                        移除
                      </Button>
                    ),
                  },
                ]}
              />
            </Col>
          </Row>
        </Card>
      )}
    </>
  )
}
