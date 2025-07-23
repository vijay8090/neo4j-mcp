import { BaseMessage, HumanMessage, SystemMessage, isHumanMessage } from "@langchain/core/messages";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { API_CONFIG, SYSTEM_MESSAGES } from "../constants/index.js";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

const dbName = "vijay_demo";

  // Define the graph state
  const GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
    }),
  });


interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  timestamp: string;
}

interface ChatConfig {
  openaiApiKey: string;
  modelName?: string;
  mcpServerUrl?: string;
  temperature?: number;
  recursionLimit?: number;
}

export class ChatService {
  private static instance: ChatService | null = null;
  private mcpClient: MultiServerMCPClient | null = null;
  private workflow: any = null;
  private isInitialized = false;
  private config: ChatConfig;
  private initPromise: Promise<void> | null = null;

  private constructor(config: ChatConfig) {
    console.log('🏗️ ChatService constructor called');
    console.log('📝 Constructor config received:', {
      modelName: config.modelName,
      mcpServerUrl: config.mcpServerUrl,
      temperature: config.temperature,
      recursionLimit: config.recursionLimit,
      hasApiKey: !!config.openaiApiKey
    });

    this.config = {
      modelName: API_CONFIG.DEFAULT_MODEL,
      mcpServerUrl: API_CONFIG.DEFAULT_MCP_SERVER_URL,
      temperature: API_CONFIG.DEFAULT_TEMPERATURE,
      recursionLimit: API_CONFIG.DEFAULT_RECURSION_LIMIT,
      ...config
    };

    console.log('⚙️ Final ChatService config:', {
      modelName: this.config.modelName,
      mcpServerUrl: this.config.mcpServerUrl,
      temperature: this.config.temperature,
      recursionLimit: this.config.recursionLimit
    });
  }

  public static getInstance(config?: ChatConfig): ChatService {
    console.log('🔍 ChatService getInstance called');
    
    if (!ChatService.instance) {
      console.log('🆕 Creating new ChatService instance');
      if (!config) {
        console.error('❌ No config provided for new ChatService instance');
        throw new Error('ChatService must be initialized with config on first use');
      }
      ChatService.instance = new ChatService(config);
      console.log('✅ New ChatService instance created');
    } else {
      console.log('♻️ Returning existing ChatService instance');
    }
    
    return ChatService.instance;
  }

  public async initialize(client: MongoClient, thread_id: string): Promise<void> {
    console.log(`🚀 Initialize called with thread_id: ${thread_id}`);
    console.log(`📊 Current state - isInitialized: ${this.isInitialized}, hasInitPromise: ${!!this.initPromise}`);

    if (this.isInitialized) {
      console.log('✅ ChatService already initialized, skipping');
      return;
    }
    
    if (this.initPromise) {
      console.log('⏳ Initialization already in progress, waiting...');
      return this.initPromise;
    }

    console.log('🔄 Starting new initialization process');
    this.initPromise = this._initialize(client, thread_id);
    return this.initPromise;
  }

  private async _initialize(client: MongoClient, thread_id: string): Promise<void> {
    try {
      console.log("🔌 Starting ChatService initialization...");
      console.log(`📋 Initialization parameters:`);
      console.log(`   - Thread ID: ${thread_id}`);
      console.log(`   - Database: ${dbName}`);
      console.log(`   - MCP Server URL: ${this.config.mcpServerUrl}`);
      
      // Initialize MCP client
      console.log("🔗 Creating MCP client connection...");
      this.mcpClient = new MultiServerMCPClient({
        mcpServers: {
          "neo4j-docker": {
            "command": "npx",
            "args": ["-y", "mcp-remote@latest", this.config.mcpServerUrl!]
          },
        },
        useStandardContentBlocks: true,
      });
      console.log("✅ MCP client created successfully");

      console.log("🔗 Establishing connection to MCP server...");
      // Test the connection by getting tools
      console.log("🛠️ Fetching available tools from MCP server...");
      const mcpTools = await this.mcpClient.getTools();
      console.log(`📊 Tools fetch completed. Found ${mcpTools.length} tools`);

      if (mcpTools.length === 0) {
        console.error("❌ No MCP tools found");
        throw new Error("No MCP tools found. Make sure the neo4j server is working correctly.");
      }

      console.log("🔍 Available tools:");
      mcpTools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name} - ${tool.description || 'No description'}`);
      });

      console.log("✅ Connected to MCP server successfully");

      // Create OpenAI model with tools
      console.log("🤖 Initializing OpenAI model...");
      console.log(`📋 Model configuration:`);
      console.log(`   - Model: ${this.config.modelName}`);
      console.log(`   - Temperature: ${this.config.temperature}`);
      console.log(`   - Tools to bind: ${mcpTools.length}`);

      const model = new ChatOpenAI({
        apiKey: this.config.openaiApiKey,
        model: this.config.modelName!,
        temperature: this.config.temperature!,
      }).bindTools(mcpTools);
      console.log("✅ OpenAI model initialized and tools bound");

      // Create tool node
      console.log("🔧 Creating tool node...");
      const toolNode = new ToolNode(mcpTools);
      console.log("✅ Tool node created");

      // Create workflow
      console.log("📊 Creating workflow...");
      this.workflow = this.createWorkflow(model, toolNode, client, thread_id);
      console.log("✅ Workflow created successfully");

      this.isInitialized = true;
      console.log("🎉 ChatService initialization completed successfully");

    } catch (error) {
      console.error("💥 ChatService initialization failed:", error);
      this.initPromise = null;
      throw new Error(`ChatService initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createWorkflow(model: any, toolNode: ToolNode, client: MongoClient, thread_id: string) {
    console.log("🏗️ Creating workflow...");
    console.log(`📋 Workflow parameters:`);
    console.log(`   - Thread ID: ${thread_id}`);
    console.log(`   - Database: ${dbName}`);
    console.log(`   - Recursion Limit: ${this.config.recursionLimit}`);

    const systemMessage = SYSTEM_MESSAGES.NEO4J_ASSISTANT;
    console.log(`📝 System message length: ${systemMessage.length} characters`);

    const llmNode = async (state: typeof GraphState.State) => {
      console.log(`💭 LLM Node called`);
      console.log(`📊 State analysis:`);
      console.log(`   - Messages count: ${state.messages.length}`);
      console.log(`   - Message types: ${state.messages.map((m, i) => `${i+1}:${m.constructor.name}`).join(', ')}`);

      let { messages } = state;
      if (messages.length === 1 && isHumanMessage(messages[0])) {
        console.log("🔄 Adding system message to conversation");
        messages = [new SystemMessage(systemMessage), ...messages];
        console.log(`📈 Messages count after system message: ${messages.length}`);
      }

      console.log("🔄 Invoking model...");
      const startTime = Date.now();
      const response = await model.invoke(messages);
      const endTime = Date.now();
      console.log(`⚡ Model response received in ${endTime - startTime}ms`);
      
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🔧 Tool calls detected: ${response.tool_calls.length} calls`);
        response.tool_calls.forEach((tc: any, index: number) => {
          console.log(`   ${index + 1}. ${tc.name}(${Object.keys(tc.args || {}).join(', ')})`);
        });
      } else {
        console.log("💬 No tool calls in response");
        console.log(`📝 Response content preview: ${String(response.content).substring(0, 100)}...`);
      }

      console.log("🔍 Response:", response);
      
      return { messages: [response] };
    };

    console.log("🔗 Building state graph...");
    const workflow = new StateGraph(GraphState)
      .addNode("llm", llmNode)
      .addNode("tools", toolNode)
      .addEdge(START, "llm")
      .addEdge("tools", "llm")
      .addConditionalEdges("llm", (state) => {
        console.log("🤔 Conditional edge evaluation");
        const lastMessage = state.messages[state.messages.length - 1];
        console.log(`📝 Last message type: ${lastMessage.constructor.name}`);
        
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

      console.log("💾 Setting up MongoDB checkpointer...");
      const checkpointer = new MongoDBSaver({ client, dbName: "vijay_demo" });
      console.log("✅ MongoDB checkpointer configured");

      console.log("🔧 Compiling workflow...");
      const compiledWorkflow = workflow.compile({
        checkpointer
      });
      console.log("✅ Workflow compiled successfully");

      return compiledWorkflow;
  }

  public async processChat(prompt: string, client: MongoClient, thread_id: string): Promise<ChatResponse> {
    const timestamp = new Date().toISOString();
    console.log(`\n🎯 Processing chat request`);
    console.log(`📋 Request details:`);
    console.log(`   - Prompt: "${prompt}"`);
    console.log(`   - Thread ID: ${thread_id}`);
    console.log(`   - Timestamp: ${timestamp}`);
    
    try {
      // Ensure service is initialized
      console.log("🔍 Checking initialization status...");
      await this.initialize(client, thread_id);
      console.log("✅ Service initialization confirmed");

      if (!this.workflow) {
        console.error("❌ Workflow not available after initialization");
        throw new Error('Workflow not initialized');
      }

      console.log(`🚀 Executing workflow...`);
      console.log(`⚙️ Workflow parameters:`);
      console.log(`   - Recursion Limit: ${this.config.recursionLimit}`);
      console.log(`   - Thread ID: ${thread_id}`);

      const startTime = Date.now();
      
      // Run the workflow
      const result = await this.workflow.invoke(
        {
          messages: [new HumanMessage(prompt)],
        },
        {
          recursionLimit: this.config.recursionLimit,
          configurable: { thread_id: thread_id }
        }
      );

      const endTime = Date.now();
      console.log(`⚡ Workflow execution completed in ${endTime - startTime}ms`);

      console.log(`📊 Workflow result analysis:`);
      console.log(`   - Total messages: ${result.messages.length}`);
      console.log(`   - Message types: ${result.messages.map((m: any, i: number) => `${i+1}:${m.constructor.name}`).join(', ')}`);

      // Extract the final response
      console.log("🔍 Extracting final response...");
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`📝 Final message type: ${finalMessage.constructor.name}`);
      
      const response = this.extractMessageContent(finalMessage);
      console.log(`📏 Extracted response length: ${response.length} characters`);
      console.log(`📄 Response preview: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}`);

      console.log(`✅ Chat processing completed successfully`);

      return {
        success: true,
        response,
        timestamp
      };

    } catch (error) {
      console.error("💥 Error during chat processing:", error);
      console.error(`❌ Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`❌ Error message: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp
      };
    }
  }

  private extractMessageContent(message: any): string {
    console.log("🔍 Extracting message content...");
    console.log(`📝 Message content type: ${typeof message.content}`);
    
    if (typeof message.content === 'string') {
      console.log("✅ Content is string, returning directly");
      return message.content;
    }
    
    if (Array.isArray(message.content)) {
      console.log(`📊 Content is array with ${message.content.length} items`);
      const extracted = message.content
        .map((c: any) => typeof c === 'string' ? c : JSON.stringify(c))
        .join(' ');
      console.log("✅ Array content concatenated");
      return extracted;
    }
    
    if (message.content) {
      console.log("🔄 Converting content to string");
      return String(message.content);
    }
    
    console.log("⚠️ No content found, returning default message");
    return "No response generated";
  }

  public async cleanup(): Promise<void> {
    console.log("🧹 Starting ChatService cleanup...");
    
    if (this.mcpClient) {
      console.log("🔌 Closing MCP client connections...");
      await this.mcpClient.close();
      console.log("✅ MCP connections closed");
    } else {
      console.log("ℹ️ No MCP client to close");
    }
    
    console.log("🔄 Resetting internal state...");
    this.isInitialized = false;
    this.workflow = null;
    this.mcpClient = null;
    this.initPromise = null;
    console.log("✅ Internal state reset");
    
    console.log("🎉 ChatService cleanup completed");
  }

  public static async destroyInstance(): Promise<void> {
    console.log("💥 Destroying ChatService instance...");
    
    if (ChatService.instance) {
      console.log("🧹 Cleaning up existing instance...");
      await ChatService.instance.cleanup();
      ChatService.instance = null;
      console.log("✅ ChatService instance destroyed");
    } else {
      console.log("ℹ️ No ChatService instance to destroy");
    }
  }
} 