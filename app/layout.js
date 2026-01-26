export const metadata = {
  title: 'Edge Fn Docker API',
  description: '这是一个基于 Next.js 构建的轻量级 API 服务，用于通过 WebSocket 协议连接到 fnOS NAS，进行身份验证并获取特定 Docker 服务的访问地址。',
  icons: {
    icon: 'https://q2.qlogo.cn/headimg_dl?dst_uin=9892214&spec=0',
    apple: 'https://q2.qlogo.cn/headimg_dl?dst_uin=9892214&spec=0',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
