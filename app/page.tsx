'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { IoSend, IoSettingsSharp, IoChevronDown } from 'react-icons/io5'
import { BsRobot, BsPerson, BsBoxSeam } from 'react-icons/bs'
import { FiPackage, FiSearch, FiDatabase } from 'react-icons/fi'
import { HiSparkles } from 'react-icons/hi2'
import { AiOutlineDollar } from 'react-icons/ai'
import { BiTargetLock } from 'react-icons/bi'
import { SiGooglesheets } from 'react-icons/si'
import { LuImport, LuFileSpreadsheet } from 'react-icons/lu'

const AGENT_ID = '699eb282aeb240bf7f952ed3'
const RAG_ID = '699eb26fe9e49857cb7b8de0'

interface Product {
  name: string
  description: string
  price: string
  match_reason: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'error'
  text: string
  products: Product[]
  timestamp: string
}

const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: 'sample-welcome',
    role: 'agent',
    text: "Welcome! I'm your personal product assistant. I can help you find the perfect products based on your needs, preferences, and budget. I can also read product data from your Google Sheets or export recommendations to a spreadsheet. Tell me what you're looking for!",
    products: [],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sample-user-1',
    role: 'user',
    text: 'I need a good pair of wireless headphones for working from home, preferably under $200.',
    products: [],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sample-agent-1',
    role: 'agent',
    text: "Great choice! Working from home calls for comfortable, high-quality audio. Here are my top recommendations based on your needs and budget:",
    products: [
      {
        name: 'Sony WH-1000XM4',
        description: 'Premium wireless noise-cancelling headphones with 30-hour battery life, multipoint connection, and speak-to-chat technology.',
        price: '$178.00',
        match_reason: 'Excellent noise cancellation for home office, within your $200 budget, and industry-leading comfort for all-day wear.',
      },
      {
        name: 'Jabra Evolve2 65',
        description: 'Professional-grade wireless headset with passive noise cancellation, boom microphone, and USB-C dongle for reliable connectivity.',
        price: '$149.99',
        match_reason: 'Designed specifically for remote work with superior microphone quality for video calls and meetings.',
      },
      {
        name: 'Anker Soundcore Life Q35',
        description: 'Multi-mode active noise cancelling headphones with LDAC Hi-Res audio, 40-hour playtime, and plush memory foam ear cups.',
        price: '$79.99',
        match_reason: 'Budget-friendly option with excellent ANC and comfort, leaving room in your budget for other accessories.',
      },
    ],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sample-user-2',
    role: 'user',
    text: 'The Sony ones look great. Are there any accessories you would recommend with those?',
    products: [],
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sample-agent-2',
    role: 'agent',
    text: "Absolutely! Here are some accessories that pair perfectly with the Sony WH-1000XM4 for an enhanced work-from-home setup:",
    products: [
      {
        name: 'Sony Headphone Stand (SRS-RA3000)',
        description: 'Premium aluminum headphone stand with integrated cable management and non-slip base.',
        price: '$29.99',
        match_reason: 'Keeps your Sony headphones organized and within reach on your desk, extending their lifespan.',
      },
      {
        name: 'Replacement Ear Pads (Leather)',
        description: 'High-quality protein leather replacement ear pads with memory foam cushioning.',
        price: '$18.99',
        match_reason: 'Great to have a spare set for extended use, maintaining hygiene and comfort over time.',
      },
    ],
    timestamp: new Date().toISOString(),
  },
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'agent',
  text: "Welcome! I'm your personal product assistant. I can help you find the perfect products based on your needs, preferences, and budget. I can also read product data from your Google Sheets or export recommendations to a spreadsheet. Tell me what you're looking for, and I'll search our catalog for the best matches.",
  products: [],
  timestamp: new Date().toISOString(),
}

const EXAMPLE_PROMPTS = [
  'Find me a laptop for graphic design under $1500',
  'What are the best noise-cancelling headphones?',
  'I need a gift for a coffee lover',
  'Read products from my Google Sheet',
]

function parseAgentResponse(result: any): { response: string; products: Product[] } {
  try {
    let data = result?.response?.result

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        return { response: data, products: [] }
      }
    }

    if (data && typeof data === 'object') {
      const responseText = data.response || data.message || data.text || ''
      const products = Array.isArray(data.products) ? data.products : []
      return { response: typeof responseText === 'string' ? responseText : String(responseText), products }
    }

    const text = result?.response?.message || result?.response?.result?.text || ''
    return { response: typeof text === 'string' ? text : String(text), products: [] }
  } catch {
    return { response: 'Sorry, I had trouble processing that response.', products: [] }
  }
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
        <BsRobot className="w-4 h-4 text-accent" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.15s' }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.3s' }} />
        </div>
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="bg-secondary/50 border-border/60 shadow-sm hover:shadow-md transition-all duration-300 hover:border-accent/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
              <FiPackage className="w-4 h-4 text-accent" />
            </div>
            <h4 className="font-semibold text-sm text-foreground tracking-wide">{product?.name ?? 'Unnamed Product'}</h4>
          </div>
          {product?.price && (
            <Badge variant="secondary" className="bg-accent/15 text-accent border-accent/25 font-mono text-xs flex-shrink-0 flex items-center gap-1">
              <AiOutlineDollar className="w-3 h-3" />
              {product.price}
            </Badge>
          )}
        </div>
        {product?.description && (
          <p className="text-sm text-muted-foreground leading-relaxed tracking-wide">
            {product.description}
          </p>
        )}
        {product?.match_reason && (
          <div className="flex items-start gap-2 bg-accent/10 rounded-lg p-2.5 border border-accent/10">
            <BiTargetLock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {product.match_reason}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AgentBubble({ message }: { message: ChatMessage }) {
  const products = Array.isArray(message?.products) ? message.products : []
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
        <BsRobot className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 max-w-[85%] space-y-3">
        <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          {renderMarkdown(message?.text ?? '')}
        </div>
        {products.length > 0 && (
          <div className="space-y-2 ml-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground tracking-wide">
              <BsBoxSeam className="w-3 h-3" />
              <span>{products.length} product{products.length > 1 ? 's' : ''} found</span>
            </div>
            {products.map((product, idx) => (
              <ProductCard key={`${message.id}-product-${idx}`} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 justify-end">
      <div className="max-w-[80%]">
        <div className="bg-accent text-accent-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed tracking-wide">{message?.text ?? ''}</p>
        </div>
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <BsPerson className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  )
}

function ErrorBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
        <BsRobot className="w-4 h-4 text-destructive" />
      </div>
      <div className="max-w-[85%]">
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm text-destructive leading-relaxed">{message?.text ?? 'An error occurred.'}</p>
        </div>
      </div>
    </div>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sampleMode, setSampleMode] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [sheetId, setSheetId] = useState('')
  const [sheetRange, setSheetRange] = useState('')
  const [showSheetPanel, setShowSheetPanel] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSessionId(`session-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`)
  }, [])

  useEffect(() => {
    if (sampleMode) {
      setMessages(SAMPLE_MESSAGES)
    } else {
      setMessages([WELCOME_MESSAGE])
    }
  }, [sampleMode])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100
    setShowScrollButton(!isNearBottom)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      products: [],
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setActiveAgentId(AGENT_ID)

    try {
      const result = await callAIAgent(text.trim(), AGENT_ID, { session_id: sessionId })

      if (result?.success) {
        const parsed = parseAgentResponse(result)
        const agentMessage: ChatMessage = {
          id: `agent-${Date.now()}`,
          role: 'agent',
          text: parsed.response || 'Here are some recommendations for you.',
          products: parsed.products,
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, agentMessage])
      } else {
        const errorText = result?.error || result?.response?.message || 'Something went wrong. Please try again.'
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'error',
          text: errorText,
          products: [],
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'error',
        text: 'A network error occurred. Please check your connection and try again.',
        products: [],
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
    }
  }, [isLoading, sessionId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }, [inputValue, sendMessage])

  const handlePromptClick = useCallback((prompt: string) => {
    sendMessage(prompt)
  }, [sendMessage])

  const handleSheetRead = useCallback(() => {
    if (!sheetId.trim()) return
    const range = sheetRange.trim() || 'Sheet1'
    const msg = `Read product data from Google Sheet with spreadsheet ID: ${sheetId.trim()} and range: ${range}`
    setShowSheetPanel(false)
    sendMessage(msg)
  }, [sheetId, sheetRange, sendMessage])

  const handleSheetExport = useCallback(() => {
    if (!sheetId.trim()) return
    const range = sheetRange.trim() || 'Sheet1'
    const msg = `Export the product recommendations from our conversation to Google Sheet with spreadsheet ID: ${sheetId.trim()} and range: ${range}`
    setShowSheetPanel(false)
    sendMessage(msg)
  }, [sheetId, sheetRange, sendMessage])

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
                <HiSparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-semibold font-serif tracking-wide text-foreground">Product Assistant</h1>
                <p className="text-xs text-muted-foreground tracking-wide">AI-powered product recommendations</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tracking-wide">Sample Data</span>
                <Switch checked={sampleMode} onCheckedChange={setSampleMode} />
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <IoSettingsSharp className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-card border-border overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-foreground font-serif tracking-wide">Settings</SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                      Manage your product catalog knowledge base
                    </SheetDescription>
                  </SheetHeader>
                  <Separator className="my-4" />
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FiDatabase className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-semibold tracking-wide">Knowledge Base</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        Upload product catalogs, price lists, or product descriptions to enhance recommendations.
                      </p>
                      <KnowledgeBaseUpload ragId={RAG_ID} />
                    </div>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BsRobot className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-semibold tracking-wide">Agent Info</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Agent</span>
                          <span className="text-foreground font-medium">Product Recommendation Agent</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Type</span>
                          <Badge variant="secondary" className="text-xs">JSON</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Status</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full", activeAgentId ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40")} />
                            <span className="text-foreground">{activeAgentId ? 'Processing' : 'Ready'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Knowledge Base</span>
                          <Badge variant="secondary" className="text-xs bg-accent/15 text-accent border-accent/25">Connected</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Google Sheets</span>
                          <Badge variant="secondary" className="text-xs bg-green-900/30 text-green-400 border-green-800/30">Enabled</Badge>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <SiGooglesheets className="w-4 h-4 text-green-500" />
                        <h3 className="text-sm font-semibold tracking-wide">Google Sheets Integration</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                        Connect a Google Sheet to import product data or export recommendations. Provide the spreadsheet ID and optional range.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block tracking-wide">Spreadsheet ID</label>
                          <Input
                            value={sheetId}
                            onChange={(e) => setSheetId(e.target.value)}
                            placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/60 text-xs h-9"
                          />
                          <p className="text-[10px] text-muted-foreground/60 mt-1">Found in your Google Sheet URL after /d/</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block tracking-wide">Range (optional)</label>
                          <Input
                            value={sheetRange}
                            onChange={(e) => setSheetRange(e.target.value)}
                            placeholder="e.g. Sheet1!A1:D50"
                            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/60 text-xs h-9"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleSheetRead}
                            disabled={!sheetId.trim() || isLoading}
                            size="sm"
                            className="flex-1 bg-green-900/40 hover:bg-green-900/60 text-green-300 border border-green-800/30 text-xs h-8"
                          >
                            <LuImport className="w-3.5 h-3.5 mr-1.5" />
                            Import Products
                          </Button>
                          <Button
                            onClick={handleSheetExport}
                            disabled={!sheetId.trim() || isLoading}
                            size="sm"
                            className="flex-1 bg-accent/15 hover:bg-accent/25 text-accent border border-accent/20 text-xs h-8"
                          >
                            <LuFileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                            Export Recs
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto relative" onScroll={handleScroll} ref={scrollAreaRef}>
          <div className="max-w-3xl mx-auto py-4">
            {/* Messages */}
            {messages.map((message) => {
              if (message.role === 'user') {
                return <UserBubble key={message.id} message={message} />
              }
              if (message.role === 'error') {
                return <ErrorBubble key={message.id} message={message} />
              }
              return <AgentBubble key={message.id} message={message} />
            })}

            {/* Welcome Prompts (only show after welcome message if not in sample mode and only 1 message) */}
            {!sampleMode && messages.length === 1 && !isLoading && (
              <div className="px-4 py-3">
                <div className="ml-11">
                  <p className="text-xs text-muted-foreground mb-3 tracking-wide">Try one of these to get started:</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePromptClick(prompt)}
                        className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-full px-3.5 py-2 transition-all duration-200 hover:border-accent/30 tracking-wide leading-relaxed text-left"
                      >
                        <span className="flex items-center gap-1.5">
                          <FiSearch className="w-3 h-3 text-accent flex-shrink-0" />
                          {prompt}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {isLoading && <TypingIndicator />}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Scroll to bottom FAB */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-24 right-6 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-secondary transition-all duration-200"
            >
              <IoChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Google Sheets Quick Panel */}
        {showSheetPanel && (
          <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-3">
                <SiGooglesheets className="w-4 h-4 text-green-500" />
                <span className="text-xs font-semibold tracking-wide text-foreground">Quick Sheet Action</span>
                <button onClick={() => setShowSheetPanel(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <IoChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block tracking-wide">Spreadsheet ID</label>
                  <Input
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="Paste spreadsheet ID here..."
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/60 text-xs h-8"
                  />
                </div>
                <div className="w-36">
                  <label className="text-[10px] text-muted-foreground mb-1 block tracking-wide">Range</label>
                  <Input
                    value={sheetRange}
                    onChange={(e) => setSheetRange(e.target.value)}
                    placeholder="Sheet1!A1:D50"
                    className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/60 text-xs h-8"
                  />
                </div>
                <Button
                  onClick={handleSheetRead}
                  disabled={!sheetId.trim() || isLoading}
                  size="sm"
                  className="bg-green-900/40 hover:bg-green-900/60 text-green-300 border border-green-800/30 text-xs h-8 px-3"
                >
                  <LuImport className="w-3.5 h-3.5 mr-1" />
                  Import
                </Button>
                <Button
                  onClick={handleSheetExport}
                  disabled={!sheetId.trim() || isLoading}
                  size="sm"
                  className="bg-accent/15 hover:bg-accent/25 text-accent border border-accent/20 text-xs h-8 px-3"
                >
                  <LuFileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex-shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSheetPanel(prev => !prev)}
              className={cn("h-11 w-11 rounded-xl flex-shrink-0 transition-all duration-200", showSheetPanel ? "bg-green-900/30 text-green-400" : "text-muted-foreground hover:text-foreground")}
              title="Google Sheets"
            >
              <SiGooglesheets className="w-4.5 h-4.5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you're looking for..."
                disabled={isLoading}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground pr-4 h-11 rounded-xl tracking-wide"
              />
            </div>
            <Button
              onClick={() => sendMessage(inputValue)}
              disabled={isLoading || !inputValue.trim()}
              size="icon"
              className="h-11 w-11 rounded-xl bg-accent hover:bg-accent/80 text-accent-foreground flex-shrink-0 transition-all duration-200"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
              ) : (
                <IoSend className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Agent Status Footer */}
        <div className="flex-shrink-0 border-t border-border bg-background px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <BsRobot className="w-3 h-3" />
                <span className="tracking-wide">Product Recommendation Agent</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5">
                <FiDatabase className="w-3 h-3" />
                <span className="tracking-wide">Knowledge Base</span>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex items-center gap-1.5">
                <SiGooglesheets className="w-3 h-3 text-green-500" />
                <span className="tracking-wide">Google Sheets</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-1.5 h-1.5 rounded-full", activeAgentId ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40")} />
              <span className="tracking-wide">{activeAgentId ? 'Processing...' : 'Ready'}</span>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
