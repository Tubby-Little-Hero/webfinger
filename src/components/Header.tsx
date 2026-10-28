import React from 'react';

interface HeaderProps {
  hostname: string;
  url: string;
  loading: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ hostname, url, loading, onRefresh }) => {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#14141f] border-b border-[#1e1e2e]">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
        {loading ? (
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="text-base">🔒</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-gray-100 truncate">
          {hostname || 'WebFinger'}
        </h1>
        {url && (
          <p className="text-xs text-gray-500 truncate">{url}</p>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex-shrink-0 p-2 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
        title="刷新分析"
      >
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
};
