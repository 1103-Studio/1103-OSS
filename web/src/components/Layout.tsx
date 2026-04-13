import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AuditOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Drawer,
  Grid,
  Layout as AntLayout,
  Menu,
  Space,
  Typography,
} from 'antd'
import type { MenuProps } from 'antd'
import { useAuth } from '../hooks/useAuth'
import BrandLogo from './BrandLogo'

const { Header, Sider, Content } = AntLayout
const { Text } = Typography
const { useBreakpoint } = Grid

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { credentials, logout, hasPermission } = useAuth()
  const location = useLocation()
  const screens = useBreakpoint()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const canUseTickets = hasPermission('ticket:create', 'ticket:read', 'ticket:manage')
  const canUseMigration = hasPermission('bucket:manage')
  const canUseIAM = hasPermission('user:manage', 'credential:manage', 'role:manage', 'bucket:manage', 'bucket:assign', 'bucket:quota', 'bucket:traffic', 'bucket:policy')

  const mainMenuItems = useMemo<MenuProps['items']>(() => {
    const items: MenuProps['items'] = [
      {
        key: '/',
        icon: <DashboardOutlined />,
        label: <Link to="/">概览</Link>,
      },
      {
        key: '/buckets',
        icon: <FolderOpenOutlined />,
        label: <Link to="/buckets">Bucket 列表</Link>,
      },
      {
        key: '/tester',
        icon: <ToolOutlined />,
        label: <Link to="/tester">测试器</Link>,
      },
    ]

    if (canUseMigration) {
      items.push({
        key: '/migration',
        icon: <DeploymentUnitOutlined />,
        label: <Link to="/migration">迁移中心</Link>,
      })
    }

    if (canUseTickets) {
      items.push({
        key: '/tickets',
        icon: <TeamOutlined />,
        label: <Link to="/tickets">任务工单</Link>,
      })
    }

    if (canUseIAM) {
      items.push({
        key: '/iam',
        icon: <SafetyCertificateOutlined />,
        label: <Link to="/iam">访问控制</Link>,
      })
    }

    if (credentials?.isAdmin) {
      items.push({
        key: '/audit-logs',
        icon: <AuditOutlined />,
        label: <Link to="/audit-logs">审计日志</Link>,
      })
    }

    items.push(
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: <Link to="/settings">设置</Link>,
      },
      {
        key: '/about',
        icon: <InfoCircleOutlined />,
        label: <Link to="/about">关于</Link>,
      },
    )

    return items
  }, [canUseIAM, canUseMigration, canUseTickets, credentials?.isAdmin])

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/buckets/')) return '/buckets'
    return location.pathname
  }, [location.pathname])

  const sidebar = (
    <div className="console-sidebar-shell">
      <div className="console-sidebar-block">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={mainMenuItems}
          onClick={() => setDrawerOpen(false)}
          style={{ borderInlineEnd: 'none' }}
        />
      </div>
    </div>
  )

  return (
    <AntLayout className="console-shell console-shell-aliyun">
      {!screens.lg ? (
        <>
          <Header className="console-topbar">
            <Space>
              <Button type="text" icon={<MenuUnfoldOutlined />} onClick={() => setDrawerOpen(true)} />
              <Link to="/" className="console-topbar-brand" aria-label="MaxIO 控制台">
                <BrandLogo compact />
              </Link>
            </Space>
            <Space>
              <Avatar icon={<UserOutlined />} />
              <Button type="text" icon={<LogoutOutlined />} onClick={() => logout()} />
            </Space>
          </Header>
          <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={280} styles={{ body: { padding: 0 } }}>
            {sidebar}
          </Drawer>
        </>
      ) : (
        <>
          <Header className="console-topbar">
            <Space size={16}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((value) => !value)}
              />
              <Link to="/" className="console-topbar-brand" aria-label="MaxIO 控制台">
                <BrandLogo compact />
              </Link>
            </Space>
            <Space size={16}>
              <Text type="secondary">{credentials?.displayName || credentials?.username || credentials?.accessKey}</Text>
              <Avatar icon={<UserOutlined />} />
              <Button type="text" icon={<LogoutOutlined />} onClick={() => logout()} />
            </Space>
          </Header>
          <AntLayout className="console-main-shell">
            <Sider collapsed={collapsed} width={264} theme="light" trigger={null} className="console-sidebar">
              {sidebar}
            </Sider>
            <Content className="console-content console-content-aliyun">
              <div className="console-page">{children}</div>
            </Content>
          </AntLayout>
        </>
      )}

      {!screens.lg && (
        <Content className="console-content console-content-aliyun">
          <div className="console-page">{children}</div>
        </Content>
      )}
    </AntLayout>
  )
}
