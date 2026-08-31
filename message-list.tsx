import type { ArchiveMessage } from "@/lib/archive/types";

import { MessageCard } from "./message-card";

export function MessageList({ messages }: { messages: ArchiveMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">00:00:00</span>
        <h2>No signal in this interval</h2>
        <p>Try a broader date range, another epoch, or fewer search terms.</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageCard
          key={`${message.epoch_number}:${message.seq}`}
          message={message}
        />
      ))}
    </div>
  );
}
