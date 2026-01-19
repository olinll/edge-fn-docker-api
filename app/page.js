import React from 'react';

export default function Home() {
  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    lineHeight: '1.6',
    color: '#333',
  };

  const headerStyle = {
    marginBottom: '40px',
    borderBottom: '1px solid #eaeaea',
    paddingBottom: '20px',
  };

  const h1Style = {
    fontSize: '2.5rem',
    fontWeight: '700',
    marginBottom: '10px',
    color: '#111',
  };

  const sectionStyle = {
    marginBottom: '40px',
  };

  const h2Style = {
    fontSize: '1.8rem',
    fontWeight: '600',
    marginBottom: '20px',
    marginTop: '30px',
    color: '#222',
  };

  const h3Style = {
    fontSize: '1.4rem',
    fontWeight: '600',
    marginBottom: '15px',
    marginTop: '25px',
    color: '#444',
  };

  const codeBlockStyle = {
    background: '#f6f8fa',
    padding: '15px',
    borderRadius: '6px',
    overflowX: 'auto',
    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: '0.9rem',
    marginBottom: '15px',
    border: '1px solid #e1e4e8',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '20px',
    fontSize: '0.95rem',
  };

  const thStyle = {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #eaeaea',
    background: '#f9f9f9',
    fontWeight: '600',
  };

  const tdStyle = {
    padding: '10px 12px',
    borderBottom: '1px solid #eaeaea',
  };

  const badgeStyle = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: '600',
    marginLeft: '10px',
  };

  const methodPostStyle = {
    ...badgeStyle,
    background: '#d1fae5',
    color: '#065f46',
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={h1Style}>Edge Fn Docker API</h1>
        <p style={{ fontSize: '1.1rem', color: '#666' }}>
          一个基于 Next.js 构建的轻量级 API 服务，用于通过 WebSocket 协议连接到 fnOS NAS，进行身份验证并获取特定 Docker 服务的访问地址。
        </p>
      </header>

      <section style={sectionStyle}>
        <h2 style={h2Style}>功能特性</h2>
        <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
          <li><strong>API 纯净版</strong>: 仅保留核心连接逻辑，移除所有 UI 组件。</li>
          <li><strong>安全鉴权</strong>: 内置全局密钥校验机制，防止未授权访问。</li>
          <li><strong>Docker 服务发现</strong>: 自动发现并匹配 NAS 上指定端口的 Docker 容器。</li>
          <li><strong>WebSocket 协议</strong>: 实现了与 fnOS 的复杂握手与加密通信流程。</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>接口文档</h2>

        <div style={{ marginBottom: '40px' }}>
          <h3 style={h3Style}>
            1. 连接 NAS 服务 (单个)
            <span style={methodPostStyle}>POST</span>
          </h3>
          <p><strong>URL</strong>: <code>/api/fn/connect</code></p>
          <p><strong>描述</strong>: 连接到 fnOS NAS 并获取指定 Docker 服务的访问 Token 和 URL。</p>

          <h4>请求参数 (Body)</h4>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>参数名</th>
                <th style={thStyle}>类型</th>
                <th style={thStyle}>必填</th>
                <th style={thStyle}>描述</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><code>fnId</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>您的 fnOS ID</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>username</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>NAS 登录用户名</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>password</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>NAS 登录密码</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>port</code></td>
                <td style={tdStyle}>number/string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>目标 Docker 服务的端口号</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>key</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>API 鉴权密钥</td>
              </tr>
            </tbody>
          </table>

          <h4>响应示例 (成功)</h4>
          <pre style={codeBlockStyle}>
{`{
  "success": true,
  "token": "a1b2c3d4...",
  "url": "https://your-fn-domain.nas-host.com"
}`}
          </pre>
          
          <h4>响应示例 (失败)</h4>
          <h5 style={{fontSize: '1rem', marginTop: '15px', marginBottom: '10px'}}>未找到服务 (404 Not Found)</h5>
          <pre style={codeBlockStyle}>
{`{
  "success": false,
  "error": "App not found on port 5244"
}`}
          </pre>
        </div>

        <div>
          <h3 style={h3Style}>
            2. 获取所有服务列表
            <span style={methodPostStyle}>POST</span>
          </h3>
          <p><strong>URL</strong>: <code>/api/fn/services</code></p>
          <p><strong>描述</strong>: 获取 NAS 上运行的所有 Docker 服务列表。</p>

          <h4>请求参数 (Body)</h4>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>参数名</th>
                <th style={thStyle}>类型</th>
                <th style={thStyle}>必填</th>
                <th style={thStyle}>描述</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><code>fnId</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>您的 fnOS ID</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>username</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>NAS 登录用户名</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>password</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>NAS 登录密码</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>key</code></td>
                <td style={tdStyle}>string</td>
                <td style={tdStyle}>是</td>
                <td style={tdStyle}>API 鉴权密钥</td>
              </tr>
              <tr>
                <td style={tdStyle}><code>isLocal</code></td>
                <td style={tdStyle}>boolean</td>
                <td style={tdStyle}>否</td>
                <td style={tdStyle}>是否返回本地局域网地址 (默认 false)</td>
              </tr>
            </tbody>
          </table>

          <h4>响应示例 (成功)</h4>
          
          <h5 style={{fontSize: '1rem', marginTop: '15px', marginBottom: '10px'}}>1. 外部模式 (默认, isLocal: false)</h5>
          <pre style={codeBlockStyle}>
{`{
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
}`}
          </pre>

          <h5 style={{fontSize: '1rem', marginTop: '15px', marginBottom: '10px'}}>2. 本地模式 (isLocal: true)</h5>
          <pre style={codeBlockStyle}>
{`{
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
}`}
          </pre>
        </div>

        <div>
          <h3 style={h3Style}>3. 通用错误响应</h3>
          <p>当请求失败时，API 会返回 HTTP 4xx 或 5xx 状态码，JSON 结构如下：</p>
          
          <h5 style={{fontSize: '1rem', marginTop: '15px', marginBottom: '10px'}}>鉴权失败 (401 Unauthorized)</h5>
          <pre style={codeBlockStyle}>
{`{
  "success": false,
  "error": "Unauthorized: Invalid key"
}`}
          </pre>

          <h5 style={{fontSize: '1rem', marginTop: '15px', marginBottom: '10px'}}>服务器错误 (500 Internal Server Error)</h5>
          <pre style={codeBlockStyle}>
{`{
  "success": false,
  "error": "NAS Connection Failed: ..."
}`}
          </pre>
        </div>
      </section>

      <footer style={{ marginTop: '60px', borderTop: '1px solid #eaeaea', paddingTop: '20px', color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
        <p>&copy; {new Date().getFullYear()} Edge Fn Docker API. All rights reserved.</p>
        <p style={{ marginTop: '10px' }}>
          GitHub: <a href="https://github.com/olinll/edge-fn-docker-api" target="_blank" rel="noopener noreferrer" style={{ color: '#0366d6', textDecoration: 'none' }}>olinll/edge-fn-docker-api</a>
        </p>
      </footer>
    </div>
  );
}
