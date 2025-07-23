export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'error'
}

export interface ChatResponse {
  success: boolean
  prompt: string
  response: string
  timestamp: string
  error?: string
  message?: string
}

export interface ChatRequest {
  prompt: string
  threadId?: string
} 