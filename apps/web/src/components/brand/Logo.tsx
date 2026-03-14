import React from 'react';
import logoFull from '../assets/logo.png';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', showText = true }) => {
  if (showText) {
    return (
      <img 
        src={logoFull} 
        alt="Evento" 
        className={`h-8 w-auto object-contain ${className}`} 
      />
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/* Fallback to a styled SVG E mark for the icon-only version */}
      <svg
        viewBox="0 0 100 100"
        className="h-8 w-8 text-primary fill-current"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="10" y="10" width="80" height="20" rx="2" />
        <rect x="10" y="40" width="60" height="20" rx="2" />
        <rect x="10" y="70" width="80" height="20" rx="2" />
        <rect x="10" y="10" width="20" height="80" rx="2" />
      </svg>
    </div>
  );
};
