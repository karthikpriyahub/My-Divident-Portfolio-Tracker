import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding:32, fontFamily:'monospace', background:'#0f172a', color:'#f87171', minHeight:'100vh' }}>
        <h2 style={{ color:'#fb923c', marginBottom:16 }}>💥 FinNest crashed — here's why:</h2>
        <pre style={{ background:'#1e293b', padding:16, borderRadius:8, whiteSpace:'pre-wrap', color:'#fca5a5' }}>
          {this.state.err?.message}{'\n\n'}{this.state.err?.stack}
        </pre>
        <button onClick={() => this.setState({ err:null })} style={{ marginTop:16, padding:'8px 20px', background:'#3b82f6', color:'white', border:'none', borderRadius:8, cursor:'pointer' }}>
          Try again
        </button>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
