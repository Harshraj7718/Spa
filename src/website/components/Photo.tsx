import { useState, type ReactNode } from 'react';

/**
 * A photo inside a ".media" box. Until the file exists in public/assets/images,
 * the box shows a green placeholder with the file path it expects.
 */
export function Photo({ src, alt = '', className = '', label, children }: {
  src: string; alt?: string; className?: string; label?: string; children?: ReactNode;
}) {
  const [missing, setMissing] = useState(false);
  return (
    <div className={`media ${className} ${missing ? 'missing' : ''}`} data-ph={label ?? src.replace(/^\//, '')}>
      <img src={src} alt={alt} loading="lazy" onError={() => setMissing(true)} />
      {children}
    </div>
  );
}
