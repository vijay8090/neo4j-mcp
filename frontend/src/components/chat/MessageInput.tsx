'use client'

import { useState, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message..." 
}: MessageInputProps) {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg",
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
              "placeholder-gray-500 dark:placeholder-gray-400",
              "focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "resize-none min-h-[44px] max-h-32",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{
              height: 'auto',
              minHeight: '44px',
              maxHeight: '128px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${target.scrollHeight}px`
            }}
          />
        </div>
        
        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={cn(
            "flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center",
            "bg-blue-600 hover:bg-blue-700 text-white",
            "transition-colors duration-200",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
} 