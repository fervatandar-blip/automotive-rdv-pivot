"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/app/actions/messages";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function ChatThread({
  appointmentId,
  currentUserId,
  clientId,
  clientName,
  garageName,
  initialMessages,
}: {
  appointmentId: string;
  currentUserId: string;
  clientId: string;
  clientName: string;
  garageName: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function labelFor(senderId: string) {
    if (senderId === currentUserId) return "You";
    if (senderId === clientId) return clientName;
    return garageName;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setDraft("");
    try {
      await sendMessage(appointmentId, body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="flex max-h-[28rem] min-h-[16rem] flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length > 0 ? (
          messages.map((message) => {
            const isSelf = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
              >
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  {labelFor(message.sender_id)} &middot;{" "}
                  {new Date(message.created_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <p
                  className={`mt-1 max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                    isSelf
                      ? "bg-foreground text-background"
                      : "bg-black/[.04] text-black dark:bg-white/[.08] dark:text-zinc-50"
                  }`}
                >
                  {message.body}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No messages yet. Say hello.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message..."
          maxLength={2000}
          className="flex-1 rounded-md border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Send
        </button>
      </form>
    </div>
  );
}
