# Edge Fn Docker API

这是一个基于 Next.js 构建的轻量级 API 服务，用于通过 WebSocket 协议连接到 fnOS NAS，进行身份验证并获取特定 Docker 服务的访问地址。

该服务已剥离所有前端页面，仅提供纯 API 接口，适合集成到其他系统中使用。

## 功能特性

*   **API 纯净版**: 仅保留核心连接逻辑，移除所有 UI 组件。
*   **安全鉴权**: 内置全局密钥校验机制，防止未授权访问。
*   **Docker 服务发现**: 自动发现并匹配 NAS 上指定端口的 Docker 容器。
*   **WebSocket 协议**: 实现了与 fnOS 的复杂握手与加密通信流程。

## 接口文档

### 连接 NAS 服务

*   **URL**: `/api/fn/connect`
*   **Method**: `POST`
*   **Content-Type**: `application/json`

#### 请求参数 (Body)

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `fnId` | string | 是 | 您的 fnOS ID |
| `username` | string | 是 | NAS 登录用户名 |
| `password` | string | 是 | NAS 登录密码 |
| `port` | number/string | 是 | 目标 Docker 服务的端口号 |
| `key` | string | 是 | API 鉴权密钥 (需与服务器配置一致) |

#### 响应示例

**成功 (200 OK)**

```json
{
  "success": true,
  "token": "a1b2c3d4...",
  "url": "https://your-fn-domain.nas-host.com"
}
```

**鉴权失败 (401 Unauthorized)**

```json
{
  "success": false,
  "error": "Unauthorized: Invalid key"
}
```

**连接失败 (500 Internal Server Error)**

```json
{
  "success": false,
  "error": "NAS Connection Failed: ..."
}
```

## 部署与配置

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量

您可以通过设置环境变量来配置全局鉴权密钥。如果未设置，默认密钥为 `sk_random_key_123456`。

在项目根目录创建 `.env.local` 文件（可选）：

```env
GLOBAL_AUTH_KEY=your_secure_secret_key
```

### 3. 运行服务

**开发模式**
```bash
npm run dev
```

**生产部署**
```bash
npm run build
npm run start
```

## 技术栈

*   **框架**: Next.js (App Router)
*   **加密**: crypto-js, jsencrypt
*   **通信**: WebSocket (ws)
