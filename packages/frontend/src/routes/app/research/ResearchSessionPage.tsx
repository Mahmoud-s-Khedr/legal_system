import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Send, BookOpen, AlertCircle } from "lucide-react";
import { apiFetch, resolveApiUrl } from "../../../lib/api";

interface Source {
  id: string;
  document: { id: string; title: string; type: string };
  article: { id: string; number: string | null; title: string | null } | null;
}

interface Message {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  sources: Source[];
}

interface Session {
  id: string;
  title: string | null;
  caseId: string | null;
  messages: Message[];
}

interface UsageData {
  allowed: boolean;
  used: number;
  limit: number;
}

export function ResearchSessionPage() {
  const { t } = useTranslation("app");
  const { sessionId } = useParams({ from: "/app/research/$sessionId" });
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionQuery = useQuery({
    queryKey: ["research-session", sessionId],
    queryFn: () => apiFetch<Session>(`/api/research/sessions/${sessionId}`),
    staleTime: 0
  });

  const usageQuery = useQuery({
    queryKey: ["research-usage"],
    queryFn: () => apiFetch<UsageData>("/api/research/usage")
  });

  // Sync messages from query into local state
  useEffect(() => {
    if (sessionQuery.data?.messages) {
      setMessages(sessionQuery.data.messages);
    }
  }, [sessionQuery.data]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  async function handleSend() {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput("");
    setStreamingContent("");
    setStreamError(null);
    setIsStreaming(true);

    // Optimistically add user message to UI
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
      sources: []
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const url = resolveApiUrl(`/api/research/sessions/${sessionId}/messages`);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content })
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as { token?: string; error?: string };
            if (parsed.error) {
              setStreamError(parsed.error === "USAGE_LIMIT_EXCEEDED" ? t("research.limitExceeded") : parsed.error);
            } else if (parsed.token) {
              accumulated += parsed.token;
              setStreamingContent(accumulated);
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }

      // Re-fetch session to get persisted messages with sources
      await sessionQuery.refetch();
      await usageQuery.refetch();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }

  const session = sessionQuery.data;

  if (sessionQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p>;
  }
  if (!session) {
    return <p className="p-6 text-sm text-red-600">{t("errors.notFound")}</p>;
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          aria-label={t("actions.back")}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold transition hover:border-accent"
          to="/app/research"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("actions.back")}
        </Link>
        <h1 className="flex-1 font-heading text-xl">
          {session.title ?? t("research.untitledSession")}
        </h1>
        {usageQuery.data && usageQuery.data.limit > 0 && (
          <span className="text-xs text-slate-400">
            {usageQuery.data.used} / {usageQuery.data.limit} {t("research.messagesUsed")}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        {!messages.length && !isStreaming && (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
            <div>
              <p className="text-base font-semibold text-slate-600">{t("research.emptyTitle")}</p>
              <p className="mt-1">{t("research.emptyHelp")}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} t={t} />
        ))}

        {/* Streaming assistant response */}
        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-white border border-slate-200 px-4 py-3 text-sm">
              <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
              <span className="mt-1 inline-block h-4 w-0.5 animate-pulse bg-accent" aria-hidden="true" />
            </div>
          </div>
        )}

        {streamError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            {streamError}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <textarea
          className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-accent"
          disabled={isStreaming || usageQuery.data?.allowed === false}
          placeholder={
            usageQuery.data?.allowed === false
              ? t("research.limitExceeded")
              : t("research.inputPlaceholder")
          }
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          aria-label={t("actions.send")}
          className="self-end rounded-2xl bg-accent px-4 py-3 text-white disabled:opacity-40"
          disabled={!input.trim() || isStreaming || usageQuery.data?.allowed === false}
          onClick={() => void handleSend()}
        >
          <Send aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  t
}: {
  msg: Message;
  t: (key: string) => string;
}) {
  const isUser = msg.role === "USER";
  const [showSources, setShowSources] = useState(false);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-accent text-white"
              : "rounded-tl-sm border border-slate-200 bg-white"
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>

        {/* Citation chips */}
        {msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.sources.map((src) => {
              const label = src.article?.number
                ? `${src.document.title} § ${src.article.number}`
                : src.document.title;
              return (
                <button
                  className="flex items-center gap-1 rounded-full border border-accent/30 bg-accentSoft px-2 py-0.5 text-xs text-accent"
                  key={src.id}
                  onClick={() => setShowSources((v) => !v)}
                  title={label}
                >
                  <BookOpen aria-hidden="true" className="size-3" />
                  <span className="max-w-[150px] truncate">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Source panel */}
        {showSources && msg.sources.length > 0 && (
          <div className="w-full space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t("research.sources")}</p>
            {msg.sources.map((src) => (
              <div className="rounded-xl border border-slate-200 bg-white p-3" key={src.id}>
                <Link
                  className="text-sm font-semibold hover:text-accent"
                  params={{ documentId: src.document.id }}
                  to="/app/library/documents/$documentId"
                >
                  {src.document.title}
                </Link>
                {src.article && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t("library.article")} {src.article.number}
                    {src.article.title ? ` — ${src.article.title}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
