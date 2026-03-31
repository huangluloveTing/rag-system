/**
 * ToolInvocationPart Component
 * Renders tool invocation with full details
 * Uses RAGToolDisplay for retrieval tools, generic display for others
 */
import React from "react";
import { Card } from "antd";
import ToolCallSummary from "../tools/ToolCallSummary";
import ToolArguments from "../tools/ToolArguments";
import ToolResult from "../tools/ToolResult";
import ToolError from "../tools/ToolError";
import RAGToolDisplay from "../tools/RAGToolDisplay";
import type { Tool, UITool, UIToolInvocation } from "ai";

interface ToolInvocationPartProps {
  toolInvocation: UIToolInvocation<UITool | Tool>;
  isStreaming: boolean;
}

const ToolInvocationPart: React.FC<ToolInvocationPartProps> = ({
  toolInvocation,
  isStreaming,
}) => {
  const { title, toolCallId, state, type } = toolInvocation;

  const callId = toolCallId || "unknown-call-id";
  const hasError = state === "output-error";

  const toolName = type.replace("tool-", "") || "unknown-tool";

  const renderContent = () => {
    switch (state) {
      case "input-streaming":
        return <div key={callId}>Preparing {toolName} request...</div>;
      case "input-available":
        return <div key={callId}>TOOL: {toolName}...</div>;
      case "output-available":
        return <div key={callId}>Result: {JSON.stringify(toolInvocation.output)}</div>;
      case "output-error":
        return (
          <div key={callId}>
            Error getting {toolName}: {toolInvocation.errorText}
          </div>
        );
    }
  };

  return (
    <Card
      size="small"
      style={{
        backgroundColor: hasError ? "#fff2f0" : "#fffbe6",
        border: hasError ? "1px solid #ffccc7" : "1px solid #ffe58f",
        borderRadius: "8px",
        marginBottom: "12px",
      }}
      styles={{ body: { padding: "12px" } }}
    >
      {renderContent()}
    </Card>
  );
};

export default ToolInvocationPart;
