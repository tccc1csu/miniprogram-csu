# 工作区界面与接口合同

## 导航
个人：home 工作概览、mine 我的待办、created 我发起的、inbox 消息中心。
协作：tasks 任务中心；部长/管理员增加 team 部门任务；部长/管理员/老师增加 review 审核工作台。
成果：archives；内部角色 reports（干事名为我的工时）。
管理：部长/管理员 settings 流程与轮值、notifications 发送记录。
nav[aria-label=主导航] 保持单一语义容器，其内显示分组标题。旧路由不失效；不可访问路由显式无权。

## 数据
GET /api/v1/tasks 既有响应添加 viewer（见 data-model.md TaskViewer）。可见范围和外部脱敏保持不变；动作由服务端计算仅用于显示。
GET /api/v1/worklogs 仅内部首页按现有权限读取。办公部长/管理员可读 seals。
不增加客户端写业务表，不变更操作接口。

## 视图
#tasks?kind=photo&view=board 选择业务与布局；kind 非法回全部。
#review?tab=reviewed 展示存在本人真实审核记录的任务。
#reports?status=pending&department=operations 进入相应核定列表，服务端继续限制数据范围。
卡片/行均链接 #task/id，按钮使用已有详情操作，不能由列表绕过版本校验。

## 首页
角色重点、真实指标、按逾期/截止排列的本人待办、业务快捷入口和相关进度。
加载显示占位符，失败反馈并可重试；空列表明确说明。
五类身份没有切换身份控件。移动菜单有 aria-expanded/Escape/焦点恢复。
