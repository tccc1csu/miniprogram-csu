# UI contract

- 未登录：介绍页 landmark，唯一产品 h1，登录 form 有账号、密码 label，原 auth/login 仍处理身份。
- 登录成功：回调设置现有 user，不修改原 hash；退出回到原未登录分支。
- 页内导航：按钮滚动并将焦点交给目标区标题，不改变路由；顶部登录跳转将焦点放到账号输入。
- 展示选择：原生 button，aria-pressed 表示当前，图片替代文本和说明同步。
- 身份指引：五种角色的原生 button + 当前步骤列表，不模拟身份或授予权限。
- FAQ：原生 details/summary；截图模态预览支持 Escape、关闭、背景关闭、焦点返回及限制焦点循环。
- 本地演示：details/summary 默认折叠；原账号按钮名称与权限不变，非本地不渲染。
- 小屏：无横向页面滚动；保持阅读顺序，所有按钮可操作；prefers-reduced-motion 禁用滚动动画与装饰动画。
