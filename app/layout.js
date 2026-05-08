import './globals.css'
import { AppProvider } from '@/lib/AppContext'
import { Toaster } from '@/components/ui/sonner'

export const metadata = {
  title: 'Aukstaitija – Modern Lithuanian Fine Dining | Kaunas',
  description: 'Aukstaitija is a modern Lithuanian fine-dining restaurant in Kaunas. Centuries of tradition reimagined. Reserve, order delivery, or visit us.',
  keywords: 'restoranas Kaunas, lithuanian restaurant, fine dining kaunas, cepelinai, aukstaitija',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html:`try{var t=localStorage.getItem('aukstaitija_theme')||'dark';if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}`}} />
      </head>
      <body>
        <AppProvider>
          {children}
          <Toaster richColors position="top-center" />
        </AppProvider>
      </body>
    </html>
  )
}
