import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Palpite Todo Dia',
  description: 'Sportsbook Affiliate Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
