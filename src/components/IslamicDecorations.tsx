import React from 'react';

export const IslamicDecorations: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none">
      {/* Top-Left Corner Geometric Banner */}
      <svg
        className="absolute top-0 left-0 w-32 h-32 md:w-44 md:h-44 text-[#064e3b]"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M0 0 L100 0 L0 100 Z" fill="currentColor" fillOpacity="0.95" />
        <path d="M0 0 L95 0 L0 95 Z" fill="#047857" fillOpacity="0.6" />
        <line x1="0" y1="98" x2="98" y2="0" stroke="#f59e0b" strokeWidth="2.5" />
        <line x1="0" y1="92" x2="92" y2="0" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 3" />
        {/* Subtle internal Islamic geometric lines */}
        <circle cx="20" cy="20" r="14" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.6" />
        <polygon
          points="20,10 27,15 30,22 25,29 18,30 11,25 10,18 15,11"
          stroke="#fbbf24"
          strokeWidth="0.8"
          strokeOpacity="0.7"
          fill="none"
        />
        <circle cx="20" cy="20" r="4" fill="#f59e0b" fillOpacity="0.8" />
      </svg>

      {/* Bottom-Left Corner Ornament */}
      <svg
        className="absolute bottom-0 left-0 w-36 h-36 md:w-52 md:h-52 text-[#064e3b]"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M0 100 L0 0 L100 100 Z" fill="currentColor" fillOpacity="0.95" />
        <path d="M0 100 L0 8 L92 100 Z" fill="#047857" fillOpacity="0.7" />
        <line x1="0" y1="2" x2="98" y2="100" stroke="#f59e0b" strokeWidth="2.5" />
        <line x1="0" y1="8" x2="92" y2="100" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 3" />
        {/* Geometric Islamic Star */}
        <g transform="translate(26, 74)">
          <path
            d="M0 -14 L4 -4 L14 -4 L6 2 L9 12 L0 6 L-9 12 L-6 2 L-14 -4 L-4 -4 Z"
            fill="#f59e0b"
            fillOpacity="0.85"
          />
          <circle cx="0" cy="0" r="16" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.6" />
          <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
        </g>
      </svg>

      {/* Bottom-Right Corner Ornament */}
      <svg
        className="absolute bottom-0 right-0 w-36 h-36 md:w-52 md:h-52 text-[#064e3b]"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M100 100 L100 0 L0 100 Z" fill="currentColor" fillOpacity="0.95" />
        <path d="M100 100 L100 8 L8 100 Z" fill="#047857" fillOpacity="0.7" />
        <line x1="100" y1="2" x2="2" y2="100" stroke="#f59e0b" strokeWidth="2.5" />
        <line x1="100" y1="8" x2="8" y2="100" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3 3" />
        {/* Geometric Islamic Star */}
        <g transform="translate(74, 74)">
          <path
            d="M0 -14 L4 -4 L14 -4 L6 2 L9 12 L0 6 L-9 12 L-6 2 L-14 -4 L-4 -4 Z"
            fill="#f59e0b"
            fillOpacity="0.85"
          />
          <circle cx="0" cy="0" r="16" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.6" />
          <circle cx="0" cy="0" r="22" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.4" strokeDasharray="2 2" />
        </g>
      </svg>
    </div>
  );
};
