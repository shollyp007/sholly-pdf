import { useState } from 'react';

interface Props {
  onActivated: () => void;
}

export default function LicenseGate({ onActivated }: Props) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleActivate() {
    if (!key.trim()) { setError('Please enter your license key.'); return; }
    setLoading(true);
    setError('');
    const result = await (window as any).electronAPI?.license.activate(key.trim());
    setLoading(false);
    if (result?.success) {
      onActivated();
    } else {
      setError(result?.error || 'Activation failed. Please try again.');
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg, #1c1c1e)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        width: 420, padding: '40px 36px', borderRadius: 16,
        background: 'var(--panel, #2c2c2e)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text, #f5f5f7)', letterSpacing: -0.3 }}>
            Sholly PDF
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted, #8e8e93)', marginTop: 6 }}>
            Your free trial has ended — purchase a license to keep going.
          </div>
        </div>

        {/* Purchase (new customers) */}
        <button
          onClick={() => (window as any).electronAPI?.license.openPurchase()}
          style={{
            padding: '12px 0', borderRadius: 10, border: 'none',
            background: '#0a84ff', color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          Purchase a license
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted, #8e8e93)', fontSize: 11.5 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border, rgba(255,255,255,0.12))' }} />
          ALREADY PURCHASED?
          <div style={{ flex: 1, height: 1, background: 'var(--border, rgba(255,255,255,0.12))' }} />
        </div>

        {/* Key input (existing customers) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            spellCheck={false}
            style={{
              padding: '11px 14px', borderRadius: 9,
              background: 'var(--bg, #1c1c1e)',
              border: `1px solid ${error ? '#ff453a' : 'var(--border, rgba(255,255,255,0.12))'}`,
              color: 'var(--text, #f5f5f7)', fontSize: 15,
              fontFamily: 'monospace', letterSpacing: 1,
              outline: 'none',
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: '#ff453a', paddingLeft: 2 }}>{error}</div>
          )}
        </div>

        {/* Activate button */}
        <button
          onClick={handleActivate}
          disabled={loading}
          style={{
            padding: '12px 0', borderRadius: 10,
            border: '1px solid var(--border, rgba(255,255,255,0.18))',
            background: loading ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: 'var(--text, #f5f5f7)', fontSize: 15, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Activating…' : 'Activate with key'}
        </button>
      </div>
    </div>
  );
}
