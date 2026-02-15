import React from 'react';

/**
 * Material Symbols Icon Component
 *
 * Uses Google Material Symbols instead of emojis for professional appearance
 *
 * @param {string} name - Icon name from Material Symbols
 * @param {string} className - Additional CSS classes
 * @param {string} style - Inline styles
 */
function Icon({ name, className = '', style = {}, filled = false }) {
  const baseClass = filled ? 'material-symbols-filled' : 'material-symbols-outlined';

  return (
    <span
      className={`${baseClass} ${className}`}
      style={style}
    >
      {name}
    </span>
  );
}

export default Icon;
