/**
 * Chat Page
 * Main chat page with session list and conversation area
 * useChat is managed here to support session switching
 * Now uses MessageItem components instead of Bubble.List
 */
import React, { useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { message } from "antd";
import SessionList from "./components/SessionList";
import MessageItem from "./components/MessageItem";
import ChatInput from "./components/ChatInput";
import { useSessionManager } from "./hooks/useSessionManager";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

const ChatPage: React.FC = () => {
  const token = localStorage.getItem("token") || "";

  // Session management
  const {
    sessions,
    currentSessionId,
    loading: sessionsLoading,
    loadSessions,
    switchSession,
    createNewSession,
    deleteSessionById,
  } = useSessionManager();

  // Use Vercel AI SDK's useChat hook with new API (v3+)
  const { messages, status, error, stop, setMessages, sendMessage } = useChat({
    id: "rag-chat",
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/v1/chat/stream`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: {
        sessionId: currentSessionId,
      },
    }),
    experimental_throttle: 40,
    onError: (err) => {
      console.error("Chat error:", err);
      message.error("发送失败，请重试");
    },
  });

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle session select
  const handleSelectSession = async (sessionId: string) => {
    await switchSession(sessionId, setMessages);
  };

  // Handle create new session
  const handleCreateSession = () => {
    createNewSession(setMessages);
  };

  // Handle delete session
  const handleDeleteSession = async (sessionId: string) => {
    await deleteSessionById(sessionId);
  };

  // Render messages using MessageItem components with stable keys
  const messageElements = useMemo(() =>
    messages.map((msg: UIMessage) => (
      <MessageItem
        key={msg.id}
        message={msg}
        isStreaming={status === "streaming" && messages[messages.length - 1]?.id === msg.id}
      />
    )),
    [messages, status]
  );

  // Display error
  useEffect(() => {
    if (error) {
      message.error(error.message || "发生错误");
    }
  }, [error]);

  // Input state
  const [input, setInput] = React.useState("");

  // Handle send
  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({
      text: input.trim(),
    });
    setInput("");
  };

  // Handle stop
  const handleStop = () => {
    stop();
  };

  console.log("Current messages:", messages);

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 64px)",
        backgroundColor: "#f5f5f5",
      }}
    >
      {/* Left: Session List */}
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={sessionsLoading}
        onSelect={handleSelectSession}
        onCreate={handleCreateSession}
        onDelete={handleDeleteSession}
      />

      {/* Right: Conversation Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #e0e0e0",
            fontWeight: 500,
          }}
        >
          对话
        </div>

        {/* Message List */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {messageElements}
        </div>

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={handleStop}
          loading={status === "streaming"}
        />
      </div>
    </div>
  );
};

export default ChatPage;
