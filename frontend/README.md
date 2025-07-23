# MCP Chat Assistant - Frontend

A modern Next.js chat interface for interacting with the MCP (Model Context Protocol) backend that connects to Neo4j and OpenAI.

## Features

- 🎨 Modern, responsive UI with Tailwind CSS
- 🌙 Dark/Light mode toggle
- 📝 Rich markdown rendering with syntax highlighting
- ⚡ Real-time typing indicators
- 🔄 Error handling and retry functionality
- 📱 Mobile-friendly design
- 🎯 Clean, intuitive chat interface

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Running MCP backend (see parent directory)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.local.example .env.local
```

3. Update the API URL in `.env.local` if needed (defaults to `http://localhost:3001`)

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

### Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`: Base URL for the chat API (default: `http://localhost:3001`)

## Architecture

The frontend is built with:

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React Markdown** - Markdown rendering with GitHub Flavored Markdown
- **Lucide React** - Beautiful icons
- **Rehype Highlight** - Syntax highlighting for code blocks

### Component Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   ├── chat/              # Chat-related components
│   │   ├── ChatContainer.tsx    # Main chat logic
│   │   ├── MessageBubble.tsx    # Individual messages
│   │   ├── MessageInput.tsx     # Input field
│   │   ├── MessageList.tsx      # Message history
│   │   └── TypingIndicator.tsx  # Loading animation
│   └── ui/                # Reusable UI components
│       └── ThemeToggle.tsx      # Dark/light mode toggle
├── lib/
│   ├── api.ts             # API client
│   └── utils.ts           # Utility functions
└── types/
    └── chat.ts            # TypeScript types
```

## Usage

1. Start typing your message in the input field at the bottom
2. Press Enter to send (Shift+Enter for new lines)
3. The assistant will respond with helpful information from your Neo4j database
4. Use the theme toggle to switch between light and dark modes
5. Use "Clear Chat" to start a new conversation
6. Use "Retry" if a message fails to send

## API Integration

The frontend communicates with the backend via REST API:

- `POST /chat` - Send a message and receive a response
- `GET /health` - Check backend health

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Styling

The app uses Tailwind CSS with a custom configuration that includes:

- Typography plugin for markdown content
- Dark mode support
- Custom animations for messages
- Responsive design utilities

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the MCP Loader JS implementation.
