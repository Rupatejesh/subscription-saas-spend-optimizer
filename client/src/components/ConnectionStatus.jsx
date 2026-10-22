import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);
  return <div className={`connection-status ${online ? 'is-online' : 'is-offline'}`} role="status" aria-live="polite">{online ? 'Browser reports online' : 'Offline — saved data shown when available'}</div>;
}
