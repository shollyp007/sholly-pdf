import { useEffect, useState } from 'react';

type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error';

interface UpdateInfo { version?: string; releaseNotes?: string }

export default function UpdateDialog() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState<UpdateInfo>({});
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const eAPI = () => (window as any).electronAPI;

  useEffect(() => {
    const api = eAPI();
    if (!api?.updater) return; // web build — no updater

    api.updater.onAvailable((i: UpdateInfo) => { setInfo(i); setPhase('available'); });
    api.updater.onNotAvailable(() => { setPhase('up-to-date'); setTimeout(() => setPhase('idle'), 3000); });
    api.updater.onError((msg: string) => { setErrorMsg(msg); setPhase('error'); });
    api.updater.onProgress((pct: number) => { setProgress(pct); setPhase('downloading'); });
    api.updater.onDownloaded((i: UpdateInfo) => { setInfo(i); setPhase('ready'); });
    api.onMenuCheckUpdates?.(() => { setPhase('checking'); });
  }, []);

  if (phase === 'idle') return null;

  const dismiss = () => setPhase('idle');

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--bg-panel, #2a2a2a)', color: 'var(--text, #e0e0e0)',
      border: '1px solid var(--border, #444)', borderRadius: 10,
      padding: '16px 20px', minWidth: 300, maxWidth: 380,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {phase === 'checking' && (
        <Row icon="🔍" text="Checking for updates…" />
      )}

      {phase === 'up-to-date' && (
        <Row icon="✅" text="You're on the latest version." onDismiss={dismiss} />
      )}

      {phase === 'available' && (
        <>
          <Row icon="🆕" text={`Version ${info.version ?? ''} is available!`} onDismiss={dismiss} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => { eAPI().updater.download(); setPhase('downloading'); }} primary>
              Download
            </Btn>
            <Btn onClick={dismiss}>Later</Btn>
          </div>
        </>
      )}

      {phase === 'downloading' && (
        <>
          <Row icon="⬇️" text={`Downloading… ${progress}%`} />
          <div style={{ height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#4f7bff', transition: 'width 0.3s' }} />
          </div>
        </>
      )}

      {phase === 'ready' && (
        <>
          <Row icon="✅" text={`v${info.version ?? ''} downloaded — ready to install.`} onDismiss={dismiss} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => eAPI().updater.install()} primary>Restart & Install</Btn>
            <Btn onClick={dismiss}>Later</Btn>
          </div>
        </>
      )}

      {phase === 'error' && (
        <Row icon="⚠️" text={`Update error: ${errorMsg}`} onDismiss={dismiss} />
      )}
    </div>
  );
}

function Row({ icon, text, onDismiss }: { icon: string; text: string; onDismiss?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{text}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
          aria-label="Dismiss"
        >×</button>
      )}
    </div>
  );
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: primary ? 1 : undefined,
        padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        background: primary ? '#4f7bff' : 'transparent',
        color: primary ? '#fff' : '#aaa',
        border: primary ? 'none' : '1px solid #555',
        fontWeight: primary ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
