import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CMDB Quick Form',
  description: 'Submit text content to Google Drive',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
