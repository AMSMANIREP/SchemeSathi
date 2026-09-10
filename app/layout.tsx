import type { Metadata } from 'next';
import { Google_Sans, Google_Sans_Code } from 'next/font/google';
import './globals.css';
import { AppProvider } from './providers';
import { Shell } from './shell';

const googleSans = Google_Sans({
  variable: '--font-google-sans',
  subsets: ['latin'],
  display: 'swap',
});

const googleSansCode = Google_Sans_Code({
  variable: '--font-google-sans-code',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Scheme Sathi — Your benefits companion',
  description:
    'Describe your situation in your own words and find the Central Government schemes you are likely eligible for, with the exact next steps to prepare.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables must land on <html> so :root can resolve them; the
    // token stack in globals.css is declared there.
    <html
      lang="en"
      className={`${googleSans.variable} ${googleSansCode.variable}`}
    >
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
