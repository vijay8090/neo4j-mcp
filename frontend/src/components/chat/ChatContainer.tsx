'use client'

import { useState, useCallback, useEffect } from 'react'
import { Message } from '@/types/chat'
import { ChatAPI } from '@/lib/api'
import { generateId } from '@/lib/utils'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { ThemeToggle } from '../ui/ThemeToggle'
import { AlertCircle, RefreshCw, Plus } from 'lucide-react'

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string>('')

  // Generate initial thread ID on component mount
  useEffect(() => {
    setThreadId(generateId())
  }, [])

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, newMessage])
    return newMessage
  }, [])

  const updateMessageStatus = useCallback((messageId: string, status: Message['status']) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      )
    )
  }, [])

  const handleSendMessage = useCallback(async (content: string) => {
    // Clear any previous errors
    setError(null)
    
    // Add user message
    const userMessage = addMessage({
      role: 'user',
      content,
      status: 'sent',
    })

    // Set loading state
    setIsLoading(true)

    try {
      // Call the chat API with the current thread ID
      const response = await ChatAPI.sendMessage(content, threadId)
      
      if (response.success) {
        // Add assistant response
        addMessage({
          role: 'assistant',
          content: response.response,
          status: 'sent',
        })
      } else {
        throw new Error(response.message || 'Failed to get response')
      }
    } catch (err) {
      console.error('Chat error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      
      // Update user message status to error
      updateMessageStatus(userMessage.id, 'error')
      
      // Add error message
      addMessage({
        role: 'system',
        content: `Error: ${errorMessage}`,
        status: 'sent',
      })
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [addMessage, updateMessageStatus, threadId])

  const handleRetry = useCallback(() => {
    // Find the last user message and resend it
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content)
    }
  }, [messages, handleSendMessage])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const startNewChat = useCallback(() => {
    // Generate new thread ID and clear messages
    setThreadId(generateId())
    setMessages([])
    setError(null)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              MCP Chat Assistant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Powered by Neo4j and OpenAI • Session: {threadId.slice(-8)}
            </p>
          </div>
          
          <div className="flex gap-2">
            {error && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            
            <button
              onClick={startNewChat}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
            >
              <Plus className="w-3 h-3" />
              New Chat
            </button>
            
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
            
            <ThemeToggle />
          </div>
        </div>
        
        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <MessageList messages={messages} isTyping={isLoading} />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder={isLoading ? "Thinking..." : "Ask me anything about your Neo4j database..."}
      />
    </div>
  )
} 