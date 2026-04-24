import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface Project {
  id: string;
  name: string;
  description: string;
  team: { id: string; name: string };
  creator: { id: string; name: string };
  stories: { status: string; assigneeId: string | null }[];
}

interface TeamMember {
  user: { id: string; name: string; email?: string };
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  _count: { projects: number };
}

interface MemberStat {
  id: string;
  name: string;
  email?: string;
  completedProjects: number;
  teamNames: string[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [pRes, tRes] = await Promise.all([api.get('/projects'), api.get('/teams')]);
      setProjects(pRes.data);
      setTeams(tRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const memberStats = useMemo<MemberStat[]>(() => {
    const map = new Map<string, MemberStat>();
    for (const team of teams) {
      for (const m of team.members) {
        const existing = map.get(m.user.id);
        if (existing) {
          if (!existing.teamNames.includes(team.name)) existing.teamNames.push(team.name);
        } else {
          map.set(m.user.id, {
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            completedProjects: 0,
            teamNames: [team.name],
          });
        }
      }
    }

    for (const project of projects) {
      const total = project.stories.length;
      if (total === 0) continue;
      const done = project.stories.filter((s) => s.status === 'DONE').length;
      if (done !== total) continue;

      const contributors = new Set<string>();
      contributors.add(project.creator.id);
      for (const s of project.stories) {
        if (s.assigneeId) contributors.add(s.assigneeId);
      }

      for (const userId of contributors) {
        const stat = map.get(userId);
        if (stat) stat.completedProjects += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.completedProjects !== a.completedProjects) {
        return b.completedProjects - a.completedProjects;
      }
      return a.name.localeCompare(b.name);
    });
  }, [projects, teams]);

  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>;

  if (teams.length === 0) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h2>Welcome to Mount</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Create or join a team to start collaborating on projects.
        </p>
        <Link to="/teams"><button>Get Started with Teams</button></Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Your Projects</h2>
        <Link to="/teams"><button>Manage Teams</button></Link>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            No projects yet. Open a team to create your first project.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {teams.map((t) => (
              <Link key={t.id} to={`/team/${t.id}`}>
                <button style={{ background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
                  {t.name}
                </button>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {projects.map((project) => {
            const total = project.stories.length;
            const done = project.stories.filter((s) => s.status === 'DONE').length;
            const progress = total === 0 ? 0 : Math.round((done / total) * 100);

            return (
              <Link key={project.id} to={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
                <div className="card">
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    {project.team.name}
                  </div>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{project.name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', minHeight: '2.5em' }}>
                    {project.description || 'No description'}
                  </p>
                  <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, background: 'var(--success)', height: '100%', transition: 'width 0.3s' }} />
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

      <div style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Team Profiles</h2>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Completed projects per teammate
          </span>
        </div>

        {memberStats.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No teammates yet.</p>
          </div>
        ) : (
          <div className="grid-3">
            {memberStats.map((m) => {
              const isYou = user?.id === m.id;
              return (
                <div key={m.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    {initialsOf(m.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}
                      </h3>
                      {isYou && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          You
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.teamNames.join(' · ')}
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>
                        {m.completedProjects}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.completedProjects === 1 ? 'project completed' : 'projects completed'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
