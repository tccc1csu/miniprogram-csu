# API

POST /tasks/:id/source 提交来源版本，POST /tasks/:id/reviews 使用 editorial、internal、teacher1、teacher2 环节。POST /tasks/:id/annotations 按版本写入范围及意见，详情返回对应版本中可见批注。派发请求支持 remember 和教师、内审组合。工作流设置接口管理默认承接、两审老师与机器人路由。通知中继接收 taskPath、stage 和配置的群、@ 标识。
