import { AppstoreOutlined, CloudServerOutlined, RocketOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Card, Col, List, Row, Tag, Typography } from 'antd'

const { Title, Paragraph, Text } = Typography

export default function About() {
  return (
    <>
      <section className="console-hero">
        <Tag color="blue" style={{ borderRadius: 999 }}>产品简介</Tag>
        <Title level={2} style={{ marginTop: 12, marginBottom: 0 }}>MaxIO 是一套面向企业治理场景的对象存储控制系统</Title>
        <Paragraph style={{ maxWidth: 760, marginTop: 12, marginBottom: 0 }}>
          当前项目已从基础 S3 兼容服务扩展为带控制台、IAM、审计、工单和迁移中心的一体化 OSS 控制面，目标体验对齐主流云厂商对象存储控制台。
        </Paragraph>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card title="系统定位" variant="borderless">
            <List
              dataSource={[
                '支持 Bucket 生命周期内的创建、对象浏览、策略切换和默认分享时效管理',
                '支持用户、角色、Access Key、Bucket 授权和审计追踪等治理功能',
                '支持从公有云或私有 S3 兼容源站迁移资源进入统一控制台',
              ]}
              renderItem={(item: string) => <List.Item>{item}</List.Item>}
            />
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="能力矩阵" variant="borderless">
            <Row gutter={[16, 16]}>
              {[
                { label: 'Bucket 管理', icon: <CloudServerOutlined /> },
                { label: '对象浏览', icon: <AppstoreOutlined /> },
                { label: 'IAM 治理', icon: <SafetyCertificateOutlined /> },
                { label: '迁移中心', icon: <RocketOutlined /> },
              ].map((item) => (
                <Col xs={24} sm={12} key={item.label}>
                  <Card size="small">
                    <Title level={5}>{item.icon} {item.label}</Title>
                    <Text type="secondary">已纳入统一控制台主路径。</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </>
  )
}
