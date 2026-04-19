import React, { useState, useEffect } from 'react';

interface RippleButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  children: React.ReactNode;
}

export const RippleButton: React.FC<RippleButtonProps> = ({ children, className = '', onClick, ...props }) => {
  const [coords, setCoords] = useState({ x: -1, y: -1 });
  const [isRippling, setIsRippling] = useState(false);

  useEffect(() => {
    if (coords.x !== -1 && coords.y !== -1) {
      setIsRippling(true);
      const timer = setTimeout(() => setIsRippling(false), 300);
      return () => clearTimeout(timer);
    } else {
      setIsRippling(false);
    }
  }, [coords]);

  useEffect(() => {
    if (!isRippling) setCoords({ x: -1, y: -1 });
  }, [isRippling]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCoords({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    if (onClick) {
      onClick(event);
    }
  };

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
      {isRippling && (
        <span
          className="absolute rounded-full bg-white/40 animate-ripple pointer-events-none"
          style={{
            left: coords.x,
            top: coords.y,
            width: '40px',
            height: '40px',
          }}
        />
      )}
    </button>
  );
};
