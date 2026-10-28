import React, { useState } from 'react';
import type { DetectedTechnology } from '../../core/types';
import { TechItem } from './TechItem';

interface CategorySectionProps {
  categoryName: string;
  categoryIcon: string;
  technologies: DetectedTechnology[];
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  categoryName,
  technologies,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const unique = technologies.filter(
    (t, i, arr) => arr.findIndex((x) => x.name === t.name) === i
  );

  const sorted = [...unique].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#1a1a2e] transition-colors"
      >
        <span className={`text-[11px] text-gray-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}>
          ▶
        </span>
        <span className="text-[13px] font-semibold text-gray-300">
          {categoryName}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {sorted.length}
        </span>
      </button>

      {!collapsed && (
        <div>
          {sorted.map((tech) => (
            <TechItem key={tech.name} tech={tech} />
          ))}
        </div>
      )}
    </div>
  );
};
