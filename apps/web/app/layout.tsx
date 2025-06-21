import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gemini Salon AI - Smart Automation for European Beauty Salons',
  description: 'Transform your salon with AI-powered WhatsApp and Instagram automation. Save €30-60/month with intelligent service window optimization.',
  keywords: ['salon automation', 'beauty salon software', 'WhatsApp business', 'Instagram automation', 'EU GDPR compliant'],
  authors: [{ name: 'Gemini Salon AI' }],
  openGraph: {
    title: 'Gemini Salon AI',
    description: 'Smart automation for European beauty salons',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-background text-foreground antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}