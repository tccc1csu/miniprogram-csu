# 单机部署（轻量应用服务器）

> 已废弃的历史方案。用户选择 CloudBase 云托管，现已通过 HTTPS/RPC 接通共享 PG 并部署，无需购买轻量服务器。当前操作以 deployment/README.md 为准。下面步骤不再适用于当前生产启动入口。

## 一、买机器

- 类型：**轻量应用服务器**（腾讯云 → 轻量应用服务器）
- 地域：上海（离用户近，和原环境同地域）
- 配置：**2 核 2G / 40G SSD** 足够（这套应用平时内存占用不到 300M）
- 镜像：**Ubuntu 22.04 LTS**，或直接选「Docker」应用镜像
- 带宽：2~3 Mbps 够用；给社团内部用，流量很小

买完记下：**公网 IP**、**root 密码**。

> 用 IP 直接访问不需要备案；以后要绑自己的域名，域名需要备案。

## 二、装 Docker（如果镜像里没有）

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker compose version
```

## 三、把代码传上去

在**本机**执行（把 IP 换成你的）：

```bash
cd "C:/Users/PC/WeChatProjects/web版工作台"
tar --exclude=node_modules --exclude=.data --exclude=dist --exclude=artifacts -czf workbench.tgz .
scp workbench.tgz root@<公网IP>:/root/
```

服务器上解压：

```bash
mkdir -p /opt/workbench && cd /opt/workbench
tar xzf /root/workbench.tgz
```

## 四、启动

```bash
cd /opt/workbench/deployment
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

首次启动会：建 `youth_workbench` schema → 跑 001~005 迁移 → 建管理员账号。

看到 `[db] 连接成功` 和 `青年传媒中心工作台 http://0.0.0.0:8080` 就好了。

## 五、验证

```bash
curl -s localhost/api/v1/health
# 期望 {"ok":true,...}

curl -s -o /dev/null -w "%{http_code}\n" localhost/
# 期望 200
```

浏览器打开 `http://<公网IP>/`，用 `deployment/.env` 里的管理员账号登录。

## 六、日常运维

```bash
cd /opt/workbench/deployment
docker compose restart app          # 重启应用
docker compose logs --tail=100 app  # 看日志
docker compose down                 # 停止（数据保留在 pgdata 卷里）
```

备份数据库：

```bash
docker compose exec -T db pg_dump -U workbench workbench > /root/backup-$(date +%F).sql
```

## 七、配置说明

| 文件 | 作用 |
| --- | --- |
| `deployment/.env` | 数据库密码、初始管理员账号。**不要提交到仓库** |
| `deployment/docker-compose.yml` | 应用 + PostgreSQL 两个容器 |

- 应用容器对外暴露 **80** 端口（内部 8080）
- 数据库**不对外暴露端口**，只在 Docker 内网可达，安全
- 数据存在 `pgdata` 卷里，`docker compose down` 不会删，只有 `down -v` 才会清空
