import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  EditOutlined,
  EyeOutlined,
  MessageOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { createTicket, createTicketMessage, getTicket, listAdminBuckets, listTickets, updateTicket, type TicketRecord } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const { Title, Paragraph, Text } = Typography

function getStatusColor(status: string) {
  switch (status) {
    case 'resolved':
      return 'success'
    case 'closed':
      return 'default'
    case 'pending':
      return 'warning'
    default:
      return 'processing'
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent':
      return 'red'
    case 'high':
      return 'orange'
    case 'low':
      return 'default'
    default:
      return 'blue'
  }
}

const statusOptions = [{ value: 'open' }, { value: 'pending' }, { value: 'resolved' }, { value: 'closed' }]
const priorityOptions = [{ value: 'low' }, { value: 'medium' }, { value: 'high' }, { value: 'urgent' }]
const categoryOptions = [{ value: 'general' }, { value: 'billing' }, { value: 'bucket' }, { value: 'access' }, { value: 'security' }]

export default function Tickets() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { isAdmin, hasPermission } = useAuth()
  const canManageTickets = isAdmin || hasPermission('ticket:manage')
  const canCreateTickets = canManageTickets || hasPermission('ticket:create')
  const canReadTickets = canManageTickets || hasPermission('ticket:read')
  const canQueryAdminBuckets = isAdmin || hasPermission('bucket:manage', 'bucket:assign', 'bucket:quota', 'bucket:traffic', 'bucket:policy')
  const scope = canManageTickets ? 'admin' : 'user'

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [filter, setFilter] = useState({ status: '', priority: '', category: '' })
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [messageForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', scope, filter],
    queryFn: () => listTickets(scope, filter),
    enabled: canReadTickets,
  })

  const { data: buckets = [] } = useQuery({
    queryKey: ['admin-buckets-minimal'],
    queryFn: listAdminBuckets,
    enabled: canQueryAdminBuckets,
  })

  const { data: ticketDetail } = useQuery({
    queryKey: ['ticket-detail', scope, selectedTicketId],
    queryFn: () => getTicket(selectedTicketId as number, scope),
    enabled: !!selectedTicketId,
  })

  useEffect(() => {
    if (!ticketDetail?.ticket) {
      editForm.resetFields()
      return
    }

    editForm.setFieldsValue({
      status: ticketDetail.ticket.status,
      priority: ticketDetail.ticket.priority,
      category: ticketDetail.ticket.category,
      assigneeId: ticketDetail.ticket.assigneeId ? String(ticketDetail.ticket.assigneeId) : '',
      description: ticketDetail.ticket.description,
    })
  }, [editForm, ticketDetail])

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === 'open').length
    const pending = tickets.filter((ticket) => ticket.status === 'pending').length
    const urgent = tickets.filter((ticket) => ticket.priority === 'urgent').length
    return { total: tickets.length, open, pending, urgent }
  }, [tickets])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['ticket-detail'] })
  }

  const createTicketMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      invalidate()
      createForm.resetFields()
      setCreateOpen(false)
      message.success('工单已创建')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '创建工单失败'),
  })

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateTicket(id, data, scope),
    onSuccess: () => {
      invalidate()
      setEditOpen(false)
      message.success('工单已更新')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '更新工单失败'),
  })

  const createMessageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => createTicketMessage(id, data, scope),
    onSuccess: () => {
      invalidate()
      messageForm.resetFields()
      setMessageOpen(false)
      message.success('回复已发送')
    },
    onError: (error: any) => message.error(error.response?.data?.error || '回复失败'),
  })

  const openTicketDetail = (ticketId: number) => {
    setSelectedTicketId(ticketId)
    setDetailOpen(true)
  }

  const ticket = ticketDetail?.ticket

  return (
    <>
      <section className="console-hero">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>工单中心</Title>
              <Paragraph style={{ maxWidth: 760, marginTop: 10, marginBottom: 0 }}>
                按云控制台工单中心方式处理故障协同、权限申请与 Bucket 问题。
              </Paragraph>
            </div>
            {canCreateTickets && (
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                新建工单
              </Button>
            )}
          </Space>
        </Space>
      </section>

      <div className="console-metrics">
        <Card variant="borderless"><Statistic title="工单总量" value={stats.total} /></Card>
        <Card variant="borderless"><Statistic title="待处理" value={stats.open + stats.pending} /></Card>
        <Card variant="borderless"><Statistic title="紧急单" value={stats.urgent} /></Card>
        <Card variant="borderless"><Statistic title="当前视图" value={canManageTickets ? '管理端' : '用户端'} /></Card>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={6}>
          <Card title="筛选条件" variant="borderless">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Select allowClear placeholder="全部状态" onChange={(value) => setFilter({ ...filter, status: value || '' })} options={statusOptions} />
              <Select allowClear placeholder="全部优先级" onChange={(value) => setFilter({ ...filter, priority: value || '' })} options={priorityOptions} />
              <Select allowClear placeholder="全部分类" onChange={(value) => setFilter({ ...filter, category: value || '' })} options={categoryOptions} />
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={18}>
          <Card title="工单队列" variant="borderless">
            <Table<TicketRecord>
              rowKey="id"
              loading={isLoading}
              dataSource={tickets}
              scroll={{ x: 980 }}
              pagination={{ pageSize: 8 }}
              onRow={(record) => ({ onDoubleClick: () => openTicketDetail(record.id) })}
              columns={[
                {
                  title: '标题',
                  dataIndex: 'title',
                  render: (value: string) => <Text strong>{value}</Text>,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 120,
                  render: (value: string) => <Tag color={getStatusColor(value)}>{value}</Tag>,
                },
                {
                  title: '优先级',
                  dataIndex: 'priority',
                  width: 120,
                  render: (value: string) => <Tag color={getPriorityColor(value)}>{value}</Tag>,
                },
                {
                  title: '分类',
                  dataIndex: 'category',
                  width: 120,
                },
                {
                  title: 'Bucket',
                  dataIndex: 'bucketName',
                  width: 140,
                  render: (value?: string) => value || '-',
                },
                {
                  title: '更新时间',
                  dataIndex: 'updatedAt',
                  width: 180,
                  render: (value: string) => new Date(value).toLocaleString('zh-CN'),
                },
                {
                  title: '操作',
                  width: 120,
                  render: (_: unknown, record) => (
                    <Button type="link" icon={<EyeOutlined />} onClick={() => openTicketDetail(record.id)}>
                      查看
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {canCreateTickets && (
        <Modal
          title="新建工单"
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          footer={null}
          destroyOnClose
          width={680}
        >
          <Form
            form={createForm}
            layout="vertical"
            initialValues={{ category: 'general', priority: 'medium' }}
            onFinish={(values: { title: string; description: string; category: string; priority: string; bucketId?: number }) =>
              createTicketMutation.mutate({
                title: values.title,
                description: values.description,
                category: values.category,
                priority: values.priority,
                bucketId: values.bucketId || null,
              })
            }
          >
            <Form.Item label="工单标题" name="title" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="问题描述" name="description" rules={[{ required: true }]}>
              <Input.TextArea rows={5} />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item label="分类" name="category">
                  <Select options={categoryOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="优先级" name="priority">
                  <Select options={priorityOptions} />
                </Form.Item>
              </Col>
            </Row>
            {canQueryAdminBuckets && (
              <Form.Item label="关联 Bucket" name="bucketId">
                <Select allowClear options={buckets.map((bucket) => ({ value: bucket.id, label: bucket.name }))} />
              </Form.Item>
            )}
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createTicketMutation.isPending}>
                提交工单
              </Button>
            </Space>
          </Form>
        </Modal>
      )}

      <Drawer
        title={ticket ? `工单详情 #${ticket.id}` : '工单详情'}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setEditOpen(false)
          setMessageOpen(false)
        }}
        width={760}
        destroyOnClose={false}
      >
        {!ticket ? (
          <Paragraph type="secondary">正在加载工单详情。</Paragraph>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small">
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{ticket.title}</Title>
                  <Paragraph style={{ marginTop: 10, marginBottom: 0 }}>{ticket.description}</Paragraph>
                </div>
                <Space wrap>
                  <Tag color={getStatusColor(ticket.status)}>{ticket.status}</Tag>
                  <Tag color={getPriorityColor(ticket.priority)}>{ticket.priority}</Tag>
                  <Tag>{ticket.category}</Tag>
                  {ticket.bucketName && <Tag>{ticket.bucketName}</Tag>}
                </Space>
                <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
                  <Text type="secondary">更新时间：{new Date(ticket.updatedAt).toLocaleString('zh-CN')}</Text>
                  <Space>
                    <Button icon={<MessageOutlined />} onClick={() => setMessageOpen(true)}>回复</Button>
                    <Button type="primary" icon={<EditOutlined />} onClick={() => setEditOpen(true)}>编辑</Button>
                  </Space>
                </Space>
              </Space>
            </Card>

            <Card size="small" title="消息流">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {ticketDetail?.messages?.length ? ticketDetail.messages.map((item) => (
                  <Card key={item.id} size="small">
                    <Space direction="vertical" size={4}>
                      <Text strong>{item.author || item.authorId}</Text>
                      <Text type="secondary">{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
                      <Paragraph style={{ marginBottom: 0 }}>{item.message}</Paragraph>
                      {item.isInternal && <Tag color="orange">内部备注</Tag>}
                    </Space>
                  </Card>
                )) : (
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>当前还没有消息记录。</Paragraph>
                )}
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={ticket ? `编辑工单 #${ticket.id}` : '编辑工单'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        destroyOnClose={false}
        width={720}
      >
        {ticket && (
          <Form
            form={editForm}
            layout="vertical"
            onFinish={(values: { status: string; priority: string; category: string; assigneeId?: string; description?: string }) =>
              updateTicketMutation.mutate({
                id: ticket.id,
                data: {
                  status: values.status,
                  priority: values.priority,
                  category: values.category,
                  assigneeId: values.assigneeId ? Number(values.assigneeId) : null,
                  description: values.description,
                },
              })
            }
          >
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item label="状态" name="status">
                  <Select options={statusOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="优先级" name="priority">
                  <Select options={priorityOptions} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="分类" name="category">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            {canManageTickets && (
              <Form.Item label="指派用户 ID" name="assigneeId">
                <Input />
              </Form.Item>
            )}
            <Form.Item label="处理说明" name="description">
              <Input.TextArea rows={5} />
            </Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={updateTicketMutation.isPending}>
                保存更新
              </Button>
            </Space>
          </Form>
        )}
      </Modal>

      <Modal
        title={ticket ? `回复工单 #${ticket.id}` : '回复工单'}
        open={messageOpen}
        onCancel={() => setMessageOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        {ticket && (
          <Form
            form={messageForm}
            layout="vertical"
            initialValues={{ isInternal: false }}
            onFinish={(values: { message: string; isInternal?: boolean }) =>
              createMessageMutation.mutate({
                id: ticket.id,
                data: { message: values.message, isInternal: !!values.isInternal },
              })
            }
          >
            <Form.Item label="回复内容" name="message" rules={[{ required: true }]}>
              <Input.TextArea rows={5} />
            </Form.Item>
            {canManageTickets && (
              <Form.Item label="内部备注" name="isInternal" valuePropName="checked">
                <Switch checkedChildren="内部" unCheckedChildren="公开" />
              </Form.Item>
            )}
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setMessageOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createMessageMutation.isPending}>
                发送回复
              </Button>
            </Space>
          </Form>
        )}
      </Modal>
    </>
  )
}
