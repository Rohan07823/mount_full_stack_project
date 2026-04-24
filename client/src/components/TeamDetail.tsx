import { useEffect} from 'react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  stories: { status: string }[];
}

interface Team {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  role: string;
  members: Member[];
  projects: ProjectSummary[];
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchTeam = async () => {
    try {
      const res = await api.get(`/teams/${id}`);
      setTeam(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load team');
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [id]);

  const createProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectName) return;
    try {
      await api.post('/projects', { name: projectName, description: projectDesc, teamId: id });
      setProjectName('');
      setProjectDesc('');
      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const copyInvite = () => {
    if (!team) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const regenerateCode = async () => {
    if (!team) return;
    if (!confirm('Old invite code will stop working. Continue?')) return;
    try {
      await api.post(`/teams/${team.id}/regenerate-code`);
      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const removeMember = async (memberUserId: string) => {
    if (!team) return;
    if (!confirm('Remove this member from the team?')) return;
    try {
      await api.delete(`/teams/${team.id}/members/${memberUserId}`);
      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const leaveTeam = async () => {
    if (!team) return;
    if (!confirm('Leave this team?')) return;
    try {
      await api.post(`/teams/${team.id}/leave`);
      navigate('/teams');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to leave team');
    }
  };

  const deleteTeam = async () => {
    if (!team) return;
    if (!confirm('Delete this team and all its projects? This cannot be undone.')) return;
    try {
      await api.delete(`/teams/${team.id}`);
      navigate('/teams');
    } catch (err) {
      console.error(err);
    }
  };

  if (error) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>{error}</div>;
  if (!team) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;

  const isOwner = team.ownerId === user?.id;

  return (
    <div className="animate-fade-in">
      <Link to="/teams">&larr; Back to Teams</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{team.name}</h2>
        {isOwner ? (
          <button className="danger" onClick={deleteTeam}>Delete Team</button>
        ) : (
          <button className="danger" onClick={leaveTeam}>Leave Team</button>
        )}
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        {team.members.length} of 10 members
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h3>Invite Code</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Share this code with teammates so they can join.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <code style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--surface-border)',
              borderRadius: '8px',
              fontSize: '1.1rem',
              letterSpacing: '0.15em',
              fontFamily: 'monospace',
            }}>
              {team.inviteCode}
            </code>
            <button onClick={copyInvite}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          {isOwner && (
            <button
              onClick={regenerateCode}
              style={{ marginTop: '0.75rem', background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}
            >
              Regenerate Code
            </button>
          )}
        </div>

        <div className="card">
          <h3>Members</h3>
          <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {team.members.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}>
                  {m.user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem' }}>
                    {m.user.name}
                    {m.user.id === user?.id && <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}> (you)</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.user.email}</div>
                </div>
                {m.role === 'OWNER' && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)' }}>OWNER</span>
                )}
                {isOwner && m.user.id !== user?.id && (
                  <button
                    onClick={() => removeMember(m.user.id)}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>New Project</h3>
        <form onSubmit={createProject}>
          <input
            type="text"
            placeholder="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            value={projectDesc}
            onChange={(e) => setProjectDesc(e.target.value)}
            rows={2}
          />
          <button type="submit">Create Project</button>
        </form>
      </div>

      <h3>Projects</h3>
      {team.projects.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No projects yet. Create one above.</p>
      ) : (
        <div className="grid-3">
          {team.projects.map((p) => {
            const total = p.stories.length;
            const done = p.stories.filter((s) => s.status === 'DONE').length;
            const progress = total === 0 ? 0 : Math.round((done / total) * 100);
            return (
              <Link key={p.id} to={`/project/${p.id}`} style={{ textDecoration: 'none' }}>
                <div className="card">
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{p.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {p.description || 'No description'}
                  </p>
                  <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, background: 'var(--success)', height: '100%' }} />
                  </div>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {done}/{total} stories · {progress}%
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
