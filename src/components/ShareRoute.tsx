import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Share2 } from 'lucide-react';
import { routeShareUrl } from '../domain/sharing';
export function ShareRoute({ stops, name }: { stops: string[]; name: string }) {
  const url = routeShareUrl(stops, name), [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage('Link gekopieerd.'); }
    catch { setMessage('Kopiëren lukt niet automatisch. Selecteer en kopieer de link hieronder.'); }
  }
  async function share() {
    try { await navigator.share({ title: name, url }); }
    catch (error) { if (!(error instanceof Error) || error.name !== 'AbortError') setMessage('Delen is niet gelukt. Scan de QR-code of kopieer de link.'); }
  }
  return <div className={stops.length > 60 ? 'share-route share-route-large' : 'share-route'}>
    <p>Scan met de camera van je mobiele telefoon om deze route in de online app te openen. Kies daar <strong>Bewaren</strong> om haar op je mobiele telefoon te bewaren.</p>
    <div className="route-qr"><QRCodeSVG value={url} size={stops.length > 60 ? 640 : 400} level="M" boostLevel={false} marginSize={4} title="Scan om de fietsroute op je mobiele telefoon te openen"/></div>
    <p className="muted">{name}</p>
    <label className="field-label" htmlFor="share-url">Link naar de route</label>
    <input id="share-url" className="name-input" readOnly value={url} onFocus={e => e.currentTarget.select()}/>
    <div className="modal-actions"><button onClick={() => void copy()}><Copy size={18}/>Link kopiëren</button>{typeof navigator.share === 'function' && <button onClick={() => void share()}><Share2 size={18}/>Deel link</button>}</div>
    {message && <p role="status">{message}</p>}
    <p className="muted share-explanation">De QR-code wordt op dit apparaat gemaakt. De link opent fietsroutes.kreaweb.be, ook wanneer je lokaal werkt. Je routenaam en gekozen knooppunten worden overgedragen; de route wordt met het netwerk op de mobiele telefoon opnieuw berekend.</p>
  </div>;
}
