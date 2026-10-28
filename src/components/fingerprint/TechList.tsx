import React from 'react';
import type { DetectionResult } from '../../core/types';
import { CategorySection } from './CategorySection';
import { EmptyState } from '../EmptyState';
import categories from '../../rules/categories.json';

interface TechListProps {
  result: DetectionResult | null;
}

export const TechList: React.FC<TechListProps> = ({ result }) => {
  if (!result || result.technologies.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        title="暂无检测结果"
        description="请刷新页面后重试，或等待页面加载完成后自动扫描"
      />
    );
  }

  // 按分类分组
  const grouped = new Map<number, typeof result.technologies>();
  for (const tech of result.technologies) {
    for (const catId of tech.categories) {
      if (!grouped.has(catId)) grouped.set(catId, []);
      grouped.get(catId)!.push(tech);
    }
  }

  // 按分类优先级排序
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const catA = (categories as any).categories?.[String(a[0])];
    const catB = (categories as any).categories?.[String(b[0])];
    return (catA?.priority || 99) - (catB?.priority || 99);
  });

  return (
    <div className="py-2">
      {result.securityHeaders.length > 0 && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {result.securityHeaders.filter(h => h.present).map((h) => (
              <span key={h.name}
                className="px-2 py-1 rounded text-[11px] bg-green-500/10 text-green-400 border border-green-500/20"
              >
                {h.name.split('-').pop()?.toUpperCase()}
              </span>
            ))}
            {result.securityHeaders.filter(h => !h.present).length > 0 && (
              <span className="text-[11px] text-gray-500">
                +{result.securityHeaders.filter(h => !h.present).length} 缺失
              </span>
            )}
          </div>
        </div>
      )}

      {sortedGroups.map(([catId, techs]) => {
        const cat = (categories as any).categories?.[String(catId)];
        return (
          <CategorySection
            key={catId}
            categoryName={cat?.nameZh || cat?.name || `分类${catId}`}
            categoryIcon={cat?.icon || 'package'}
            technologies={techs}
          />
        );
      })}
    </div>
  );
};
