import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, Col, Form, Input, Row, Select, Space, Table, Tag, Typography } from 'antd'
import {
  createCredential,
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  listCredentials,
  listRoles,
  listUsers,
  type CredentialRecord,
  type RoleRecord,
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

function parseCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export default function Accounts() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { isAdmin, hasPermission } = useAuth()
  const canManageUsers = isAdmin || hasPermission('user:manage')
  const canManageCredentials = isAdmin || hasPermission('credential:manage')
  const canManageRoles = isAdmin || hasPermission('role:manage')

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: listUsers,
    enabled: canManageUsers,
  })
  const { data: credentials = [] } = useQuery({
    queryKey: ['admin-credentials'],
    queryFn: () => listCredentials(),
    enabled: canManageCredentials,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: listRoles,
    enabled: canManageRoles,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-credentials'] })
    queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
  }

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data: any) => {
      invalidate()
      message.success(`用户已创建，Access Key: ${data?.accessKey || '-'}`)
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
      invalidate()
      message.success(`凭证已创建，Secret Key: ${data?.secretKey || '-'}`)
    },
    onError: (error: any) => message.error(error.response?.data?.error || '创建凭证失败'),
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

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  return (
    <>
      <section className="console-hero">
        <Title level={2} style={{ margin: 0 }}>账号管理</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          独立管理用户、角色和 Access Key，不再和订阅资源混在同一页。
        </Paragraph>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Text strong>用户 {users.length}</Text></Card>
        <Card variant="borderless"><Text strong>凭证 {credentials.length}</Text></Card>
        <Card variant="borderless"><Text strong>角色 {roles.length}</Text></Card>
        <Card variant="borderless"><Text strong>管理员 {users.filter((item) => item.isAdmin).length}</Text></Card>
      </div>

      <Row gutter={[20, 20]}>
        {canManageUsers && (
          <Col xs={24} xl={8}>
            <Card title="创建用户" variant="borderless">
              <Form
                layout="vertical"
                onFinish={(values: { username: string; password: string; displayName?: string; email?: string; isAdmin?: string; roleIds?: string }) =>
                  createUserMutation.mutate({
                    username: values.username,
                    password: values.password,
                    displayName: values.displayName,
                    email: values.email,
                    isAdmin: values.isAdmin === 'true',
                    roleIds: values.roleIds ? parseCsv(values.roleIds).map((item) => Number(item)).filter(Boolean) : undefined,
                  })
                }
              >
                <Form.Item label="用户名" name="username" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item label="密码" name="password" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
                <Form.Item label="显示名" name="displayName"><Input /></Form.Item>
                <Form.Item label="邮箱" name="email"><Input /></Form.Item>
                <Form.Item label="管理员" name="isAdmin" initialValue="false">
                  <Select options={[{ value: 'false', label: '普通用户' }, { value: 'true', label: '管理员' }]} />
                </Form.Item>
                <Form.Item label="角色 ID，逗号分隔" name="roleIds"><Input /></Form.Item>
                <Button type="primary" htmlType="submit" block loading={createUserMutation.isPending}>创建用户</Button>
              </Form>
            </Card>
          </Col>
        )}

        {canManageCredentials && (
          <Col xs={24} xl={8}>
            <Card title="创建 Access Key" variant="borderless">
              <Form
                layout="vertical"
                onFinish={(values: { userId: string; description?: string; expiresAt?: string }) =>
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
                <Button type="primary" htmlType="submit" block loading={createCredentialMutation.isPending}>创建凭证</Button>
              </Form>
            </Card>
          </Col>
        )}

        {canManageRoles && (
          <Col xs={24} xl={8}>
            <Card title="创建角色" variant="borderless">
              <Form
                layout="vertical"
                initialValues={{ permissions: 'bucket:read,bucket:write,ticket:create,ticket:read' }}
                onFinish={(values: { name: string; description?: string; permissions: string }) =>
                  createRoleMutation.mutate({
                    name: values.name,
                    description: values.description,
                    permissions: parseCsv(values.permissions),
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

      {canManageUsers && (
        <Card title="账号列表" variant="borderless">
          <Table<UserRecord>
            rowKey="id"
            dataSource={users}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 960 }}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 80 },
              { title: '用户名', dataIndex: 'username', render: (value: string, record) => <Space><Text strong>{value}</Text>{record.isAdmin && <Tag color="blue">管理员</Tag>}</Space> },
              { title: '显示名', dataIndex: 'displayName', render: (value?: string) => value || '-' },
              { title: '状态', dataIndex: 'status', width: 100 },
              { title: '角色', render: (_: unknown, record) => (record.roles || []).map((role: RoleRecord) => <Tag key={role.id}>{role.name}</Tag>) },
              {
                title: '操作',
                width: 100,
                render: (_: unknown, record) => <Button danger size="small" onClick={() => deleteUserMutation.mutate(record.id)}>删除</Button>,
              },
            ]}
          />
        </Card>
      )}

      {canManageCredentials && (
        <Card title="凭证列表" variant="borderless">
          <Table<CredentialRecord>
            rowKey="id"
            dataSource={credentials}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 960 }}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 80 },
              { title: '用户', render: (_: unknown, record) => userMap.get(record.userId)?.username || `#${record.userId}` },
              { title: 'Access Key', dataIndex: 'accessKey' },
              { title: '描述', dataIndex: 'description', render: (value?: string) => value || '-' },
              { title: '状态', dataIndex: 'status', width: 100 },
              { title: '过期时间', dataIndex: 'expiresAt', render: (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '长期' },
            ]}
          />
        </Card>
      )}

      {canManageRoles && (
        <Card title="角色列表" variant="borderless">
          <Table<RoleRecord>
            rowKey="id"
            dataSource={roles}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 960 }}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 80 },
              { title: '角色名', dataIndex: 'name' },
              { title: '描述', dataIndex: 'description', render: (value?: string) => value || '-' },
              { title: '权限', render: (_: unknown, record) => (record.permissions || []).slice(0, 4).map((item) => <Tag key={item}>{item}</Tag>) },
              {
                title: '操作',
                width: 100,
                render: (_: unknown, record) => <Button danger size="small" onClick={() => deleteRoleMutation.mutate(record.id)}>删除</Button>,
              },
            ]}
          />
        </Card>
      )}
    </>
  )
}
