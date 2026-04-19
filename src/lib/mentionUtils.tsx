import React from 'react';

export const renderTextWithMentions = (text: string, onMentionClick?: (handle: string) => void, keyPrefix: string = "") => {
  if (!text) return null;

  // Regex to find @handle
  const mentionRegex = /@(\w+)/g;
  const parts = text.split(mentionRegex);
  const mentions = text.match(mentionRegex);

  if (!mentions) return text;

  const result: (string | React.ReactNode)[] = [];
  let mentionIdx = 0;

  for (let i = 0; i < parts.length; i++) {
    result.push(parts[i]);
    if (mentionIdx < mentions.length) {
      const handle = mentions[mentionIdx];
      result.push(
        <span
          key={`${keyPrefix}-${handle}-${mentionIdx}`}
          onClick={(e) => {
            if (onMentionClick) {
              e.stopPropagation();
              onMentionClick(handle.substring(1));
            }
          }}
          className="text-indigo-400 font-bold hover:underline cursor-pointer"
        >
          {handle}
        </span>
      );
      mentionIdx++;
    }
  }

  return <>{result}</>;
};
