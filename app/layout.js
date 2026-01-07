export const metadata = {
  title: 'API Service',
  description: 'Backend API Service',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
