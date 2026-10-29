'use client'
import { useState, useEffect, useRef } from 'react'
import { IconMic } from './Icons'

export default function DoubtBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [lang, setLang] = useState('mr')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [speakingIdx, setSpeakingIdx] = useState(null)
  const [hasUnread, setHasUnread] = useState(true)

  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'नमस्कार! मी आपला **आरोग्य मित्र AI सहाय्यक** आहे. आरोग्य मार्गदर्शक तत्त्वे, बाल लसीकरण, गरोदर माता तपासणी किंवा कार्यपद्धतीबद्दल कोणतीही शंका असल्यास येथे विचारा!',
      textEn: 'Hello! I am your **Seva Health AI Assistant**. Ask any questions about maternal care, vaccination schedules, malnutrition, or health procedures!',
      time: 'आता'
    }
  ])

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages])

  // Quick suggestion chips
  const chips = [
    { label: 'गरोदर माता तपासणी', q: 'गरोदर माता तपासणी ANC वेळापत्रक काय आहे?' },
    { label: 'बाल लसीकरण', q: 'बाल लसीकरण वेळापत्रक सांगा' },
    { label: 'कुपोषण SAM/MAM', q: 'कुपोषण SAM आणि MAM कसे ओळखायचे?' },
    { label: 'आपत्कालीन १०८/१०२', q: 'आपत्कालीन रुग्णवाहिका नंबर काय आहेत?' },
    { label: 'आरोग्य सेवा', q: 'आरोग्य सेवांची माहिती द्या' },
    { label: 'OTP मदत', q: 'लॉगिन आणि OTP मदत सांगा' }
  ]

  const handleSend = async (questionText = null) => {
    const queryToSend = (questionText || input).trim()
    if (!queryToSend || loading) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { sender: 'user', text: queryToSend, time: now }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToSend, lang })
      })

      const data = await res.json()
      const botMsg = {
        sender: 'bot',
        text: data.answer || (lang === 'en' ? 'Could not fetch answer.' : 'माहिती मिळवण्यात अडचण आली.'),
        source: data.source || null,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: lang === 'en'
            ? 'Network connection error. Please try again.'
            : 'सर्व्हरशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  // Voice Speech Recognition with permission check & feedback
  const handleVoiceInput = async () => {
    if (typeof window === 'undefined') return

    // If currently listening, toggle off
    if (isListening) {
      try {
        recognitionRef.current?.stop()
      } catch (e) {}
      setIsListening(false)
      return
    }

    setVoiceError('')

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError(lang === 'en'
        ? 'Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.'
        : 'आपल्या ब्राउझरमध्ये व्हॉइस इनपुट उपलब्ध नाही. कृपया Google Chrome किंवा Microsoft Edge वापरा.')
      return
    }

    // Step 1: Probe / request microphone permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
      }
    } catch (err) {
      console.warn('Microphone permission check failed:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError(lang === 'en'
          ? 'Microphone permission was denied. Please allow microphone in browser (click site settings icon in address bar).'
          : 'मायक्रोफोन परवानगी नाकारली आहे. कृपया ब्राउझरच्या ॲड्रेस बारमधून मायक्रोफोन Allow करा.')
        return
      }
    }

    // Step 2: Initialize Web Speech API
    try {
      const recognition = new SpeechRecognition()
      recognition.lang = lang === 'mr' ? 'mr-IN' : 'en-US'
      recognition.interimResults = true
      recognition.continuous = false

      recognition.onstart = () => {
        setIsListening(true)
        setVoiceError('')
      }

      recognition.onresult = (e) => {
        let final = ''
        let interim = ''
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript
          } else {
            interim += e.results[i][0].transcript
          }
        }
        const text = final || interim
        if (text) {
          setInput(text)
        }
        if (final && final.trim()) {
          handleSend(final.trim())
        }
      }

      recognition.onerror = (e) => {
        console.warn('SpeechRecognition error:', e.error)
        setIsListening(false)
        if (e.error === 'not-allowed') {
          setVoiceError(lang === 'en'
            ? 'Microphone access denied. Please click site permissions in the URL bar to allow microphone.'
            : 'मायक्रोफोन परवानगी नाकारली आहे. कृपया ॲड्रेस बारमधील सेटिंग्जमधून मायक्रोफोन Allow करा.')
        } else if (e.error === 'network') {
          setVoiceError(lang === 'en'
            ? 'Voice recognition needs active internet connection. Please type your query.'
            : 'व्हॉइस सेवेसाठी इंटरनेट आवश्यक आहे. कृपया प्रश्न टाईप करून विचारा.')
        } else if (e.error === 'no-speech') {
          setVoiceError(lang === 'en'
            ? 'No speech detected. Please click the mic and speak clearly.'
            : 'कोणताही आवाज ऐकू आला नाही. कृपया पुन्हा माइक दाबून स्पष्ट बोला.')
        } else if (e.error !== 'aborted') {
          setVoiceError(`व्हॉइस त्रुटी: ${e.error}`)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsListening(false)
      setVoiceError(lang === 'en'
        ? 'Could not start microphone. Please try again or type your question.'
        : 'व्हॉइस इनपुट सुरू करताना अडचण आली. कृपया पुन्हा प्रयत्न करा.')
    }
  }

  // Text-to-Speech
  const handleReadAloud = (text, idx) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    if (speakingIdx === idx) {
      window.speechSynthesis.cancel()
      setSpeakingIdx(null)
      return
    }

    window.speechSynthesis.cancel()
    const cleanText = text.replace(/[*#•`_]/g, '')
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = lang === 'mr' ? 'mr-IN' : 'en-US'
    utterance.onend = () => setSpeakingIdx(null)
    utterance.onerror = () => setSpeakingIdx(null)

    setSpeakingIdx(idx)
    window.speechSynthesis.speak(utterance)
  }

  // Formatting helpers for bold & bullets
  const renderFormattedText = (rawText) => {
    const lines = rawText.split('\n')
    return lines.map((line, lIdx) => {
      // Split bold markers **...**
      const parts = line.split(/(\*\*.*?\*\*)/g)
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} style={{ color: 'inherit', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        }
        return part
      })
      return (
        <span key={lIdx} style={{ display: 'block', marginBottom: line.trim() ? 4 : 8 }}>
          {formattedLine}
        </span>
      )
    })
  }

  return (
    <>
      {/* ── FLOATING BOT LAUNCHER BUTTON ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 8
        }}
      >
        {/* Tooltip badge */}
        {!isOpen && hasUnread && (
          <div
            onClick={() => setIsOpen(true)}
            style={{
              background: '#0f1626',
              color: '#3fd8ff',
              border: '1px solid rgba(63,216,255,0.4)',
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              animation: 'bounce 2s infinite'
            }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#c6ff2e' }} />
            <span>{lang === 'mr' ? 'शंका विचारा? (AI Bot)' : 'Ask Doubts? (AI Bot)'}</span>
          </div>
        )}

        {/* Circular Floating Button */}
        <button
          type="button"
          id="doubt-bot-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open Doubt Clearing Assistant"
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #0f1626 100%)',
            border: '2px solid rgba(63, 216, 255, 0.6)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(63, 216, 255, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3fd8ff',
            transition: 'all .25s ease',
            transform: isOpen ? 'rotate(90deg) scale(0.95)' : 'scale(1)'
          }}
        >
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="3" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth="3" />
              <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth="3" />
            </svg>
          )}
        </button>
      </div>

      {/* ── EXPANDABLE CHAT PANEL ── */}
      {isOpen && (
        <div
          id="doubt-bot-window"
          style={{
            position: 'fixed',
            bottom: 92,
            right: 24,
            width: 'clamp(320px, 92vw, 410px)',
            height: 'clamp(480px, 75vh, 600px)',
            background: '#0d1527',
            border: '1px solid rgba(63, 216, 255, 0.3)',
            borderRadius: 20,
            boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 35px rgba(63,216,255,0.15)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter Tight', -apple-system, sans-serif"
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              background: '#090f1d',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(63,216,255,0.15)',
                  border: '1px solid #3fd8ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3fd8ff'
                }}
              >
                AI
              </div>
              <div>
                <div style={{ color: '#f4f6fa', fontSize: 14, fontWeight: 700, letterSpacing: '.02em' }}>
                  {lang === 'mr' ? 'आरोग्य मित्र AI सहाय्यक' : 'Seva Health AI Assistant'}
                </div>
                <div style={{ color: '#c6ff2e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c6ff2e' }} />
                  <span>{lang === 'mr' ? '२४/७ डिजिटल शंका समाधान' : '24/7 Digital Assistant'}</span>
                </div>
              </div>
            </div>

            {/* Language & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setLang(l => l === 'mr' ? 'en' : 'mr')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(63,216,255,0.3)',
                  color: '#3fd8ff',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
                title="Toggle Language"
              >
                {lang === 'mr' ? 'ENG' : 'मराठी'}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(244,246,250,0.6)',
                  cursor: 'pointer',
                  padding: 4
                }}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(15, 22, 38, 0.7)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none'
            }}
          >
            {chips.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(c.q)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(244,246,250,0.85)',
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all .2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3fd8ff'
                  e.currentTarget.style.color = '#3fd8ff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.color = 'rgba(244,246,250,0.85)'
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '86%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.55,
                    wordBreak: 'break-word',
                    background: m.sender === 'user'
                      ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                      : '#162035',
                    color: '#f4f6fa',
                    border: m.sender === 'user'
                      ? 'none'
                      : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
                  }}
                >
                  {renderFormattedText(lang === 'en' && m.textEn ? m.textEn : m.text)}

                  {/* Actions for bot response: Read aloud */}
                  {m.sender === 'bot' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 10,
                        color: 'rgba(244,246,250,0.5)'
                      }}
                    >
                      <span>{m.source || (lang === 'mr' ? 'अधिकृत आरोग्य मार्गदर्शक' : 'Official Guidelines')}</span>
                      <button
                        type="button"
                        onClick={() => handleReadAloud(m.text, idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: speakingIdx === idx ? '#c6ff2e' : 'rgba(63,216,255,0.8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11
                        }}
                        title={speakingIdx === idx ? 'Stop audio' : 'Read aloud'}
                      >
                        {speakingIdx === idx ? 'थांबवा' : 'ऐका'}
                      </button>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'rgba(244,246,250,0.35)', marginTop: 2, padding: '0 4px' }}>
                  {m.time}
                </span>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3fd8ff', fontSize: 12, paddingLeft: 6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3fd8ff', animation: 'ping 1s infinite' }} />
                <span>{lang === 'mr' ? 'उत्तर तयार होत आहे...' : 'Analyzing medical guidelines...'}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Active Listening Indicator Banner */}
          {isListening && (
            <div
              style={{
                padding: '8px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 600
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'ping 1s infinite' }} />
                <span>ऐकत आहे... कृपया आपला प्रश्न बोला ({lang === 'mr' ? 'मराठी' : 'English'})</span>
              </div>
              <button
                type="button"
                onClick={handleVoiceInput}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                थांबवा
              </button>
            </div>
          )}

          {/* Voice Error Notice Banner */}
          {voiceError && (
            <div
              style={{
                padding: '8px 14px',
                background: 'rgba(245, 158, 11, 0.15)',
                borderTop: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#fcd34d',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                lineHeight: 1.4
              }}
            >
              <span>{voiceError}</span>
              <button
                type="button"
                onClick={() => setVoiceError('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fcd34d',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '0 4px'
                }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input Area */}
          <div
            style={{
              padding: '12px 14px',
              background: '#090f1d',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={isListening ? 'आवाज ऐकत आहे...' : (lang === 'mr' ? 'तुमची कोणतीही शंका विचारा...' : 'Type any doubt or question...')}
              style={{
                flex: 1,
                background: isListening ? 'rgba(239, 68, 68, 0.08)' : '#131c2e',
                border: isListening ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#f4f6fa',
                fontSize: 13,
                outline: 'none',
                transition: 'all .2s'
              }}
            />

            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={handleVoiceInput}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: isListening ? '#ef4444' : 'rgba(255,255,255,0.06)',
                border: isListening ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                color: isListening ? '#ffffff' : '#3fd8ff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .2s'
              }}
              title={isListening ? 'माइक थांबवा (Stop)' : (lang === 'mr' ? 'माईक द्वारे बोला (Speak)' : 'Voice Input')}
              id="doubt-bot-mic-btn"
            >
              <IconMic size={18} />
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: input.trim() ? '#c6ff2e' : 'rgba(255,255,255,0.1)',
                border: 'none',
                color: input.trim() ? '#0f1626' : 'rgba(255,255,255,0.3)',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                transition: 'all .2s'
              }}
              title={lang === 'mr' ? 'पाठवा' : 'Send'}
            >
              पाठवा
            </button>
          </div>
        </div>
      )}
    </>
  )
}
