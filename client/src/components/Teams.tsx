import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

interface Team {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  role: string;
  members: { user: { id: string; name: string } }[];
  _count: { projects: number };
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const createTeam = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newName) return;
    try {
      await api.post('/teams', { name: newName });
      setNewName('');
      fetchTeams();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create team');
    }
  };

  const joinTeam = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!joinCode) return;
    try {
      await api.post('/teams/join', { inviteCode: joinCode });
      setJoinCode('');
      fetchTeams();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join team');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h2>Create a Team</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Start a new team and invite up to 9 collaborators.
          </p>
          <form onSubmit={createTeam}>
            <input
              type="text"
              placeholder="Team name (e.g. Frontend Squad)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" style={{ width: '100%' }}>Create Team</button>
          </form>
        </div>

        <div className="card">
          <h2>Join a Team</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Got an invite code from a teammate? Enter it here.
          </p>
          <form onSubmit={joinTeam}>
            <input
              type="text"
              placeholder="Invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
            />
            <button type="submit" style={{ width: '100%' }}>Join Team</button>
          </form>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        </div>
      )}

      <h2>Your Teams</h2>
      {teams.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>You're not in any teams yet. Create one above to get started.</p>
      ) : (
        <div className="grid-3">
          {teams.map((team) => (
            <Link key={team.id} to={`/team/${team.id}`} style={{ textDecoration: 'none' }}>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{team.name}</h3>
                  {team.role === 'OWNER' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                      OWNER
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                  {team.members.length} member{team.members.length === 1 ? '' : 's'} · {team._count.projects} project{team._count.projects === 1 ? '' : 's'}
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {team.members.slice(0, 5).map((m) => (
                    <div
                      key={m.user.id}
                      title={m.user.name}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'white',
                      }}
                    >
                      {m.user.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {team.members.length > 5 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: 4 }}>
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
