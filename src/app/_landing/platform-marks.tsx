// Inline marks keep this row sharp and avoid third-party image requests.
export function PlatformMarks({label}:{label:string}){
 return <div className="inline-flex shrink-0 items-center gap-4 text-muted [&>svg]:size-4" role="group" aria-label={label}>
  <svg viewBox="0 0 24 24" fill="none" role="img" aria-label="Instagram"><title>Instagram</title><rect x="3" y="3" width="18" height="18" rx="5.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor"/></svg>
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="TikTok"><title>TikTok</title><path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.246v12.89a2.73 2.73 0 0 1-2.725 2.704 2.73 2.73 0 0 1-2.725-2.725 2.73 2.73 0 0 1 2.725-2.725c.28 0 .55.043.804.121V8.968a6.03 6.03 0 0 0-.804-.054A5.98 5.98 0 0 0 3.87 14.89a5.98 5.98 0 0 0 5.978 5.978 5.98 5.98 0 0 0 5.978-5.978V8.294a8.013 8.013 0 0 0 4.69 1.505V6.545a4.829 4.829 0 0 1-.927.141Z"/></svg>
  <svg viewBox="0 0 24 24" role="img" aria-label="Facebook"><title>Facebook</title><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M13.5 22v-8.4h2.8l.4-3.2h-3.2V8.3c0-.9.3-1.6 1.6-1.6H17V3.8c-.6-.1-1.4-.2-2.3-.2-2.5 0-4.2 1.6-4.2 4.4v2.4H7.7v3.2h2.8V22" fill="white"/></svg>
 </div>;
}

