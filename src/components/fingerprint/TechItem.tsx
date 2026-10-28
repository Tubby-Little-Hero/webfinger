import React from 'react';
import type { DetectedTechnology } from '../../core/types';
import { ConfidenceBadge } from './ConfidenceBadge';

interface TechItemProps {
  tech: DetectedTechnology;
}

export const TechItem: React.FC<TechItemProps> = ({ tech }) => {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 hover:bg-[#1a1a2e] transition-colors group ${
      tech.inferred ? 'opacity-60' : ''
    }`}>
      <div className="flex-shrink-0 w-6 h-6 rounded bg-gray-800 flex items-center justify-center">
        {tech.icon ? (
          <span className="text-[11px]">{tech.icon}</span>
        ) : (
          <span className="text-[10px] text-gray-500 font-medium">
            {tech.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-gray-200 truncate font-medium">{tech.name}</span>
          {tech.version && (
            <span className="text-xs text-indigo-400 font-mono flex-shrink-0">
              {tech.version}
            </span>
          )}
          {tech.inferred && (
            <span className="text-[10px] text-gray-500 italic flex-shrink-0">推断</span>
          )}
        </div>
        {tech.description && (
          <p className="text-[11px] text-gray-500 truncate hidden group-hover:block">
            {tech.description}
          </p>
        )}
      </div>

      <ConfidenceBadge confidence={tech.confidence} />

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-gray-500">
          {tech.matchedMethods.join(', ')}
        </span>
      </div>
    </div>
  );
};
