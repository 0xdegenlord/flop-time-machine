import type { ArchiveMessage } from "@/lib/archive/types";
import { formatUtcTimestamp } from "@/lib/format";

export function MessageCard({ message }: { message: ArchiveMessage }) {
  const messageId = `epoch-${message.epoch_number}-seq-${message.seq}`;

  return (
    <article className="message-card" id={messageId}>
      <div className="message-coordinate" aria-label="Archive coordinate">
        <span>E{message.epoch_number}</span>
        <span>#{message.seq}</span>
      </div>
      <div className="message-body">
        <header>
          <strong>{message.sender}</strong>
          <time dateTime={message.message_timestamp}>
            {formatUtcTimestamp(message.message_timestamp)}
          </time>
        </header>
        <p>{message.message_text}</p>
      </div>
    </article>
  );
}
