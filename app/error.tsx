'use client';
export default function Error({ reset }: {
    error: Error;
    reset: () => void;
}) { return <main className="loading-screen"><h1>Unable to open the tracker</h1><p>Please try again.</p><button className="button primary" onClick={reset}>Try again</button></main>; }
