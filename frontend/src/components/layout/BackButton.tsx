import { useStore } from '@/store';
import { HiArrowLeft } from 'react-icons/hi';

interface BackButtonProps {
  fallback?: string;
  label?: string;
}

/**
 * Renders a "← Back" bar at the bottom of any page.
 * Uses page history from the store to navigate back.
 */
export default function BackButton({ fallback = 'collection', label = 'Back' }: BackButtonProps) {
  const { goBack } = useStore();

  return (
    <div
      style={{
        marginTop: 48,
        paddingTop: 20,
        borderTop: '1px solid var(--hairline)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <button
        className="button ghost compact"
        onClick={() => goBack(fallback)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--muted)',
          fontSize: 14,
          padding: '6px 10px',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
      >
        <HiArrowLeft size={14} /> {label}
      </button>
    </div>
  );
}
