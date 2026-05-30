import React, { useState, useEffect } from "react";

/* ── tiny hook: persist auth in sessionStorage ── */
export function useAuth() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem("dp_auth") === "1"
  );
  const login  = () => { sessionStorage.setItem("dp_auth", "1"); setAuthed(true);  };
  const logout = () => { sessionStorage.removeItem("dp_auth");    setAuthed(false); };
  return { authed, login, logout };
}

/* ══════════════════════════════════════════════════════════════
   Login Page
══════════════════════════════════════════════════════════════ */
export default function Login({ onLogin }) {
  const [pin,     setPin]     = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [show,    setShow]    = useState(false);

  /* subtle entrance */
  useEffect(() => { setTimeout(() => setShow(true), 60); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/auth", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.ok) { onLogin(); }
      else         { setError("Incorrect password. Try again."); setPin(""); }
    } catch {
      setError("Could not reach server. Is it running?");
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.root}>
      {/* ── animated background ── */}
      <div style={styles.mesh} />
      <div style={styles.grid} />

      {/* ── floating orbs ── */}
      <div style={{ ...styles.orb, ...styles.orb1 }} />
      <div style={{ ...styles.orb, ...styles.orb2 }} />
      <div style={{ ...styles.orb, ...styles.orb3 }} />

      {/* ══ LEFT PANEL ══ */}
      <div style={styles.left}>
        {/* logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoBox}>
            <svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <span style={styles.logoText}>DivTracker</span>
        </div>

        {/* headline */}
        <div style={styles.heroBlock}>
          <div style={styles.liveBadge}>
            <span style={styles.liveDot} />
            <span style={styles.liveText}>PERSONAL PORTFOLIO</span>
          </div>

          <h1 style={styles.headline}>
            Track your wealth,<br/>
            <span style={styles.gradText}>grow every dividend.</span>
          </h1>

          <p style={styles.sub}>
            Your private investment dashboard — portfolio, dividends,
            YoY summaries and income goals, all in one place.
          </p>
        </div>

        {/* feature cards */}
        <div style={styles.featBox}>
          {[
            { icon: "📈", title: "Portfolio Tracker",  desc: "Live P&L, returns & current value"   },
            { icon: "💸", title: "Dividend Income",    desc: "Monthly & yearly income breakdown"    },
            { icon: "🎯", title: "Income Goal",        desc: "Track progress toward ₹ target"      },
          ].map(f => (
            <div key={f.title} style={styles.featRow}>
              <div style={styles.featIcon}>{f.icon}</div>
              <div>
                <p style={styles.featTitle}>{f.title}</p>
                <p style={styles.featDesc}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div style={{
        ...styles.right,
        opacity:   show ? 1 : 0,
        transform: show ? "translateX(0)" : "translateX(32px)",
        transition:"opacity .55s cubic-bezier(.22,1,.36,1), transform .55s cubic-bezier(.22,1,.36,1)",
      }}>

        {/* top badge */}
        <div style={styles.secureBadge}>
          <svg width="12" height="12" fill="none" stroke="#10b981" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{ fontSize:".72rem", fontWeight:700, color:"#10b981", letterSpacing:".05em" }}>
            PRIVATE ACCESS
          </span>
        </div>

        <h2 style={styles.welcome}>Welcome back 👋</h2>
        <p  style={styles.welcomeSub}>Enter your password to access your portfolio</p>

        {/* error */}
        {error && (
          <div style={styles.errorBox}>
            <svg width="15" height="15" fill="#ef4444" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0
                   012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"/>
            </svg>
            <span style={{ fontSize:".83rem", color:"#ef4444" }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width:"100%" }}>
          {/* password */}
          <label style={styles.fieldLabel}>Password</label>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>
              <svg width="15" height="15" fill="none" stroke="#6b7280" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0
                     00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </span>
            <input
              type={show ? "password" : "text"}
              value={pin}
              onChange={e => { setPin(e.target.value); setError(""); }}
              placeholder="Enter your password"
              autoFocus
              style={styles.input}
              onFocus={e  => { e.target.style.borderColor="#10b981"; e.target.style.boxShadow="0 0 0 4px rgba(16,185,129,.15)"; }}
              onBlur={e   => { e.target.style.borderColor="#e2e8f0"; e.target.style.boxShadow="none"; }}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              style={styles.eyeBtn}
              onMouseOver={e => e.currentTarget.style.color="#10b981"}
              onMouseOut={e  => e.currentTarget.style.color="#9ca3af"}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {show
                  ? <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                }
              </svg>
            </button>
          </div>

          {/* submit */}
          <button type="submit" disabled={loading || !pin.trim()} style={{
            ...styles.submitBtn,
            opacity: (loading || !pin.trim()) ? .55 : 1,
            cursor:  (loading || !pin.trim()) ? "not-allowed" : "pointer",
          }}
            onMouseOver={e => { if (!loading && pin.trim()) { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 14px 36px rgba(16,185,129,.45)"; }}}
            onMouseOut={e  => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 8px 24px rgba(16,185,129,.35)"; }}>
            {loading
              ? <><Spinner /> Verifying…</>
              : <><span>Access Portfolio</span>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                  </svg></>
            }
          </button>
        </form>

        <p style={styles.footer}>DivTracker · Personal Investment Suite</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24"
         style={{ animation:"spin 1s linear infinite" }}>
      <circle style={{ opacity:.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path style={{ opacity:.85 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   Styles
══════════════════════════════════════════════════════════════ */
const styles = {
  root: {
    display:"flex", height:"100vh", overflow:"hidden",
    fontFamily:"'Inter',-apple-system,sans-serif",
    background:"#080c14", position:"relative",
  },
  mesh: {
    position:"fixed", inset:0, zIndex:0, pointerEvents:"none",
    background:`
      radial-gradient(ellipse 75% 60% at 5%  20%,  rgba(16,185,129,.22) 0%, transparent 55%),
      radial-gradient(ellipse 55% 70% at 95% 30%,  rgba(6,182,212,.16)  0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(99,102,241,.14) 0%, transparent 55%)`,
    animation:"meshPulse 12s ease-in-out infinite alternate",
  },
  grid: {
    position:"fixed", inset:0, zIndex:0, pointerEvents:"none",
    backgroundImage:`linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)`,
    backgroundSize:"44px 44px",
  },
  orb: { position:"absolute", borderRadius:"50%", filter:"blur(65px)", pointerEvents:"none" },
  orb1:{ width:340, height:340, background:"rgba(16,185,129,.18)",  top:"-80px",  left:"-80px",  animation:"float1 9s ease-in-out infinite" },
  orb2:{ width:260, height:260, background:"rgba(6,182,212,.14)",   bottom:"5%",  right:"-60px", animation:"float2 11s ease-in-out infinite" },
  orb3:{ width:200, height:200, background:"rgba(99,102,241,.12)",  bottom:"35%", left:"25%",    animation:"float3 7s  ease-in-out infinite" },

  /* LEFT */
  left: {
    flex:"1.1", position:"relative", zIndex:10,
    display:"flex", flexDirection:"column", justifyContent:"space-between",
    padding:"2.5rem",
  },
  logoRow:  { display:"flex", alignItems:"center", gap:".65rem" },
  logoBox:  {
    width:36, height:36, borderRadius:10, flexShrink:0,
    background:"linear-gradient(135deg,#10b981,#06b6d4)",
    display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 6px 20px rgba(16,185,129,.45)",
  },
  logoText: { color:"white", fontWeight:800, fontSize:"1rem", letterSpacing:"-.02em" },

  heroBlock:  { position:"relative", zIndex:10 },
  liveBadge:  {
    display:"inline-flex", alignItems:"center", gap:".45rem",
    background:"rgba(16,185,129,.12)", border:"1px solid rgba(16,185,129,.28)",
    borderRadius:99, padding:".28rem .85rem", marginBottom:"1rem",
  },
  liveDot:  {
    width:6, height:6, borderRadius:"50%", background:"#10b981",
    boxShadow:"0 0 8px #10b981", animation:"pulse 2s infinite",
    display:"inline-block",
  },
  liveText: { color:"#6ee7b7", fontSize:".68rem", fontWeight:700, letterSpacing:".07em" },
  headline: {
    color:"white", fontSize:"2.4rem", fontWeight:900,
    letterSpacing:"-.04em", lineHeight:1.1, marginBottom:".85rem",
  },
  gradText: {
    background:"linear-gradient(90deg,#6ee7b7,#06b6d4,#818cf8)",
    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
  },
  sub: { color:"#475569", fontSize:".88rem", lineHeight:1.75, maxWidth:380 },

  /* feature list */
  featBox: {
    background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)",
    backdropFilter:"blur(14px)", borderRadius:18, padding:"1.35rem",
    display:"flex", flexDirection:"column", gap:"1.1rem",
  },
  featRow:   { display:"flex", alignItems:"center", gap:".9rem" },
  featIcon:  {
    width:40, height:40, borderRadius:12, flexShrink:0,
    background:"rgba(16,185,129,.12)", border:"1px solid rgba(16,185,129,.2)",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.15rem",
  },
  featTitle: { color:"white",   fontSize:".83rem", fontWeight:700, marginBottom:".15rem" },
  featDesc:  { color:"#475569", fontSize:".74rem" },

  /* RIGHT */
  right: {
    width:460, minWidth:420, background:"#f8fafc",
    display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"flex-start",
    padding:"3rem 3.5rem", position:"relative", zIndex:10, overflowY:"auto",
  },
  secureBadge: {
    display:"inline-flex", alignItems:"center", gap:".4rem",
    background:"#f0fdf4", border:"1px solid #bbf7d0",
    borderRadius:8, padding:".38rem .85rem", marginBottom:"1.75rem",
  },
  welcome:    { fontSize:"1.9rem", fontWeight:900, color:"#0f172a", letterSpacing:"-.03em", marginBottom:".45rem" },
  welcomeSub: { fontSize:".85rem", color:"#64748b", marginBottom:"1.75rem", lineHeight:1.6 },

  errorBox: {
    display:"flex", alignItems:"center", gap:".6rem",
    background:"#fef2f2", border:"1.5px solid #fecaca",
    borderRadius:12, padding:".85rem 1rem", marginBottom:"1.25rem", width:"100%",
  },

  fieldLabel: {
    display:"block", fontSize:".75rem", fontWeight:700,
    color:"#374151", letterSpacing:".05em", textTransform:"uppercase",
    marginBottom:".55rem",
  },
  inputWrap: { position:"relative", width:"100%", marginBottom:"1.75rem" },
  inputIcon: {
    position:"absolute", left:".85rem", top:"50%", transform:"translateY(-50%)",
  },
  input: {
    width:"100%", padding:".875rem 2.75rem .875rem 2.6rem",
    border:"1.5px solid #e2e8f0", borderRadius:12,
    fontSize:".9rem", color:"#1e293b", background:"white",
    outline:"none", transition:"all .2s", boxSizing:"border-box",
  },
  eyeBtn: {
    position:"absolute", right:".85rem", top:"50%", transform:"translateY(-50%)",
    background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:".2rem",
    transition:"color .15s",
  },
  submitBtn: {
    width:"100%", padding:"1rem",
    background:"linear-gradient(135deg,#10b981,#06b6d4)",
    color:"white", border:"none", borderRadius:12,
    fontWeight:800, fontSize:".92rem",
    display:"flex", alignItems:"center", justifyContent:"center", gap:".5rem",
    boxShadow:"0 8px 24px rgba(16,185,129,.35)",
    transition:"all .2s",
  },
  footer: {
    marginTop:"2rem", paddingTop:"1.5rem",
    borderTop:"1px solid #f1f5f9",
    fontSize:".75rem", color:"#94a3b8",
    textAlign:"center", width:"100%",
  },
};

/* inject keyframes */
const kf = document.createElement("style");
kf.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  @keyframes meshPulse { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(20deg) brightness(1.08)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes float1    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,-22px)} }
  @keyframes float2    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-15px,18px)} }
  @keyframes float3    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(12px,15px)} }
  @media(max-width:768px){
    [data-left]{display:none!important}
    [data-right]{width:100%!important;min-width:unset!important;padding:2rem 1.5rem!important}
  }
`;
document.head.appendChild(kf);
