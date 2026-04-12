import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { createTicket, createTicketMessage, getTicket, listAdminBuckets, listTickets, updateTicket } from '../lib/api'

export default function Tickets() {
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const scope = isAdmin ? 'admin' : 'user'
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [filter, setFilter] = useState({ status: '', priority: '', category: '' })
  const [ticketForm, setTicketForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    bucketId: '',
  })
  const [reply, setReply] = useState('')
  const [internalNote, setInternalNote] = useState(false)
  const [ticketUpdate, setTicketUpdate] = useState({
    status: '',
    priority: '',
    category: '',
    assigneeId: '',
    description: '',
  })

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', scope, filter],
    queryFn: () => listTickets(scope, filter),
  })

  const { data: buckets = [] } = useQuery({
    queryKey: ['admin-buckets-minimal', isAdmin],
    queryFn: listAdminBuckets,
    enabled: isAdmin,
  })

  const { data: ticketDetail } = useQuery({
    queryKey: ['ticket-detail', scope, selectedTicketId],
    queryFn: () => getTicket(selectedTicketId as number, scope),
    enabled: !!selectedTicketId,
  })

  const selectedTicket = useMemo(() => ticketDetail?.ticket, [ticketDetail])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['ticket-detail'] })
  }

  const createTicketMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      invalidate()
      setTicketForm({
        title: '',
        description: '',
        category: 'general',
        priority: 'medium',
        bucketId: '',
      })
      toast.success('工单已创建')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '创建工单失败'),
  })

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateTicket(id, data, scope),
    onSuccess: () => {
      invalidate()
      toast.success('工单已更新')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '更新工单失败'),
  })

  const createMessageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => createTicketMessage(id, data, scope),
    onSuccess: () => {
      invalidate()
      setReply('')
      setInternalNote(false)
      toast.success('回复已发送')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || '回复失败'),
  })

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px,1fr] gap-6">
      <div className="space-y-6">
        <section className="card p-6 space-y-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">工单系统</h1>
          <div className="grid grid-cols-1 gap-3">
            <input className="input" placeholder="标题" value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} />
            <textarea className="input min-h-[120px]" placeholder="问题描述" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}>
                <option value="general">general</option>
                <option value="billing">billing</option>
                <option value="bucket">bucket</option>
                <option value="access">access</option>
                <option value="security">security</option>
              </select>
              <select className="input" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="urgent">urgent</option>
              </select>
            </div>
            {isAdmin && (
              <select className="input" value={ticketForm.bucketId} onChange={(e) => setTicketForm({ ...ticketForm, bucketId: e.target.value })}>
                <option value="">关联存储桶（可空）</option>
                {buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.name}</option>)}
              </select>
            )}
            <button
              className="btn btn-primary"
              onClick={() => createTicketMutation.mutate({
                title: ticketForm.title,
                description: ticketForm.description,
                category: ticketForm.category,
                priority: ticketForm.priority,
                bucketId: ticketForm.bucketId ? Number(ticketForm.bucketId) : null,
              })}
              disabled={!ticketForm.title.trim() || !ticketForm.description.trim()}
            >
              提交工单
            </button>
          </div>
        </section>

        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">筛选</h2>
          <div className="grid grid-cols-1 gap-3">
            <select className="input" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">全部状态</option>
              <option value="open">open</option>
              <option value="pending">pending</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
            <select className="input" value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
              <option value="">全部优先级</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="urgent">urgent</option>
            </select>
            <select className="input" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
              <option value="">全部分类</option>
              <option value="general">general</option>
              <option value="billing">billing</option>
              <option value="bucket">bucket</option>
              <option value="access">access</option>
              <option value="security">security</option>
            </select>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">工单列表</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <div className="px-6 py-10 text-sm text-gray-500">加载中...</div>
            ) : tickets.length === 0 ? (
              <div className="px-6 py-10 text-sm text-gray-500">暂无工单</div>
            ) : tickets.map((ticket) => (
              <button
                key={ticket.id}
                className={`w-full text-left px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedTicketId === ticket.id ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
                onClick={() => {
                  setSelectedTicketId(ticket.id)
                  setTicketUpdate({
                    status: ticket.status,
                    priority: ticket.priority,
                    category: ticket.category,
                    assigneeId: ticket.assigneeId ? String(ticket.assigneeId) : '',
                    description: ticket.description,
                  })
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{ticket.title}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      #{ticket.id} · {ticket.category} · {ticket.priority} · {ticket.status}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(ticket.updatedAt).toLocaleString('zh-CN')}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="card p-6">
        {!selectedTicket || !ticketDetail ? (
          <div className="text-sm text-gray-500">选择左侧工单查看详情。</div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedTicket.title}</h2>
                <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs">{selectedTicket.status}</span>
                <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs">{selectedTicket.priority}</span>
                {selectedTicket.bucketName && <span className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs">{selectedTicket.bucketName}</span>}
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                发起人 {selectedTicket.requester || selectedTicket.requesterId} · 指派 {selectedTicket.assignee || selectedTicket.assigneeId || '未指派'}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">更新工单</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select className="input" value={ticketUpdate.status} onChange={(e) => setTicketUpdate({ ...ticketUpdate, status: e.target.value })}>
                  <option value="open">open</option>
                  <option value="pending">pending</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </select>
                <select className="input" value={ticketUpdate.priority} onChange={(e) => setTicketUpdate({ ...ticketUpdate, priority: e.target.value })}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
                <input className="input" placeholder="分类" value={ticketUpdate.category} onChange={(e) => setTicketUpdate({ ...ticketUpdate, category: e.target.value })} />
                {isAdmin && (
                  <input className="input" placeholder="指派用户 ID" value={ticketUpdate.assigneeId} onChange={(e) => setTicketUpdate({ ...ticketUpdate, assigneeId: e.target.value })} />
                )}
              </div>
              <textarea className="input min-h-[100px]" placeholder="更新描述" value={ticketUpdate.description} onChange={(e) => setTicketUpdate({ ...ticketUpdate, description: e.target.value })} />
              <button
                className="btn btn-primary"
                onClick={() => updateTicketMutation.mutate({
                  id: selectedTicket.id,
                  data: {
                    status: ticketUpdate.status,
                    priority: ticketUpdate.priority,
                    category: ticketUpdate.category,
                    assigneeId: ticketUpdate.assigneeId ? Number(ticketUpdate.assigneeId) : null,
                    description: ticketUpdate.description,
                  },
                })}
              >
                保存更新
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">消息记录</h3>
              <div className="space-y-3">
                {ticketDetail.messages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {message.author || message.authorId}
                        {message.isInternal && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">内部</span>}
                      </div>
                      <div className="text-xs text-gray-400">{new Date(message.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{message.message}</div>
                  </div>
                ))}
              </div>
              <textarea className="input min-h-[120px]" placeholder="回复内容" value={reply} onChange={(e) => setReply(e.target.value)} />
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                  内部备注
                </label>
              )}
              <button
                className="btn btn-primary"
                onClick={() => createMessageMutation.mutate({ id: selectedTicket.id, data: { message: reply, isInternal: internalNote } })}
                disabled={!reply.trim()}
              >
                发送回复
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
