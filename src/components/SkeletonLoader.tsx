import React from 'react';

interface SkeletonProps {
  type?: 'post' | 'notification' | 'group' | 'profile' | 'message';
  count?: number;
}

export function SkeletonLoader({ type = 'post', count = 1 }: SkeletonProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'notification':
        return (
          <div className="flex gap-4 p-4 border-b border-subtle">
            <div className="w-10 h-10 rounded-full bg-glass animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-glass rounded animate-pulse w-3/4" />
              <div className="h-3 bg-glass rounded animate-pulse w-1/4" />
            </div>
          </div>
        );
      case 'group':
        return (
          <div className="glass-card !p-0 overflow-hidden flex flex-col h-full border border-white/5">
            <div className="h-32 bg-glass animate-pulse" />
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="h-6 bg-glass rounded animate-pulse w-3/4" />
                <div className="h-4 bg-glass rounded animate-pulse w-1/2" />
              </div>
              <div className="h-10 bg-glass rounded-xl animate-pulse" />
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-8 pb-20">
            <div className="relative h-48 md:h-80 bg-glass animate-pulse" />
            <div className="px-4 md:px-8 -mt-20 relative z-10 space-y-4">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-slate-900 border-4 border-slate-950 animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 bg-glass rounded animate-pulse w-1/3" />
                <div className="h-4 bg-glass rounded animate-pulse w-1/4" />
              </div>
            </div>
          </div>
        );
      case 'message':
        return (
          <div className="flex gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-glass animate-pulse shrink-0" />
            <div className="max-w-[70%] space-y-2">
              <div className="h-4 bg-glass rounded animate-pulse w-full" />
              <div className="h-4 bg-glass rounded animate-pulse w-2/3" />
            </div>
          </div>
        );
      case 'post':
      default:
        return (
          <div className="glass-card !p-4 w-full h-full">
            {/* Header with Avatar */}
            <div className="flex gap-4">
              <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-glass animate-pulse shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-glass rounded animate-pulse w-1/3 mb-2" />
                <div className="h-3 bg-glass rounded animate-pulse w-1/4" />
              </div>
            </div>

            {/* Content Lines */}
            <div className="mt-4 space-y-2">
              <div className="h-3 bg-glass rounded animate-pulse w-full" />
              <div className="h-3 bg-glass rounded animate-pulse w-11/12" />
              <div className="h-3 bg-glass rounded animate-pulse w-4/5" />
            </div>

            {/* Media Placeholder */}
            <div className="mt-4 h-48 bg-glass rounded-2xl animate-pulse w-full" />

            {/* Action Buttons */}
            <div className="mt-4 flex justify-between max-w-sm">
              <div className="h-8 bg-glass rounded-full animate-pulse w-12" />
              <div className="h-8 bg-glass rounded-full animate-pulse w-12" />
              <div className="h-8 bg-glass rounded-full animate-pulse w-12" />
              <div className="h-8 bg-glass rounded-full animate-pulse w-12" />
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {renderSkeleton()}
        </React.Fragment>
      ))}
    </>
  );
}
