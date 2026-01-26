# Edge Fn Docker API

这是一个基于 Next.js 构建的轻量级 API 服务，用于通过 WebSocket 协议连接到 fnOS NAS，进行身份验证并获取特定 Docker 服务的访问地址。

该服务核心功能为纯 API 接口，根路径 `/` 提供了接口文档页面，适合集成到其他系统中使用。

## 功能特性

*   **API 服务**: 仅保留核心连接逻辑，提供标准 REST API。
*   **内置文档**: 根路径提供可视化的接口使用说明。
*   **安全鉴权**: 内置全局密钥校验机制，防止未授权访问。
*   **Docker 服务发现**: 自动发现并匹配 NAS 上指定端口的 Docker 容器。
*   **WebSocket 协议**: 实现了与 fnOS 的复杂握手与加密通信流程。

## 接口文档

### 1. 连接 NAS 服务 (单个)

*   **URL**: `/api/fn/connect`
*   **Method**: `GET`
*   **Description**: 通过 URL 参数传递认证信息，获取指定 Docker 服务的访问地址。

#### 请求参数 (URL Query Params)

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `fnId` | string | 是 | 您的 fnOS ID |
| `username` | string | 是 | NAS 登录用户名 |
| `password` | string | 是 | NAS 登录密码 |
| `port` | number/string | 是 | 目标 Docker 服务的端口号 |
| `key` | string | 是 | API 鉴权密钥 (需与服务器配置一致) |

**示例 URL:**
`/api/fn/connect?fnId=xxx&username=admin&password=123456&port=5244&key=sk_123`

#### 响应示例

**成功 (200 OK)**

```json
{
  "success": true,
  "token": "a1b2c3d4...",
  "url": "https://your-fn-domain.nas-host.com"
}
```

### 2. 获取所有服务列表

*   **URL**: `/api/fn/services`
*   **Method**: `GET`
*   **Description**: 获取 NAS 上运行的所有 Docker 服务列表。

> **注意**: 因为傻逼腾讯云（EdgeOne Pages)的BUG，本接口被迫采用 GET 请求，所有参数通过 URL Query String 传递。

#### 请求参数 (URL Query Params)

| 参数名 | 类型 | 必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `fnId` | string | 是 | 您的 fnOS ID |
| `username` | string | 是 | NAS 登录用户名 |
| `password` | string | 是 | NAS 登录密码 |
| `key` | string | 是 | API 鉴权密钥 (需与服务器配置一致) |
| `isLocal` | boolean | 否 | 是否返回本地局域网地址 (默认 false) |

**示例 URL:**
`/api/fn/services?fnId=xxx&username=admin&password=123456&key=sk_123&isLocal=true`

#### 响应示例

**成功 - 外部模式 (`isLocal: false`)**

返回外部访问域名和 entryToken。

```json
{
  "success": true,
  "services": [
    {
      "title": "alist",
      "url": "https://alist-xxxx.fnos.net",
      "port": 5244,
      "alias": "alist_5244"
    },
    ...
  ],
  "entryToken": "9f531e22575646b5ab5ffa3254e14006"
}
```

**成功 - 本地模式 (`isLocal: true`)**

返回本地 IP 和端口地址。

```json
{
  "success": true,
  "services": [
    {
      "title": "alist",
      "url": "http://192.168.1.10:5244",
      "port": 5244,
      "alias": "alist_5244"
    },
    ...
  ]
}
```

## 通用错误响应

**鉴权失败 (401 Unauthorized)**

```json
{
  "success": false,
  "error": "Unauthorized: Invalid key"
}
```

**服务器内部错误 (500 Internal Server Error)**

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

*   **框架**: Next.js (App Router), React
*   **加密**: crypto-js, jsencrypt
*   **通信**: WebSocket (ws)
