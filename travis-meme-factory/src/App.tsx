import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { StoreProvider, useStore } from './store';
import { Toasts } from './components/ui';
import { Home } from './pages/Home';
import { Create } from './pages/Create';
import { Templates } from './pages/Templates';
import { Roasts } from './pages/Roasts';
import { News } from './pages/News';
import { Battle } from './pages/Battle';
import { Saved } from './pages/Saved';

const ROUTES = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'create', label: 'Create', icon: '🎨' },
  { id: 'templates', label: 'Templates', icon: '🧩' },
  { id: 'roasts', label: 'Roast AI', icon: '🤖' },
  { id: 'news', label: 'News', icon: '📺' },
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'saved', label: 'Saved', icon: '💾' },
] as const;

const readHash = () => {
  const h = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.some((r) => r.id === h) ? h : 'home';
};

class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  render() {
    if (this.state.err)
      return (
        <div className="page empty">
          <div className="empty__emoji">💥</div>
          <h2>Travis broke the app.</h2>
          <p className="muted">{this.state.err.message}</p>
          <button className="btn btn--primary" onClick={() => { this.setState({ err: null }); window.location.hash = '#/home'; }}>
            Pretend this never happened
          </button>
        </div>
      );
    return this.props.children;
  }
}

function Shell({ route, go }: { route: string; go: (r: string) => void }) {
  const { ready } = useStore();
  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="Home">
          <span className="brand__logo">🤡</span>
          <span className="brand__name">
            TRAVIS <b>MEME</b> FACTORY
          </span>
        </button>
        <nav className="nav nav--top">
          {ROUTES.map((r) => (
            <button key={r.id} className={`nav__item ${route === r.id ? 'on' : ''}`} onClick={() => go(r.id)}>
              {r.icon} {r.label}
            </button>
          ))}
        </nav>
      </header>
      <main key={route} className="main fade-in">
        <ErrorBoundary>
          {!ready ? (
            <div className="boot">
              <div className="spinner" />
              <p>Booting the factory…</p>
            </div>
          ) : route === 'create' ? (
            <Create />
          ) : route === 'templates' ? (
            <Templates />
          ) : route === 'roasts' ? (
            <Roasts />
          ) : route === 'news' ? (
            <News />
          ) : route === 'battle' ? (
            <Battle />
          ) : route === 'saved' ? (
            <Saved go={go} />
          ) : (
            <Home go={go} />
          )}
        </ErrorBoundary>
      </main>
      <nav className="nav nav--bottom" aria-label="Main">
        {ROUTES.filter((r) => r.id !== 'templates').map((r) => (
          <button key={r.id} className={`nav__item ${route === r.id ? 'on' : ''}`} onClick={() => go(r.id)}>
            <span className="nav__icon">{r.icon}</span>
            <span>{r.label}</span>
          </button>
        ))}
      </nav>
      <Toasts />
    </>
  );
}

export function App() {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: string) => {
    if (window.location.hash !== '#/' + r) window.location.hash = '#/' + r;
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <StoreProvider navigate={go}>
      <Shell route={route} go={go} />
    </StoreProvider>
  );
}
