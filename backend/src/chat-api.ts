import express from 'express';
import cors from 'cors';
import { HumanMessage } from "@langchain/core/messages";
import { runExample } from './index-neo4j-stream.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Chat API is running' });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { prompt, message } = req.body;
    
    // Validate input
    const userPrompt = prompt || message;
    if (!userPrompt || typeof userPrompt !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Please provide a "prompt" or "message" field with your question'
      });
    }

    console.log(`🎯 Received chat request: "${userPrompt}"`);

    // Create a custom version of runExample that accepts a prompt
    const result = await runChatExample(userPrompt);

    res.json({
      success: true,
      prompt: userPrompt,
      response: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing chat request:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

// Modified version of runExample that accepts a custom prompt
async function runChatExample(userPrompt: string): Promise<string> {
  try {
    console.log("🚀 Initializing MCP LangGraph Example for chat...");
    
    // Import and use the existing workflow setup
    const { ChatOpenAI } = await import("@langchain/openai");
    const {
      StateGraph,
      END,
      START,
      MessagesAnnotation,
    } = await import("@langchain/langgraph");
    const { ToolNode } = await import("@langchain/langgraph/prebuilt");
    const {
      AIMessage,
      SystemMessage,
      isHumanMessage,
    } = await import("@langchain/core/messages");
    const { MultiServerMCPClient } = await import("@langchain/mcp-adapters");

    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    console.log("🔌 Initializing MCP client...");

    // Create a client with configurations for the neo4j server
    const client = new MultiServerMCPClient({
      mcpServers: {
        "neo4j-docker": {
          "command": "npx",
          "args": ["-y", "mcp-remote@latest", "http://localhost:8000/api/mcp/"]
        },
      },
      useStandardContentBlocks: true,
    });

    console.log("✅ Connected to MCP server");

    // Get all tools
    const mcpTools = await client.getTools();

    if (mcpTools.length === 0) {
      throw new Error("No MCP tools found. Make sure the neo4j server is working correctly.");
    }

    console.log(
      `🛠️  Loaded ${mcpTools.length} MCP tools: ${mcpTools
        .map((tool) => tool.name)
        .join(", ")}`
    );

    // Create an OpenAI model with tools attached
    const systemMessage = `You are a helpful assistant that can answer questions and help with tasks using Neo4j database queries.`;

    const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
    console.log(`🤖 Using OpenAI model: ${modelName}`);

    const model = new ChatOpenAI({
      model: modelName,
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // Define the LLM node (simplified for API use)
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log(`💭 Calling LLM with ${state.messages.length} messages`);

      // Add system message if it's the first call
      let { messages } = state;
      if (messages.length === 1 && isHumanMessage(messages[0])) {
        messages = [new SystemMessage(systemMessage), ...messages];
      }

      // Use non-streaming for API responses (more reliable)
      console.log("🔄 Processing request...");
      const response = await model.invoke(messages);
      
      // Log tool calls if any were detected
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🔧 Tool calls detected: ${response.tool_calls.map(tc => tc.name).join(', ')}`);
      } else {
        console.log("💬 No tool calls in response");
      }
      
      return { messages: [response] };
    };

    // Create the workflow
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("llm", llmNode)
      .addNode("tools", toolNode)
      .addEdge(START, "llm")
      .addEdge("tools", "llm")
      .addConditionalEdges("llm", (state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        
        // Type guard for AIMessage with tool_calls
        if ('tool_calls' in lastMessage && Array.isArray((lastMessage as any).tool_calls) && (lastMessage as any).tool_calls.length > 0) {
          console.log("🔧 Tool calls detected, routing to tools node");
          const toolNames = (lastMessage as any).tool_calls
            .map((tc: any) => tc.name)
            .join(", ");
          console.log(`   → Tools being called: ${toolNames}`);
          return "tools";
        }

        console.log("✨ No tool calls, ending the workflow");
        return END;
      });

    // Compile the graph
    const app = workflow.compile();

    // Run the LangGraph agent with the user's prompt
    const result = await app.invoke(
      {
        messages: [new HumanMessage(userPrompt)],
      },
      {
        recursionLimit: 10,
      }
    );

    // Extract the final response
    const finalMessage = result.messages[result.messages.length - 1];
    const response = typeof finalMessage.content === 'string' 
      ? finalMessage.content 
      : Array.isArray(finalMessage.content) 
        ? finalMessage.content.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join(' ')
        : finalMessage.content 
          ? String(finalMessage.content)
          : "No response generated";

    console.log(`✅ Generated response for: "${userPrompt}"`);

    // Clean up
    await client.close();
    console.log("🔌 Closed MCP connections");

    return response;

  } catch (error) {
    console.error("❌ Error in chat example:", error);
    throw error;
  }
}

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
});

export default app; 