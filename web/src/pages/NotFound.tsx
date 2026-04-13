import { Button, Result, Space } from 'antd'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="这个控制台页面还没有对应路由，或者地址填写错了。"
      extra={(
        <Space wrap>
          <Link to="/">
            <Button type="primary">返回首页</Button>
          </Link>
          <Link to="/tester">
            <Button>打开测试器</Button>
          </Link>
        </Space>
      )}
    />
  )
}
