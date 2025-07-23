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

    // Define the function that calls the model
    const llmNode = async (state: typeof MessagesAnnotation.State) => {
      console.log(`💭 Calling LLM with ${state.messages.length} messages`);

      // Add system message if it's the first call
      let { messages } = state;
      if (messages.length === 1 && isHumanMessage(messages[0])) {
        messages = [new SystemMessage(systemMessage), ...messages];
      }

      

      const response = await model.invoke(messages);
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
      // Run the LangGraph agent
      const result = await app.invoke({
        messages: [new HumanMessage("Show all the customers and their orders from neo4j database")],
      });

      // Display the final answer
      const finalMessage = result.messages[result.messages.length - 1];
      console.log(`   ✅ Result: ${finalMessage.content}`);

 
      // try {
      //   const listResult = await app.invoke({
      //     messages: [
      //       new HumanMessage(
      //         "List all files and directories in the current directory and show their structure."
      //       ),
      //     ],
      //   });
      //   const listMessage = listResult.messages[listResult.messages.length - 1];
      //   console.log(`   ${listMessage.content}`);
      // } catch (error) {
      //   console.error("❌ Error listing directory:", error);
      // }
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