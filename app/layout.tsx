export const metadata = {
  title: 'Bare Naked Pet Co. - Wholesale Portal',
  description: 'Wholesale ordering portal for Bare Naked Pet Co. retailers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
