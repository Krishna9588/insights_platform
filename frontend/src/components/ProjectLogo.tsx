import { useState } from 'react';

export function ProjectLogo({ name, domain, size = 32 }: { name: string; domain?: string; size?: number }) {
  const [error, setError] = useState(false);
  const firstLetter = name ? name.charAt(0).toUpperCase() : '?';
  
  let cleanDomain = name + '.com';
  if (domain && typeof domain === 'string') {
    try {
      cleanDomain = new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname;
    } catch(e) {
      cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    }
  }
  
  const url = `https://img.logo.dev/${cleanDomain}?token=pk_Tw38O-4_RNinmXOwNIgagQ&size=64`;

  if (name && name.startsWith('Monitor:')) {
    return (
      <div style={{ 
        width: size, height: size, borderRadius: Math.max(6, size/4), 
        background: 'var(--accent-green)', color: '#fff', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontWeight: 700, fontSize: Math.max(14, size/2)
      }}>
        📡
      </div>
    );
  }

  if (error || !name) {
    return (
      <div style={{ 
        width: size, height: size, borderRadius: Math.max(6, size/4), 
        background: 'var(--accent-blue)', color: '#fff', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontWeight: 700, fontSize: Math.max(14, size/2)
      }}>
        {firstLetter}
      </div>
    );
  }

  return (
    <img 
      src={url} 
      alt={name} 
      style={{ width: size, height: size, borderRadius: Math.max(6, size/4), objectFit: 'contain', background: '#fff' }} 
      onError={() => setError(true)}
    />
  );
}
