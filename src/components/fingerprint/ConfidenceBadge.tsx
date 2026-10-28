import React from 'react';

interface ConfidenceBadgeProps {
  confidence: number;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence }) => {
  let color: string;
  if (confidence >= 80) color = 'text-green-400 bg-green-500/10';
  else if (confidence >= 50) color = 'text-yellow-400 bg-yellow-500/10';
  else color = 'text-orange-400 bg-orange-500/10';

  return (
    <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold ${color}`}>
      {confidence}%
    </span>
  );
};
