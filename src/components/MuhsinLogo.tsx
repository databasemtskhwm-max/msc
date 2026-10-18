import React from 'react';

interface MuhsinLogoProps {
  className?: string;
  size?: number | string;
}

export const MuhsinLogo: React.FC<MuhsinLogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <img
      src="/logo-muhsin.jpg"
      alt="Logo Resmi MTs KH. A. Wahab Muhsin Sukahideng Tasikmalaya"
      className={`rounded-full object-cover shrink-0 shadow-md ${className}`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
};
