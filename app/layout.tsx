import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Budget My House', description: 'Manage house projects, budgets, payments and shared ownership.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { return <html lang="en"><body>{children}</body></html>; }
