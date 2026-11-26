# 展示模型

无持久化实体变更。Showcase 为静态对象数组：键、标题、说明、要点、图片与替代文本。RoleGuide 为静态对象数组：键、角色、说明、三步操作。activeShowcase 和 activeRole 仅为页面内状态。

截图只能使用 scripts/capture-product.mjs 新建的内存数据库，不读取 .data/postgres、云库或旧小程序。现有登录会话、任务和权限模型不变。
