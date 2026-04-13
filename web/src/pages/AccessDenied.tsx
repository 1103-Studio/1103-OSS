import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'

export default function AccessDenied() {
  return (
    <Result
      status="403"
      title="无权访问"
      subTitle="当前账号没有这个页面的访问权限。"
      extra={(
        <Link to="/">
          <Button type="primary">返回首页</Button>
        </Link>
      )}
    />
  )
}
