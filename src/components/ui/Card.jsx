import React from 'react';

/**
 * Reusable Card container component.
 * Uses bg-surface, border, and rounded styling that adapt to dark mode automatically.
 *
 * @param {Object} props
 * @param {string} [props.className=''] - Additional custom CSS class names
 */
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-bg-surface border border-border/90 rounded-[22px] shadow-[0_5px_22px_rgba(38,59,128,0.045)] transition-all duration-300 ${
        props.onClick ? 'hover:shadow-[0_14px_34px_rgba(38,59,128,0.10)] hover:border-accent/25 cursor-pointer active:scale-[0.99]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
