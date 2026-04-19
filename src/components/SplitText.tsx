import React from 'react';

interface SplitTextProps {
  text: string;
  className?: string;
  hoverColor?: string;
}

export const SplitText: React.FC<SplitTextProps> = ({ 
  text, 
  className = "text-2xl font-black tracking-tight text-primary", 
  hoverColor = "text-indigo-500" 
}) => {
  if (!text) return null;

  return (
    <div className="group relative cursor-pointer inline-block">
      <span className={`relative block overflow-hidden py-1 ${className}`}>
        {/* Top layer */}
        <span className="block transition-transform duration-300 group-hover:-translate-y-full">
          {text}
        </span>
        {/* Bottom layer */}
        <span className={`absolute inset-0 block ${hoverColor} transition-transform duration-300 translate-y-full group-hover:translate-y-0 py-1 ${className}`}>
          {text}
        </span>
      </span>
    </div>
  );
};
