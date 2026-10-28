import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '🔍',
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <span className="text-3xl mb-3">{icon}</span>
      <h3 className="text-sm font-medium text-gray-300 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 text-center max-w-[280px] mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-1.5 rounded-md bg-indigo-500/20 text-indigo-400 text-xs font-medium
                     hover:bg-indigo-500/30 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
