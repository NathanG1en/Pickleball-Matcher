export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-card" aria-labelledby="home-title">
        <p className="eyebrow">Courtside organizer</p>
        <h1 id="home-title">
          Fair rounds.
          <br />
          Fresh partners.
        </h1>
        <p className="home-summary">
          Build balanced pickleball games without keeping the rotation in your head.
        </p>
        <div className="court-mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="home-status">Matchmaking setup is in progress.</p>
      </section>
    </main>
  );
}
