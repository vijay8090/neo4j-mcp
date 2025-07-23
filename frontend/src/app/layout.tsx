import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Chat Assistant",
  description: "Chat interface for MCP with Neo4j and OpenAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}
