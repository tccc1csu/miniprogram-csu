# 设计研究

- Decision: 采用留白、大标题、产品截图分段展示。Rationale: 已实际打开参考 https://uuyc.163.com/ 并查看首屏及内容，借鉴阅读节奏，不复用商标、素材和夸张口碑。Alternative: 插画和视频会淡化真实操作指引，暂不采用。
- Decision: 登录表单保留在首屏左上，桌面 330–350px 列宽，小屏单列。Rationale: 满足用户四分之一布局意图，首次访问可直接登录。Alternative: 仅导航登录按钮不满足首屏可操作要求。
- Decision: 图片从临时内存库截图，用 seedExamples 的虚构样例。Rationale: 真实实现外观且不泄露任务。Alternative: 直接截本机数据不适宜公开。
- Decision: 页面内导航 scrollIntoView，不改变 hash；功能与身份用按钮 aria-pressed 切换。Rationale: 保留任务深链接，键盘原生支持。Alternative: 新增路由复杂度无必要。
- Decision: 原演示账号折叠在本地专有入口，生产按既有条件隐藏。Rationale: 首屏简洁但回归和试用仍可用。
