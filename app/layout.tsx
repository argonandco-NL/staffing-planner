import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'Staffing Planner',
  description: 'Internal staffing planning for a small consultancy office',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning swallows the benign mismatch some browser
    // extensions cause by injecting attributes on <html> before React hydrates.
    <html lang="en" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="h-full font-sans antialiased">{children}</body>
    </html>
  );
}
