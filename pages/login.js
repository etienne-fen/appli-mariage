import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { auth } from '../src/firebase/firebaseClient'
import { useAuth } from '../src/context/AuthContext'
import { normalizePhone } from '../src/lib/phone'
import { findPersonByPhone } from '../src/lib/persons'
import strings from '../src/i18n/auth'

export default function LoginPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [lang, setLang] = useState('FR')
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('+33')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const confirmationRef  = useRef(null)
  const recaptchaRef     = useRef(null)
  const isVerifyingRef   = useRef(false)
  const t = strings[lang]

  useEffect(() => {
    if (!loading && user && !isVerifyingRef.current) router.replace('/dashboard')
  }, [user, loading, router])

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear()
        recaptchaRef.current = null
      }
    }
  }, [])

  function getRecaptcha() {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
    }
    return recaptchaRef.current
  }

  function clearRecaptcha() {
    if (recaptchaRef.current) { recaptchaRef.current.clear(); recaptchaRef.current = null }
  }

  function mapError(code) {
    const map = {
      'auth/invalid-phone-number':      t.errors.invalidPhone,
      'auth/too-many-requests':         t.errors.tooManyRequests,
      'auth/invalid-verification-code': t.errors.wrongCode,
      'auth/code-expired':              t.errors.codeExpired,
    }
    return map[code] ?? t.errors.generic
  }

  async function handleSendCode(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await signInWithPhoneNumber(auth, normalizePhone(phone), getRecaptcha())
      confirmationRef.current = result
      setStep('otp')
    } catch (err) {
      clearRecaptcha()
      setError(mapError(err.code))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    isVerifyingRef.current = true
    setError('')
    setBusy(true)
    try {
      const credential  = await confirmationRef.current.confirm(code)
      const phoneNumber = credential.user.phoneNumber
      const person      = await findPersonByPhone(phoneNumber)
      if (!person) {
        await signOut()
        setError(`${t.errors.notInvited}\n(${phoneNumber})`)
        setStep('phone')
        setCode('')
        return
      }
      router.replace('/dashboard')
    } catch (err) {
      setError(mapError(err.code))
    } finally {
      isVerifyingRef.current = false
      setBusy(false)
    }
  }

  function handleBack() {
    clearRecaptcha()
    setStep('phone')
    setCode('')
    setError('')
  }

  if (loading) return null

  return (
    <div style={s.page}>
      {/* Language toggle */}
      <button onClick={() => setLang(l => l === 'FR' ? 'EN' : 'FR')} style={s.langBtn}>
        {lang === 'FR' ? 'EN' : 'FR'}
      </button>

      {/* Hero */}
      <div style={s.hero}>
        <h1 style={s.title}>Charlotte<br />&amp; Etienne</h1>
        <WavyLine />
        <p style={s.tagline}>Du Sud, d'Est en Ouest</p>
      </div>

      {/* Form */}
      <div style={s.formWrap}>
        {step === 'phone' ? (
          <form onSubmit={handleSendCode} style={s.form}>
            <p style={s.formHint}>{t.subtitle}</p>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              style={s.input}
              autoComplete="tel"
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || phone.length < 4}
              style={{ ...s.btn, opacity: busy || phone.length < 4 ? 0.5 : 1 }}
            >
              {busy ? t.sending : t.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} style={s.form}>
            <p style={s.formHint}>{t.otpPrompt(normalizePhone(phone))}</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder={t.codePlaceholder}
              style={{ ...s.input, textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.6rem' }}
              autoComplete="one-time-code"
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              style={{ ...s.btn, opacity: busy || code.length !== 6 ? 0.5 : 1 }}
            >
              {busy ? t.signingIn : t.verify}
            </button>
            <button type="button" onClick={handleBack} style={s.backBtn}>
              ← {t.back}
            </button>
          </form>
        )}

        {error && (
          <p style={s.error}>
            {error.split('\n').map((line, i) => (
              <span key={i}>{line}{i < error.split('\n').length - 1 && <br />}</span>
            ))}
          </p>
        )}
      </div>

      {/* Date */}
      <p style={s.date}>3 juillet 2027</p>

      {/* Scallop decoration */}
      <ScallopBottom />

      <div id="recaptcha-container" />
    </div>
  )
}

// ── Decorative components ─────────────────────────────────────────────────────

function WavyLine() {
  return (
    <svg
      viewBox="0 0 240 16"
      style={{ display: 'block', width: '100%', maxWidth: '180px', margin: '0.5rem auto 0.75rem' }}
      aria-hidden="true"
    >
      <path d="M0,8 Q30,2 60,8 Q90,14 120,8 Q150,2 180,8 Q210,14 240,8"
        fill="none" stroke="#C04040" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M0,12 Q30,6 60,12 Q90,18 120,12 Q150,6 180,12 Q210,18 240,12"
        fill="none" stroke="#C04040" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ScallopBottom() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', overflow: 'hidden', lineHeight: 0 }}>
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i} style={{
          flexShrink: 0,
          width: 28,
          height: 14,
          borderRadius: '14px 14px 0 0',
          background: '#E8A020',
        }} />
      ))}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const GREEN  = '#1E4A2E'
const CREAM  = '#F5E8D0'
const CORAL  = '#C04040'

const s = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1.5rem 3.5rem',
    background: `linear-gradient(175deg, #EEC5B5 0%, #F2D5C0 22%, ${CREAM} 55%, ${CREAM} 100%)`,
    overflow: 'hidden',
  },

  langBtn: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: `1px solid ${GREEN}44`,
    borderRadius: '0.25rem',
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    color: GREEN,
    fontFamily: SERIF,
    letterSpacing: '0.05em',
  },

  hero: {
    textAlign: 'center',
    marginBottom: '2rem',
  },

  title: {
    fontFamily: SERIF,
    fontSize: 'clamp(2.4rem, 9vw, 3.5rem)',
    fontWeight: 700,
    color: GREEN,
    margin: '0 0 0.25rem',
    lineHeight: 1.1,
    letterSpacing: '0.01em',
  },

  tagline: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 'clamp(1rem, 4vw, 1.2rem)',
    color: CORAL,
    margin: 0,
    fontWeight: 400,
    letterSpacing: '0.02em',
  },

  formWrap: {
    width: '100%',
    maxWidth: '340px',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },

  formHint: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: '0.875rem',
    color: '#888',
    margin: '0 0 0.25rem',
    textAlign: 'center',
  },

  input: {
    padding: '0.9rem 1rem',
    borderRadius: '0.6rem',
    border: `1.5px solid ${GREEN}55`,
    fontSize: '1rem',
    width: '100%',
    background: 'rgba(255,252,245,0.85)',
    color: '#333',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
  },

  btn: {
    padding: '0.9rem',
    borderRadius: '0.6rem',
    background: GREEN,
    color: '#fff',
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SERIF,
    letterSpacing: '0.04em',
  },

  backBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    alignSelf: 'center',
    padding: '0.25rem',
    fontFamily: SERIF,
    fontStyle: 'italic',
  },

  error: {
    marginTop: '0.75rem',
    padding: '0.75rem 1rem',
    background: 'rgba(192,64,64,0.08)',
    borderLeft: `3px solid ${CORAL}`,
    borderRadius: '0 0.4rem 0.4rem 0',
    color: CORAL,
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },

  date: {
    marginTop: '2rem',
    fontFamily: SERIF,
    fontSize: '0.8rem',
    color: `${GREEN}88`,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
}
