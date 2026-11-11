import '../styles/globals.css'
import { AuthProvider } from '../src/context/AuthContext'
import { LangProvider } from '../src/context/LangContext'
import { Frieze, FRIEZE_HEIGHT } from '../src/theme'

// Every page sits on the poster's cream background (globals.css) with the
// orange scallop frieze at the very bottom.
export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <LangProvider>
        <div style={{ position: 'relative', minHeight: '100vh', paddingBottom: FRIEZE_HEIGHT + 12 }}>
          <Component {...pageProps} />
          <Frieze />
        </div>
      </LangProvider>
    </AuthProvider>
  )
}
