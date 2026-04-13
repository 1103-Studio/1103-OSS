import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AuditOutlined,
  DeploymentUnitOutlined,
  FolderOpenOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd'
import { getMySubscriptionProfile, listBuckets } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import {
  IAM_PAGE_PERMISSIONS,
  MIGRATION_PAGE_PERMISSIONS,
  TICKET_PAGE_PERMISSIONS,
} from '../lib/permissions'

const { Paragraph, Text, Title } = Typography

export default function Dashboard() {
  const { credentials, hasPermission } = useAuth()
  const { data: bucketsData } = useQuery({
    queryKey: ['buckets'],
    queryFn: listBuckets,
  })
  const { data: subscriptionProfile } = useQuery({
    queryKey: ['my-subscription-profile'],
    queryFn: getMySubscriptionProfile,
  })

  const canUseMigration = hasPermission(...MIGRATION_PAGE_PERMISSIONS)
  const canUseTickets = hasPermission(...TICKET_PAGE_PERMISSIONS)
  const canUseIAM = hasPermission(...IAM_PAGE_PERMISSIONS)
  const canUseAudit = !!credentials?.isAdmin
  const buckets = bucketsData?.ListAllMyBucketsResult?.Buckets?.Bucket || []

  const entries = [
    {
      key: 'buckets',
      title: 'Bucket 管理',
      desc: '创建 Bucket、查看对象和快速切换访问策略。',
      to: '/buckets',
      enabled: true,
      icon: <FolderOpenOutlined />,
      extra: `${buckets.length} 个 Bucket`,
    },
    {
      key: 'migration',
      title: '迁移中心',
      desc: '填写 OSS 地址和凭证，发起数据迁移任务。',
      to: '/migration',
      enabled: canUseMigration,
      icon: <DeploymentUnitOutlined />,
      extra: canUseMigration ? '可用' : '无权限',
    },
    {
      key: 'iam',
      title: '访问控制',
      desc: '管理用户、角色、订阅档位和资源包兑换码。',
      to: '/iam',
      enabled: canUseIAM,
      icon: <SafetyCertificateOutlined />,
      extra: canUseIAM ? '可用' : '无权限',
    },
    {
      key: 'tickets',
      title: '工单中心',
      desc: '处理权限申请、故障协作和使用支持。',
      to: '/tickets',
      enabled: canUseTickets,
      icon: <TeamOutlined />,
      extra: canUseTickets ? '可用' : '无权限',
    },
    {
      key: 'tester',
      title: '控制台测试器',
      desc: '快速验证 Bucket、资源包资料和 OSS 地址格式。',
      to: '/tester',
      enabled: true,
      icon: <ToolOutlined />,
      extra: '可直接执行',
    },
    {
      key: 'audit',
      title: '审计日志',
      desc: '查看对象操作和配置变更记录。',
      to: '/audit-logs',
      enabled: canUseAudit,
      icon: <AuditOutlined />,
      extra: canUseAudit ? '管理员' : '仅管理员',
    },
    {
      key: 'settings',
      title: '设置与资源包',
      desc: '查看连接信息、兑换资源包、修改密码。',
      to: '/settings',
      enabled: true,
      icon: <SettingOutlined />,
      extra: `${subscriptionProfile?.activePlans?.length || 0} 个资源包`,
    },
  ]

  return (
    <div className="dashboard-home">
      <Card variant="borderless" className="dashboard-overview-card">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Tag color="blue" style={{ width: 'fit-content', borderRadius: 999 }}>控制台首页</Tag>
          <Title level={3} style={{ margin: 0 }}>MaxIO 控制台总览</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            首页只保留真实可用入口。分类细项放到各自子页面，不再展示未实现的云能力。
          </Paragraph>
        </Space>
      </Card>

      <div className="console-metrics">
        <Card variant="borderless"><Statistic title="Bucket 数量" value={buckets.length} /></Card>
        <Card variant="borderless"><Statistic title="可用资源包" value={subscriptionProfile?.activePlans?.length || 0} /></Card>
        <Card variant="borderless"><Statistic title="总存储额度" value={subscriptionProfile?.totalStorageBytes || 0} /></Card>
        <Card variant="borderless"><Statistic title="总流量额度" value={subscriptionProfile?.totalTrafficBytes || 0} /></Card>
      </div>

      <Card variant="borderless" title="全部分类">
        <Row gutter={[16, 16]}>
          {entries.map((item) => (
            <Col xs={24} md={12} xl={8} key={item.key}>
              <Card variant="outlined" className="dashboard-entry-card">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space size={10}>
                    <div className="dashboard-entry-icon">{item.icon}</div>
                    <div>
                      <Text strong>{item.title}</Text>
                      <div><Text type="secondary">{item.extra}</Text></div>
                    </div>
                  </Space>
                  <Paragraph type="secondary" style={{ minHeight: 44, margin: 0 }}>{item.desc}</Paragraph>
                  {item.enabled ? (
                    <Link to={item.to}>
                      <Button type="primary" block>进入</Button>
                    </Link>
                  ) : (
                    <Button block disabled>当前账号不可访问</Button>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card variant="borderless" title="最近 Bucket">
        {buckets.length ? (
          <Row gutter={[12, 12]}>
            {buckets.slice(0, 6).map((bucket) => (
              <Col xs={24} sm={12} xl={8} key={bucket.Name}>
                <Link to={`/buckets/${bucket.Name}`}>
                  <Card size="small" className="dashboard-bucket-card">
                    <Space direction="vertical" size={4}>
                      <Text strong>{bucket.Name}</Text>
                      <Text type="secondary">{new Date(bucket.CreationDate).toLocaleString('zh-CN')}</Text>
                    </Space>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无 Bucket" />
        )}
      </Card>
    </div>
  )
}
