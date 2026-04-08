import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '2 Manz',
  description: 'Double-date matching app',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0A1628] text-white min-h-screen`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#0F2040',
              color: '#fff',
              border: '1px solid #1E90FF33',
            },
          }}
        />
      </body>
    </html>
  )
}
