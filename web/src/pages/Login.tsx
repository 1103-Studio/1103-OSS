import { useState } from 'react'
import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Form, Grid, Input, Space, Typography } from 'antd'
import { useAuth } from '../hooks/useAuth'
import { loginUser } from '../lib/api'
import BrandLogo from '../components/BrandLogo'

const { Title, Paragraph, Text } = Typography
const { useBreakpoint } = Grid

export default function Login() {
  const { login } = useAuth()
  const screens = useBreakpoint()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isSingleColumn = !screens.lg

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    try {
      const response = await loginUser(values.username, values.password)
      const {
        accessKey,
        sessionToken,
        endpoint,
        publicEndpoint,
        username,
        isAdmin,
        displayName,
        roles,
        permissions,
      } = response
      login({ accessKey, sessionToken, endpoint, publicEndpoint, username, isAdmin, displayName, roles, permissions })
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('用户名或密码错误')
      } else if (err.response?.status === 403) {
        setError('账户已被禁用')
      } else {
        setError(err.response?.data?.error || '登录失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at top left, rgba(22,119,255,0.16), transparent 28%), linear-gradient(135deg, #eaf2ff 0%, #f7faff 45%, #eef4ff 100%)',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: isSingleColumn ? 560 : 1040,
          overflow: 'hidden',
          borderRadius: isSingleColumn ? 20 : 24,
          boxShadow: '0 28px 60px rgba(15,23,42,0.14)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isSingleColumn ? '1fr' : 'minmax(0, 1.1fr) minmax(360px, 420px)' }}>
          <div style={{ padding: isSingleColumn ? 24 : 40, background: 'linear-gradient(145deg, #0f172a 0%, #1d4ed8 100%)', color: '#fff' }}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Space>
                <div style={{ width: isSingleColumn ? 42 : 48, height: isSingleColumn ? 42 : 48, borderRadius: 14, background: '#fff', color: '#1677ff', display: 'grid', placeItems: 'center' }}>
                  <SafetyCertificateOutlined style={{ fontSize: 24 }} />
                </div>
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <BrandLogo />
                  </div>
                  <Text style={{ color: 'rgba(255,255,255,0.75)' }}>MaxIO Object Storage Console</Text>
                  <Title level={2} style={{ color: '#fff', margin: 0 }}>统一对象存储控制台</Title>
                </div>
              </Space>

              <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginBottom: 0 }}>
                基于 Ant Design 重构的企业级 OSS 控制系统，统一接管 Bucket、对象、IAM、审计、迁移与工单。
              </Paragraph>

              <Space direction="vertical" size={14}>
                {[
                  '兼容阿里云 OSS、腾讯云 COS、AWS S3 的控制台使用习惯',
                  '浏览器侧不再持有 Secret Key，统一采用服务端会话令牌',
                  '桌面与手机端共享同一套控制台交互模型',
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.88)',
                    }}
                  >
                    {item}
                  </div>
                ))}
              </Space>
            </Space>
          </div>

          <div style={{ padding: isSingleColumn ? 24 : 40, display: 'flex', alignItems: 'center', background: '#fff' }}>
            <div style={{ width: '100%' }}>
              <Title level={3} style={{ marginBottom: 8 }}>登录控制台</Title>
              <Paragraph type="secondary" style={{ marginBottom: 28 }}>
                输入账户和密码，进入对象存储控制台。
              </Paragraph>

              {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

              <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
                <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input size="large" prefix={<UserOutlined />} placeholder="请输入用户名" autoComplete="username" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password size="large" prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0 }}>
                  <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    登录
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
