/**
 * useSessionManager Hook
 * Manages session CRUD operations and state
 */
import { useState, useCallback } from 'react';
import { message } from 'antd';
import { getSessions, getSessionDetail, deleteSession } from '@/services/chat';
import type { Session, SessionDetail, Message } from '../types/chat';

interface UseSessionManagerReturn {
  sessions: Session[];
  currentSessionId?: string;
  loading: boolean;
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string, setMessages: (messages: Message[]) => void) => Promise<void>;
  createNewSession: (setMessages: (messages: Message[]) => void) => void;
  deleteSessionById: (sessionId: string) => Promise<void>;
}

export const useSessionManager = (): UseSessionManagerReturn => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [loading, setLoading] = useState(false);

  // Load session list
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSessions(1, 20);
      setSessions(result.data || result);
    } catch (error: any) {
      console.error('Load sessions failed:', error);
      message.error('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // Switch to a session
  const switchSession = useCallback(
    async (sessionId: string, setMessages: (messages: Message[]) => void) => {
      setLoading(true);
      try {
        const detail: SessionDetail = await getSessionDetail(sessionId);

        // Convert backend messages to Vercel AI SDK format
        const messages: Message[] = detail.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: new Date(msg.createdAt),
          // Note: backend may not return toolInvocations in history
          // This is acceptable for now
        }));

        setMessages(messages);
        setCurrentSessionId(sessionId);
      } catch (error: any) {
        console.error('Switch session failed:', error);
        message.error('加载会话失败');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Create new session (clear current)
  const createNewSession = useCallback((setMessages: (messages: Message[]) => void) => {
    setMessages([]);
    setCurrentSessionId(undefined);
  }, []);

  // Delete a session
  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSession(sessionId);

        // Remove from sessions list
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        // If deleting current session, clear it
        if (sessionId === currentSessionId) {
          setCurrentSessionId(undefined);
        }

        message.success('会话已删除');
      } catch (error: any) {
        console.error('Delete session failed:', error);
        message.error('删除会话失败');
      }
    },
    [currentSessionId]
  );

  return {
    sessions,
    currentSessionId,
    loading,
    loadSessions,
    switchSession,
    createNewSession,
    deleteSessionById,
  };
};
