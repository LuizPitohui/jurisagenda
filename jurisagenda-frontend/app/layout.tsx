import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const serif = Playfair_Display({
  subsets:  ['latin'],
  variable: '--font-serif',
  display:  'swap',
});

const sans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

const mono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
  weight:   ['400', '500'],
});

export const metadata: Metadata = {
  title:       { default: 'JurisAgenda', template: '%s · JurisAgenda' },
  description: 'Sistema de Agenda Jurídica – Gestão inteligente de compromissos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo-norte.png" type="image/png" />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = JSON.parse(localStorage.getItem('juris-theme') || '{}');
            if (t.state?.dark) document.documentElement.classList.add('dark');
          } catch {}
        `}} />
      </head>
      <body
        className={`
          ${serif.variable}
          ${sans.variable}
          ${mono.variable}
          font-sans antialiased bg-cream-100
        `}
      >
        <Providers>
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{ duration: 4000 }}
          />
        </Providers>
      </body>
    </html>
  );
}