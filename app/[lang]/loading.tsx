export default function Loading() {
  return (
    <main className="wrap" style={{ paddingBlock: 'clamp(160px,26vh,300px) var(--s10)' }} aria-busy="true">
      <span className="u">عمّان · AMMAN</span>
      <div className="skel-stack" aria-hidden="true">
        <span className="skel" style={{ width: '62%', height: 'clamp(44px,7vw,96px)' }} />
        <span className="skel" style={{ width: '44%', height: 'clamp(44px,7vw,96px)' }} />
        <span className="skel" style={{ width: '34ch', height: 16, marginTop: 24 }} />
        <span className="skel" style={{ width: '28ch', height: 16 }} />
      </div>
    </main>
  );
}
