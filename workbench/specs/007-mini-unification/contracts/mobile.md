# Mobile contracts

固定上游：https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com/api/v1

- callFunction workbenchGateway：输入 {path,method,data,token}，响应 {statusCode,data}；网关只透传 Bearer + X-Client:miniprogram，不信任调用者角色。
- 上传：{path:'/tasks/:id/files',method:'POST',token,file:{name,base64}}，返回既有文件对象；最大 3 MiB，文件权属由既有 API 判定。
- 下载：{path:'/files/:id',method:'GET',token,offset}，返回 {statusCode,data:{base64,total,nextOffset}}；每次重新鉴权，最大 192 KiB 响应内容。
- JSON API：登录/退出、auth/me、workflow/options、tasks/list/detail、source、assign、versions、reviews、publish、register、teachers、report-note、actions、inbox、worklogs 复用既有契约。
- mutation 不自动重试；401 清空会话并离开已登录页面；错误不回显 token。
- 所有路径严格匹配，禁止 /internal/jobs、数据库/RPC/云管理接口；上游重定向禁用。

UI：原 index/collaboration/profile 对应首页/业务卡片/个人工具；records 统一任务列表；taskDetail/create 为共享详情及表单；taskNotifications 为站内消息；statistics 为个人工时；allowanceRules 为当前规则。旧 register/repair/reset 操作不注册，不保留独立 workbench 页。
