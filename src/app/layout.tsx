import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CMDB Quick Form',
  description: 'Upload ticker notes to Google Drive and generate Gemini summaries',
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
