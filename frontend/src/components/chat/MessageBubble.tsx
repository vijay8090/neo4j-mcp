'use client'

import { Message } from '@/types/chat'
import { cn, formatTimestamp } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { User, Bot, AlertCircle } from 'lucide-react'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const hasError = message.status === 'error'

  const getIcon = () => {
    if (isSystem) return <AlertCircle className="w-4 h-4" />
    if (isUser) return <User className="w-4 h-4" />
    return <Bot className="w-4 h-4" />
  }

  const getBgColor = () => {
    if (hasError) return 'bg-red-50 dark:bg-red-900/20'
    if (isSystem) return 'bg-yellow-50 dark:bg-yellow-900/20'
    if (isUser) return 'bg-blue-600 text-white'
    return 'bg-gray-100 dark:bg-gray-800'
  }

  const getTextColor = () => {
    if (hasError) return 'text-red-800 dark:text-red-200'
    if (isSystem) return 'text-yellow-800 dark:text-yellow-200'
    if (isUser) return 'text-white'
    return 'text-gray-900 dark:text-gray-100'
  }

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isUser ? 'flex-row-reverse message-user' : 'flex-row message-assistant'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-blue-600 text-white'
            : isSystem
            ? 'bg-yellow-500 text-white'
            : 'bg-gray-600 text-white'
        )}
      >
        {getIcon()}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          getBgColor(),
          getTextColor()
        )}
      >
        {/* Message text */}
        <div className="prose prose-sm max-w-none">
          {isUser ? (
            <p className="m-0">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp and status */}
        <div
          className={cn(
            'text-xs mt-2 opacity-70',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {formatTimestamp(message.timestamp)}
          {message.status === 'sending' && (
            <span className="ml-2">Sending...</span>
          )}
          {message.status === 'error' && (
            <span className="ml-2 text-red-500">Failed to send</span>
          )}
        </div>
      </div>
    </div>
  )
} 