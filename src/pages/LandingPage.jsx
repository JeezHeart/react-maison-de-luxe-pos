import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, ShoppingBag, BarChart3 } from 'lucide-react';

// Home page before entering the POS — marketing-style landing, no login.
export default function LandingPage() {
  return (
    <section className="landing-page">
      <div className="landing-glow landing-glow-a" aria-hidden="true"></div>
      <div className="landing-glow landing-glow-b" aria-hidden="true"></div>

      <div className="landing-inner">
        <header className="landing-header">
          <div className="landing-brand">
            <img
              src="/assets/images/maison-logo-mark.png"
              alt="Maison de Luxe"
              className="landing-brand-mark brand-logo-img"
            />
            <span className="landing-brand-name-text">Maison de Luxe</span>
          </div>
          <span className="landing-badge">POS System</span>
        </header>

        <main className="landing-hero">
          <div className="landing-hero-text">
            <p className="landing-eyebrow">Point of sale</p>
            <h1 className="landing-title">
              Fine dining,
              <br />
              <span>one screen.</span>
            </h1>
            <p className="landing-lead">
              Take orders, print receipts, and track sales — built for cashier staff in one
              simple dashboard.
            </p>
            <div className="landing-cta-wrap">
              <Link to="/pos" className="landing-cta">
                Open POS
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <span className="landing-cta-note">
                No login required — tap to enter the cashier screen
              </span>
            </div>
          </div>

          <div className="landing-visual">
            <div className="landing-visual-card">
              <img
                src="/assets/images/maison-logo-full.png"
                alt="Maison de Luxe"
                className="landing-visual-logo"
              />
            </div>
          </div>
        </main>

        <div className="landing-features">
          <div className="landing-feature">
            <LayoutGrid size={20} aria-hidden="true" />
            <strong>Menu & checkout</strong>
            <span>Add items to the invoice, tax, and place orders.</span>
          </div>
          <div className="landing-feature">
            <ShoppingBag size={20} aria-hidden="true" />
            <strong>Orders & receipts</strong>
            <span>View transactions, print receipts, export CSV.</span>
          </div>
          <div className="landing-feature">
            <BarChart3 size={20} aria-hidden="true" />
            <strong>Reports</strong>
            <span>Sales totals, top items, and payment breakdown.</span>
          </div>
        </div>

        <footer className="landing-footer">
          React · Tailwind CSS · JavaScript — Vite build
        </footer>
      </div>
    </section>
  );
}