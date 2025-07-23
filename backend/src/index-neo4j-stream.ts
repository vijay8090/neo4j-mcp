/**
 * Filesystem MCP Server with LangGraph Example
 *
 * This example demonstrates how to use the Filesystem MCP server with LangGraph
 * to create a structured workflow for complex file operations.
 *
 * To run this file independently:
 * 1. Make sure you have an OpenAI API key set as OPENAI_API_KEY environment variable
 * 2. Run: npx tsx src/index-langgraph.ts
 *
 * The graph-based approach allows:
 * 1. Clear separation of responsibilities (reasoning vs execution)
 * 2. Conditional routing based on file operation types
 * 3. Structured handling of complex multi-file operations
 */

/* eslint-disable no-console */
import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  END,
  START,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  isHumanMessage,
} from "@langchain/core/messages";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// MCP client imports
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

// Load environment variables from .env file
dotenv.config();



/**
 * Validate environment variables and provide helpful error messages
 */
function validateEnvironment(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY environment variable is required");
    console.error("Please set your OpenAI API key:");
    console.error("  export OPENAI_API_KEY=your_api_key_here");
    console.error("Or create a .env file with:");
    console.error("  OPENAI_API_KEY=your_api_key_here");
    process.exit(1);
  }
}



/**
 * Example demonstrating how to use MCP filesystem tools with LangGraph agent flows
 * This example focuses on file operations like reading multiple files and writing files
 */
export async function runExample(client?: MultiServerMCPClient): Promise<void> {
  try {
    console.log("🚀 Initializing MCP LangGraph Example...");
    
    // Validate environment
    validateEnvironment();
    


    console.log("🔌 Initializing MCP client...");

    // Create a client with configurations for the filesystem server
    // eslint-disable-next-line no-param-reassign
    client =
      client ??
      new MultiServerMCPClient({
        mcpServers: {
          "neo4j-docker": {
            "command": "npx",
            "args": ["-y", "mcp-remote@latest", "http://localhost:8000/api/mcp/"]
          },
        },
        useStandardContentBlocks: true,
      });

    console.log("✅ Connected to MCP server");

    // Get all tools (flattened array is the default now)
    const mcpTools = await client.getTools();

    if (mcpTools.length === 0) {
      throw new Error("No MCP tools found. Make sure the filesystem server is working correctly.");
    }

    console.log(
      `🛠️  Loaded ${mcpTools.length} MCP tools: ${mcpTools
        .map((tool) => tool.name)
        .join(", ")}`
    );

    // Create an OpenAI model with tools attached
    const systemMessage = `You are a helpful assistant that can answer questions and help with tasks.`;

    const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o-mini";
    console.log(`🤖 Using OpenAI model: ${modelName}`);

    const model = new ChatOpenAI({
      model: modelName,
      temperature: 0,
    }).bindTools(mcpTools);

    // Create a tool node for the LangGraph
    const toolNode = new ToolNode(mcpTools);

    // ================================================
    // Create a LangGraph agent flow
    // ================================================
    console.log("\n🔄 Creating LangGraph agent flow...");

    // Define the function that calls the model with streaming
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log(`💭 Calling LLM with ${state.messages.length} messages`);

      // Add system message if it's the first call
      let { messages } = state;
      if (messages.length === 1 && isHumanMessage(messages[0])) {
        messages = [new SystemMessage(systemMessage), ...messages];
      }

      // For better debugging, let's not use streaming when we have many messages (likely in a tool call loop)
      if (messages.length > 5) {
        console.log("🔄 Using non-streaming response (tool call context)...");
        const response = await model.invoke(messages);
        
        // Log tool calls if any were detected
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.log(`🔧 Tool calls detected: ${response.tool_calls.map(tc => tc.name).join(', ')}`);
        } else {
          console.log("💬 No tool calls in response");
          if (response.content) {
            console.log(`📝 Response content: ${response.content.slice(0, 100)}...`);
          }
        }
        
        return { messages: [response] };
      }

      console.log("🔄 Streaming response...");
      
      // Use streaming to get real-time response
      const stream = await model.stream(messages);
      
      let fullContent = "";
      let toolCalls: any[] = [];
      let currentMessage: AIMessage | null = null;
      let hasStreamedContent = false;
      
      // Process each chunk in the stream
      for await (const chunk of stream) {
        // Update current message to the latest chunk
        currentMessage = chunk as AIMessage;
        
        // Stream content if available
        if (chunk.content && typeof chunk.content === 'string' && chunk.content.trim()) {
          process.stdout.write(chunk.content);
          fullContent += chunk.content;
          hasStreamedContent = true;
        }
        
        // Capture tool calls when they appear (usually in the final chunks)
        if (currentMessage.tool_calls && currentMessage.tool_calls.length > 0) {
          toolCalls = currentMessage.tool_calls;
        }
      }
      
      if (hasStreamedContent) {
        console.log("\n"); // Add newline after streaming content
      }
      
      // Create the final response with accumulated content and tool calls
      const response = new AIMessage({
        content: fullContent || currentMessage?.content || "",
        tool_calls: toolCalls,
        // Preserve other properties if needed
        id: currentMessage?.id,
        name: currentMessage?.name,
        additional_kwargs: currentMessage?.additional_kwargs || {}
      });
      
      // Log tool calls if any were detected
      if (toolCalls.length > 0) {
        console.log(`🔧 Tool calls detected: ${toolCalls.map(tc => tc.name).join(', ')}`);
      } else {
        console.log("💬 No tool calls in response");
        if (response.content) {
          console.log(`📝 Response content: ${response.content.slice(0, 100)}...`);
        }
      }
      
      return { messages: [response] };
    };

    // Create a new graph with MessagesAnnotation
    const workflow = new StateGraph(MessagesAnnotation)

      // Add the nodes to the graph
      .addNode("llm", llmNode)
      .addNode("tools", toolNode)

      // Add edges - these define how nodes are connected
      .addEdge(START, "llm")
      .addEdge("tools", "llm")

      // Conditional routing to end or continue the tool loop
      .addConditionalEdges("llm", (state) => {
        const lastMessage = state.messages[state.messages.length - 1];

        // Cast to AIMessage to access tool_calls property
        const aiMessage = lastMessage as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          console.log("🔧 Tool calls detected, routing to tools node");

          // Log what tools are being called
          const toolNames = aiMessage.tool_calls
            .map((tc) => tc.name)
            .join(", ");
          console.log(`   → Tools being called: ${toolNames}`);

          return "tools";
        }

        // If there are no tool calls, we're done
        console.log("✨ No tool calls, ending the workflow");
        return END;
      });

    // Compile the graph
    const app = workflow.compile();


    // Run the examples
    console.log("\n🎯 Running LangGraph agent examples...");

    try {
      // Run the LangGraph agent with recursion limit
      const result = await app.invoke(
        {
          messages: [new HumanMessage("Show all the customers from neo4j database")],
        },
        {
          recursionLimit: 10,
        }
      );

      // Display the final answer
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`   ✅ Result: ${finalMessage.content}`);

    } catch (error) {
      console.error(`❌ Error in example:`, error);
      // Continue with next example
    }


    console.log("\n🎉 All examples completed successfully!");

  } catch (error) {
    console.error("❌ Error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        console.error("\n💡 Tip: Make sure your OpenAI API key is set correctly");
      } else if (error.message.includes("server")) {
        console.error("\n💡 Tip: Make sure the MCP neo4j server can be installed");
      }
    }
    
    throw error; // Re-throw to exit with error code
  } finally {
    if (client) {
      await client.close();
      console.log("🔌 Closed all MCP connections");
    }
  }
}

/**
 * Main function to run when this file is executed directly
 */
async function main(): Promise<void> {
  try {
    console.log("🎬 Starting Neo4j MCP LangGraph Example");

    
    await runExample();
    
    console.log("\n✨ Example completed successfully!");
  } catch (error) {
    console.error("\n💥 Example failed:", error);
    process.exit(1);
  }
}

  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });

