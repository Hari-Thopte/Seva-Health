import './globals.css'
import PwaRegister from '@/components/PwaRegister'
import DoubtBot from '@/components/DoubtBot'

export const viewport = {
  themeColor: '#1e40af',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
}

export const metadata = {
  title: 'सेवा आरोग्य — राष्ट्रीय आरोग्य अभियान, महाराष्ट्र शासन',
  description: 'महाराष्ट्र शासनाच्या राष्ट्रीय आरोग्य अभियान (NHM) अंतर्गत आशा स्वयंसेविका व अंगणवाडी कार्यकर्तींसाठी अधिकृत मराठी डिजिटल आरोग्य सहाय्यक प्रणाली.',
  keywords: 'आशा सेविका, अंगणवाडी, मराठी, आरोग्य, राष्ट्रीय आरोग्य अभियान महाराष्ट्र, NHM Maharashtra, ASHA workers',
  manifest: '/manifest.json'
}

export default function RootLayout({ children }) {
  return (
    <html lang="mr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Rozha+One&family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PwaRegister />
        {children}
        <DoubtBot />
      </body>
    </html>
  )
}

