"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markMessagesRead, sendMessage } from "@/app/actions/messages";
import { APP_TIME_ZONE } from "@/lib/timezone";

type Message = {
  id: string;
  appointment_id?: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ChatThreadDictionary = {
  you: string;
  noMessagesYet: string;
  sendFailed: string;
  placeholder: string;
  send: string;
};

/**
 * `appointmentId` is where new messages are filed. A client inbox
 * conversation spans several bookings: `threadAppointmentIds` widens the
 * live subscription to all of them, `appointmentLabels` draws a divider when
 * the booking changes, and `markRead` keeps the read receipts current while
 * the thread is on screen.
 */
export function ChatThread({
  appointmentId,
  threadAppointmentIds,
  appointmentLabels,
  currentUserId,
  clientId,
  clientName,
  garageName,
  initialMessages,
  dictionary,
  timeLocale,
  markRead = false,
  initialUnread = 0,
  variant = "card",
}: {
  appointmentId: string;
  threadAppointmentIds?: string[];
  appointmentLabels?: Record<string, string>;
  currentUserId: string;
  clientId: string;
  clientName: string;
  garageName: string;
  initialMessages: Message[];
  dictionary: ChatThreadDictionary;
  timeLocale: string;
  markRead?: boolean;
  initialUnread?: number;
  variant?: "card" | "pane";
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const ids = threadAppointmentIds?.length ? threadAppointmentIds : [appointmentId];
  // Stable string so the subscription effect doesn't resubscribe on every
  // render (a new array arrives with each server refresh).
  const idsKey = [...ids].sort().join(",");

  useEffect(() => {
    if (markRead && initialUnread > 0) void markMessagesRead(idsKey.split(","));
  }, [markRead, initialUnread, idsKey]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    // Realtime needs the user's JWT explicitly pushed to the socket before
    // subscribing -- otherwise the connection can race ahead of session
    // hydration and authenticate as anonymous, so every RLS check on the
    // channel silently fails (no error, messages just never arrive).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }

      const threadIds = idsKey.split(",");
      channel = supabase
        .channel(`messages:${idsKey}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              threadIds.length === 1
                ? `appointment_id=eq.${threadIds[0]}`
                : `appointment_id=in.(${threadIds.join(",")})`,
          },
          (payload) => {
            const incoming = payload.new as Message;
            setMessages((prev) =>
              prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]
            );
            if (markRead && incoming.sender_id !== currentUserId) {
              void markMessagesRead(threadIds);
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [idsKey, markRead, currentUserId]);

  // Scroll the message list itself, not the page (scrollIntoView would
  // also scroll the window in the inbox's fixed-height pane).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function labelFor(senderId: string) {
    if (senderId === currentUserId) return dictionary.you;
    if (senderId === clientId) return clientName;
    return garageName;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setSendFailed(false);
    try {
      const result = await sendMessage(appointmentId, body);
      if (result.ok) {
        setDraft("");
      } else {
        setSendFailed(true);
      }
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  const isPane = variant === "pane";

  return (
    <div
      className={
        isPane
          ? "flex min-h-0 flex-1 flex-col"
          : "flex flex-1 flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
      }
    >
      <div
        ref={listRef}
        className={
          isPane
            ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6"
            : "flex max-h-[28rem] min-h-[16rem] flex-1 flex-col gap-3 overflow-y-auto"
        }
      >
        {messages.length > 0 ? (
          messages.map((message, index) => {
            const isSelf = message.sender_id === currentUserId;
            const previous = messages[index - 1];
            const divider =
              appointmentLabels && message.appointment_id && message.appointment_id !== previous?.appointment_id
                ? appointmentLabels[message.appointment_id]
                : undefined;
            return (
              <div key={message.id} className="flex flex-col gap-3">
                {divider && (
                  <div className="flex items-center gap-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <span aria-hidden className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    <span className="max-w-[70%] truncate">{divider}</span>
                    <span aria-hidden className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                )}
                <div className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    {labelFor(message.sender_id)} &middot;{" "}
                    {new Date(message.created_at).toLocaleString(timeLocale, {
                      timeZone: APP_TIME_ZONE,
                      ...(isPane ? { day: "numeric", month: "short" } : {}),
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <p
                    className={`mt-1 max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                      isSelf
                        ? isPane
                          ? "bg-brand-600 text-white dark:bg-brand-500"
                          : "bg-foreground text-background"
                        : "bg-black/[.04] text-black dark:bg-white/[.08] dark:text-zinc-50"
                    }`}
                  >
                    {message.body}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {dictionary.noMessagesYet}
          </p>
        )}
      </div>

      {sendFailed && (
        <p role="alert" className={`text-xs text-red-600 dark:text-red-400 ${isPane ? "shrink-0 px-4 pb-2 sm:px-6" : ""}`}>
          {dictionary.sendFailed}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className={
          isPane
            ? "flex shrink-0 items-center gap-2 border-t border-zinc-200/80 bg-zinc-50/80 p-3 sm:px-4 dark:border-zinc-800/60 dark:bg-zinc-900/40"
            : "flex gap-2"
        }
      >
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSendFailed(false);
          }}
          placeholder={dictionary.placeholder}
          aria-label={dictionary.placeholder}
          maxLength={2000}
          className={
            isPane
              ? "h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-zinc-50 dark:shadow-none"
              : "flex-1 rounded-md border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black"
          }
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className={
            isPane
              ? "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus-visible:ring-offset-zinc-950"
              : "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          }
        >
          {isPane && <SendHorizontal aria-hidden className="h-4 w-4" strokeWidth={2} />}
          {dictionary.send}
        </button>
      </form>
    </div>
  );
}
