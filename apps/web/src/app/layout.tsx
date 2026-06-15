import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Planejador Previdenciário — MFAA',
  description: 'Sistema de planejamento previdenciário — Machado Filgueiras',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
