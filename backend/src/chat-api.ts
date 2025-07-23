import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatService } from './services/ChatService.js';
import { validateChatRequest, sanitizePrompt, validateEnvironment } from './utils/validation.js';
import { createErrorResponse, ValidationError, ConfigurationError } from './utils/errors.js';
import { API_CONFIG } from './constants/index.js';
import { MongoClient } from "mongodb";

// Load environment variables
console.log('🔧 Loading environment variables...');
dotenv.config();
console.log('✅ Environment variables loaded');

// Initialize MongoDB client
console.log('🔗 Initializing MongoDB client...');
const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);
console.log('✅ MongoDB client initialized');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🛠️ Setting up middleware...');
// Middleware
app.use(cors());
app.use(express.json({ limit: API_CONFIG.REQUEST_BODY_LIMIT }));
console.log('✅ Middleware configured');

// Validate environment on startup
console.log('🔍 Validating environment configuration...');
const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  console.error('❌ Environment validation failed:');
  envValidation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}
console.log('✅ Environment validation passed');

// Initialize chat service (singleton)
let chatService: ChatService;

console.log('🚀 Initializing ChatService...');
try {
  console.log('📋 ChatService configuration:');
  console.log(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '***[SET]***' : '[NOT SET]'}`);
  console.log(`   - Model Name: ${process.env.OPENAI_MODEL_NAME || API_CONFIG.DEFAULT_MODEL}`);
  console.log(`   - MCP Server URL: ${process.env.MCP_SERVER_URL || API_CONFIG.DEFAULT_MCP_SERVER_URL}`);
  console.log(`   - Temperature: ${parseFloat(process.env.OPENAI_TEMPERATURE || API_CONFIG.DEFAULT_TEMPERATURE.toString())}`);
  console.log(`   - Recursion Limit: ${parseInt(process.env.RECURSION_LIMIT || API_CONFIG.DEFAULT_RECURSION_LIMIT.toString())}`);

  chatService = ChatService.getInstance({
    openaiApiKey: process.env.OPENAI_API_KEY!,
    modelName: process.env.OPENAI_MODEL_NAME || API_CONFIG.DEFAULT_MODEL,
    mcpServerUrl: process.env.MCP_SERVER_URL || API_CONFIG.DEFAULT_MCP_SERVER_URL,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || API_CONFIG.DEFAULT_TEMPERATURE.toString()),
    recursionLimit: parseInt(process.env.RECURSION_LIMIT || API_CONFIG.DEFAULT_RECURSION_LIMIT.toString()),
  });
  console.log('✅ ChatService initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize ChatService:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🩺 Health check requested');
  const healthData = { 
    status: 'OK', 
    message: 'Chat API is running',
    timestamp: new Date().toISOString()
  };
  console.log('✅ Health check response:', healthData);
  res.json(healthData);
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  const requestId = Date.now().toString(36);
  console.log(`\n🎯 [${requestId}] New chat request received`);
  console.log(`📥 [${requestId}] Request body:`, JSON.stringify(req.body, null, 2));

  try {
    // Validate request body
    console.log(`🔍 [${requestId}] Validating request body...`);
    const validation = validateChatRequest(req.body);
    if (!validation.success) {
      console.error(`❌ [${requestId}] Request validation failed:`, validation.errors);
      throw new ValidationError(`Invalid request: ${validation.errors.join(', ')}`);
    }
    console.log(`✅ [${requestId}] Request validation passed`);

    const { prompt, message } = validation.data;
    const userPrompt = sanitizePrompt(prompt || message || '');
    console.log(`🧹 [${requestId}] Sanitized prompt: "${userPrompt}"`);

    const thread_id = req.body.threadId || "threadId";
    console.log(`🧵 [${requestId}] Thread ID: ${thread_id}`);

    console.log(`🔄 [${requestId}] Processing chat request...`);
    // Process the chat request
    const result = await chatService.processChat(userPrompt, client, thread_id);
    console.log(`⚡ [${requestId}] Chat processing completed`);
    console.log(`📊 [${requestId}] Result success: ${result.success}`);

    if (result.success) {
      const responseData = {
        success: true,
        prompt: userPrompt,
        response: result.response,
        timestamp: result.timestamp
      };
      console.log(`✅ [${requestId}] Sending successful response`);
      console.log(`📤 [${requestId}] Response length: ${result.response?.length || 0} characters`);
      res.json(responseData);
    } else {
      const errorData = {
        success: false,
        error: result.error,
        prompt: userPrompt,
        timestamp: result.timestamp
      };
      console.error(`❌ [${requestId}] Sending error response:`, result.error);
      res.status(500).json(errorData);
    }

  } catch (error) {
    console.error(`💥 [${requestId}] Error processing chat request:`, error);
    
    const errorResponse = createErrorResponse(error);
    console.error(`📤 [${requestId}] Sending error response with status ${errorResponse.error.statusCode}`);
    res.status(errorResponse.error.statusCode).json(errorResponse);
  }

  console.log(`🏁 [${requestId}] Request completed\n`);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Gracefully shutting down...');
  
  try {
    console.log('🧹 Cleaning up ChatService...');
    await ChatService.destroyInstance();
    console.log('✅ ChatService cleaned up');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
  
  console.log('👋 Goodbye!');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Chat API server running on http://localhost:${PORT}`);
  console.log(`📖 API Documentation:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /chat   - Send a chat message`);
  console.log(`\n📝 Example usage:`);
  console.log(`   curl -X POST http://localhost:${PORT}/chat \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"prompt": "Show all customers from neo4j database"}'`);
  console.log(`\n🔧 Environment:`);
  console.log(`   Model: ${process.env.OPENAI_MODEL_NAME || API_CONFIG.DEFAULT_MODEL}`);
  console.log(`   MCP Server: ${process.env.MCP_SERVER_URL || API_CONFIG.DEFAULT_MCP_SERVER_URL}`);
  console.log(`\n🎉 Server ready to accept requests!`);
});

export default app; 