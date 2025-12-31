'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Función helper para enviar mensaje a la API
  const sendMessageToAPI = async (userMessage: string, currentMessages: Message[]) => {
    setIsTyping(true)
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...currentMessages, { role: 'user' as const, content: userMessage } as Message],
        }),
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta')
      }

      const data: any = await response.json()
      
      // Simular tiempo de escritura (2-3 segundos)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 2000))
      
      setIsTyping(false)
      const assistantResponse: string = data?.message || data?.content || ''
      
      if (!assistantResponse || assistantResponse.trim().length === 0) {
        throw new Error('Respuesta vacía de la API')
      }
      
      // Verificar que no sea un mensaje duplicado antes de agregarlo
      setMessages((prev: Message[]) => {
        // Buscar todos los mensajes del asistente (no solo el último)
        const assistantMessages = prev.filter(m => m.role === 'assistant')
        
        // Verificar duplicado exacto
        const isExactDuplicate = assistantMessages.some((m: Message) => m?.content === assistantResponse)
        if (isExactDuplicate) {
          return prev
        }
        
        // Verificar similitud con TODOS los mensajes del asistente (no solo el último)
        const normalizedNew = (assistantResponse || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
        const wordsNew = normalizedNew.split(' ').filter((w: string) => w.length > 3)
        
        for (const assistantMsg of assistantMessages.slice(-3)) { // Revisar últimos 3 mensajes
          const msgContent = assistantMsg?.content || ''
          const normalizedLast = msgContent.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
          const wordsLast = normalizedLast.split(' ').filter((w: string) => w.length > 3)
          const commonWords = wordsNew.filter((w: string) => wordsLast.includes(w))
          const similarity = commonWords.length / Math.max(wordsNew.length, wordsLast.length || 1)
          
          // Si es más del 70% similar, no agregar (bajamos el threshold)
          if (similarity > 0.7) {
            return prev
          }
        }
        
        const newMessage: Message = { role: 'assistant', content: assistantResponse }
        return [...prev, newMessage]
      })
    } catch (error: any) {
      setIsTyping(false)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Ups, algo salió mal. Probá de nuevo.'
      }
      setMessages((prev: Message[]) => [...prev, errorMessage])
    }
  }

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return

    const userMessage = input.trim()
    setInput('')
    
    setMessages((prev: Message[]) => {
      const newMessage: Message = { role: 'user', content: userMessage }
      const updatedMessages: Message[] = [...prev, newMessage]
      sendMessageToAPI(userMessage, prev)
      return updatedMessages
    })
  }

  const handleSuggestionClick = async (suggestion: string) => {
    if (isTyping || !suggestion || suggestion.trim().length === 0) return
    
    // Verificar que no se haya enviado este mensaje recientemente
    const lastUserMessage = messages.filter((m: Message) => m.role === 'user').pop()
    if (lastUserMessage?.content === suggestion) {
      return // Ya se envió este mensaje
    }
    
    // Actualizar estado primero
    const newMessage: Message = { role: 'user', content: suggestion.trim() }
    const updatedMessages: Message[] = [...messages, newMessage]
    setMessages(updatedMessages)
    
    // Llamar a la API con el estado actualizado
    await sendMessageToAPI(suggestion.trim(), messages)
  }

  const handleCardClick = async (cardAction: string) => {
    if (isTyping || !cardAction || cardAction.trim().length === 0) return
    
    // Verificar que no se haya enviado este mensaje recientemente
    const lastUserMessage = messages.filter((m: Message) => m.role === 'user').pop()
    if (lastUserMessage?.content === cardAction) {
      return // Ya se envió este mensaje
    }
    
    // Actualizar estado primero
    const newMessage: Message = { role: 'user', content: cardAction.trim() }
    const updatedMessages: Message[] = [...messages, newMessage]
    setMessages(updatedMessages)
    
    // Llamar a la API con el estado actualizado
    await sendMessageToAPI(cardAction.trim(), messages)
  }

  // Función para parsear cards del formato [CARD_X]: Título | Acción
  const parseMessageWithCards = (content: string): 
    | { hasCards: true; cleanedText: string; cards: Array<{ title: string; action: string; fullText: string }> }
    | { hasCards: false; text: string } => {
    // Regex mejorado para encontrar todas las cards: [CARD_X]: Título | Acción
    // Maneja variaciones con o sin espacios, con guiones, etc.
    const cardRegex = /\[CARD[_\s]*(\d+)\]:\s*([^|\n\-]+?)\s*[|\-]\s*([^\n]+)/gi
    const cards: Array<{ title: string; action: string; fullText: string }> = []
    const seenCards = new Set<string>() // Para evitar duplicados
    let match

    // Encontrar todas las cards y extraer información
    while ((match = cardRegex.exec(content)) !== null) {
      const [fullMatch, cardNumber, title, action] = match
      const cardKey = `${cardNumber}:${title.trim().toLowerCase()}` // Clave única para detectar duplicados
      
      // Solo agregar si no está duplicada
      if (!seenCards.has(cardKey) && title.trim().length > 0 && action.trim().length > 0) {
        seenCards.add(cardKey)
        cards.push({
          title: title.trim(),
          action: action.trim(),
          fullText: fullMatch.trim()
        })
      }
    }
    
    // Si no encontró cards con el formato estándar, intentar formato alternativo
    if (cards.length === 0) {
      const altRegex = /CARD[_\s]*(\d+)[:\-]\s*([^|\n]+?)\s*[|\-]\s*([^\n]+)/gi
      while ((match = altRegex.exec(content)) !== null) {
        const [fullMatch, cardNumber, title, action] = match
        const cardKey = `${cardNumber}:${title.trim().toLowerCase()}`
        
        if (!seenCards.has(cardKey) && title.trim().length > 0 && action.trim().length > 0) {
          seenCards.add(cardKey)
          cards.push({
            title: title.trim(),
            action: action.trim(),
            fullText: fullMatch.trim()
          })
        }
      }
    }

    // Si hay cards, limpiar el texto removiendo todas las líneas con [CARD_X]
    if (cards.length > 0) {
      // Remover todas las líneas que contengan [CARD_X] y limpiar espacios múltiples
      const cleanedText = content
        .split('\n')
        .filter(line => !/\[CARD_\d+\]:/.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n') // Limpiar múltiples saltos de línea
        .trim()

      return {
        hasCards: true,
        cleanedText: cleanedText,
        cards: cards.slice(0, 3) // Asegurar máximo 3 cards
      }
    }

    return {
      hasCards: false,
      text: content
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[700px] max-w-3xl mx-auto bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200/50 bg-white/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Huma.io</h2>
          <span className="px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 rounded-full border border-blue-500/20">
            Sales Intelligence
          </span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            {/* Welcome Message */}
            <div className="text-center">
              <p className="text-lg text-gray-600 font-light">
                ¿A quién vamos a investigar hoy?
              </p>
            </div>

            {/* Suggestion Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
              <button
                onClick={() => handleSuggestionClick('Analizar URL de empresa - Necesito analizar fallas en su web')}
                className="group relative p-5 bg-white/60 backdrop-blur-md rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200 text-left"
              >
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="font-medium text-gray-900 mb-1 text-sm">Analizar URL de empresa</h3>
                <p className="text-xs text-gray-500">Descubrí fallas en su web</p>
              </button>

              <button
                onClick={() => handleSuggestionClick('Brief para el CEO - Necesito un gancho para LinkedIn')}
                className="group relative p-5 bg-white/60 backdrop-blur-md rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200 text-left"
              >
                <div className="text-2xl mb-2">👤</div>
                <h3 className="font-medium text-gray-900 mb-1 text-sm">Brief para el CEO</h3>
                <p className="text-xs text-gray-500">Armá un gancho para LinkedIn</p>
              </button>

              <button
                onClick={() => handleSuggestionClick('Detectar fricción - Dónde están perdiendo plata o tienen dolores operativos')}
                className="group relative p-5 bg-white/60 backdrop-blur-md rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md hover:bg-white/80 transition-all duration-200 text-left"
              >
                <div className="text-2xl mb-2">💸</div>
                <h3 className="font-medium text-gray-900 mb-1 text-sm">Detectar fricción</h3>
                <p className="text-xs text-gray-500">¿Dónde están perdiendo plata?</p>
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message: Message, index: number) => {
              const parsed = message.role === 'assistant' && message.content 
                ? parseMessageWithCards(message.content) 
                : null
              
              return (
                <div
                  key={`message-${index}`}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {message.role === 'user' ? (
                    <div className="max-w-[75%] rounded-2xl px-4 py-2.5 backdrop-blur-md bg-blue-500/90 text-white shadow-lg shadow-blue-500/20">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message?.content || ''}
                      </p>
                    </div>
                  ) : parsed?.hasCards ? (
                    <div className="max-w-[85%] space-y-4">
                      {/* Mensaje limpio sin tags [CARD_X] */}
                      {parsed?.cleanedText && (
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-gray-200/50 shadow-sm">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {parsed.cleanedText}
                          </p>
                        </div>
                      )}
                      
                      {/* Cards premium clicables - Estilo blanco o zinc-900 con bordes definidos */}
                      {parsed?.cards && Array.isArray(parsed.cards) && parsed.cards.length > 0 && (
                      <div className="grid grid-cols-1 gap-3">
                        {parsed.cards.map((card: { title: string; action: string; fullText: string }, cardIndex: number) => {
                          if (!card || !card.action || !card.title) return null
                          
                          return (
                          <button
                            key={`card-${cardIndex}`}
                            onClick={() => handleCardClick(card.action)}
                            disabled={isTyping || !card.action}
                            className="group relative p-4 bg-white border-2 border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                <span className="text-base">🎯</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                                  {card.title}
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                  {card.action}
                                </p>
                              </div>
                              <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  stroke="currentColor"
                                  className="w-5 h-5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                                  />
                                </svg>
                              </div>
                            </div>
                          </button>
                          )
                        })}
                      </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[75%] rounded-2xl px-4 py-2.5 backdrop-blur-md bg-white/60 text-gray-900 border border-gray-200/50 shadow-sm">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message?.content || ''}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/60 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-gray-200/50 shadow-sm">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200/50 bg-white/40 backdrop-blur-sm p-4">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pegá una URL o el nombre de una empresa..."
              className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200/50 bg-white/80 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm placeholder-gray-400 shadow-sm"
              disabled={isTyping}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <button
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="relative text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                  />
                </svg>
                {showTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 backdrop-blur-md">
                    Pegá una URL o el nombre de una empresa para empezar la auditoría
                    <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  )
}
