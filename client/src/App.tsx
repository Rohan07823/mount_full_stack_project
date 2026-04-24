import { Routes, Route, Link, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';
import Teams from './components/Teams';
import TeamDetail from './components/TeamDetail';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link to="/">
            <h1 style={{ margin: 0 }}>Mount</h1>
          </Link>
          {user && (
            <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.95rem' }}>
              <NavLink
                to="/"
                end
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                })}
              >
                Projects
              </NavLink>
              <NavLink
                to="/teams"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                })}
              >
                Teams
              </NavLink>
            </nav>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Hi, {user.name}
              </span>
              <button className="danger" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login"><button>Sign in</button></Link>
              <Link to="/register"><button className="danger">Sign up</button></Link>
            </>
          )}
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute><Teams /></ProtectedRoute>} />
          <Route path="/team/:id" element={<ProtectedRoute><TeamDetail /></ProtectedRoute>} />
          <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
