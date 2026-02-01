import React from 'react';

export const MarkdownText: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split text by bold markers (**text**)
  // This regex captures the delimiter so we can identify bold parts
  const parts = content.split(/(\*\*.*?\*\*)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return <strong key={index} className="font-black">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};