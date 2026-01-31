import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bare Naked Pet Co. - Wholesale Portal',
  description: 'Premium pet food toppers and treats for wholesale partners',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body">
        {children}
      </body>
    </html>
  );
}
