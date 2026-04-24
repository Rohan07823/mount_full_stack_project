import { useEffect } from 'react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface Task { id: string; title: string; isCompleted: boolean; }

interface UpdateItem {
  id: string;
  type: 'PROGRESS' | 'BLOCKER' | 'NOTE';
  message: string;
  progress: number | null;
  resolved: boolean;
  createdAt: string;
  author: { id: string; name: string };
  story?: { id: string; title: string };
}

interface Story {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee: { id: string; name: string } | null;
  tasks: Task[];
  updates: UpdateItem[];
}

interface Member {
  id: string;
  user: { id: string; name: string; email: string };
}

interface Project {
  id: string;
  name: string;
  description: string;
  team: { id: string; name: string; members: Member[] };
  creator: { id: string; name: string };
  stories: Story[];
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
};

const Avatar = ({ name, size = 28 }: { name: string; size?: number }) => (
  <div
    title={name}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--accent-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      fontWeight: 600,
      color: 'white',
      flexShrink: 0,
    }}
  >
    {name.charAt(0).toUpperCase()}
  </div>
);

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyAssignee, setStoryAssignee] = useState('');
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  const [activity, setActivity] = useState<UpdateItem[]>([]);
  const [openUpdateFor, setOpenUpdateFor] = useState<string | null>(null);
  const [updateType, setUpdateType] = useState<'PROGRESS' | 'BLOCKER' | 'NOTE'>('PROGRESS');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateProgress, setUpdateProgress] = useState(50);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await api.get(`/projects/${id}/activity`);
      setActivity(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchActivity();
  }, [id]);

  const refresh = () => {
    fetchProject();
    fetchActivity();
  };

  const createStory = async (e: FormEvent) => {
    e.preventDefault();
    if (!storyTitle) return;
    try {
      await api.post('/stories', {
        title: storyTitle,
        projectId: id,
        assigneeId: storyAssignee || undefined,
      });
      setStoryTitle('');
      setStoryAssignee('');
      refresh();
    } catch (err) { console.error(err); }
  };

  const updateStoryStatus = async (storyId: string, status: string) => {
    try { await api.put(`/stories/${storyId}`, { status }); refresh(); } catch (err) { console.error(err); }
  };

  const updateStoryAssignee = async (storyId: string, assigneeId: string) => {
    try { await api.put(`/stories/${storyId}`, { assigneeId: assigneeId || null }); refresh(); } catch (err) { console.error(err); }
  };

  const createTask = async (storyId: string, title: string) => {
    if (!title) return;
    try {
      await api.post('/tasks', { title, storyId });
      setTaskTitles({ ...taskTitles, [storyId]: '' });
      refresh();
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (taskId: string, isCompleted: boolean) => {
    try { await api.put(`/tasks/${taskId}`, { isCompleted: !isCompleted }); refresh(); } catch (err) { console.error(err); }
  };

  const openUpdate = (storyId: string) => {
    setOpenUpdateFor(storyId);
    setUpdateType('PROGRESS');
    setUpdateMessage('');
    setUpdateProgress(50);
  };

  const submitUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!openUpdateFor || !updateMessage) return;
    try {
      const payload: any = { storyId: openUpdateFor, type: updateType, message: updateMessage };
      if (updateType === 'PROGRESS') payload.progress = updateProgress;
      await api.post('/updates', payload);
      setOpenUpdateFor(null);
      setUpdateMessage('');
      refresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to post update');
    }
  };

  const resolveBlocker = async (updateId: string) => {
    try { await api.put(`/updates/${updateId}/resolve`); refresh(); } catch (err) { console.error(err); }
  };

  if (!project) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;

  const members = project.team.members;
  const openBlockers = activity.filter((a) => a.type === 'BLOCKER' && !a.resolved);

  const renderUpdateBadge = (u: UpdateItem) => {
    if (u.type === 'PROGRESS') {
      return <span style={{ fontSize: '0.7rem', background: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>{u.progress}%</span>;
    }
    if (u.type === 'BLOCKER') {
      return <span style={{ fontSize: '0.7rem', background: u.resolved ? 'var(--text-secondary)' : 'var(--danger)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>{u.resolved ? 'RESOLVED' : 'BLOCKER'}</span>;
    }
    return <span style={{ fontSize: '0.7rem', background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>NOTE</span>;
  };

  const renderColumn = (status: string, title: string) => (
    <div className="kanban-column">
      <h3>{title}</h3>
      {project.stories.filter((s) => s.status === status).map((story) => {
        const completed = story.tasks.filter((t) => t.isCompleted).length;
        const taskProgress = story.tasks.length === 0 ? 0 : Math.round((completed / story.tasks.length) * 100);
        const latestProgress = story.updates.find((u) => u.type === 'PROGRESS');
        const hasOpenBlocker = story.updates.some((u) => u.type === 'BLOCKER' && !u.resolved);

        return (
          <div key={story.id} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, flex: 1 }}>{story.title}</h4>
              {hasOpenBlocker && <span style={{ fontSize: '0.65rem', background: 'var(--danger)', color: 'white', padding: '2px 5px', borderRadius: '4px' }}>BLOCKED</span>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.5rem 0' }}>
              {story.assignee ? (
                <>
                  <Avatar name={story.assignee.name} size={22} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{story.assignee.name}</span>
                </>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unassigned</span>
              )}
            </div>

            <select
              value={story.assignee?.id || ''}
              onChange={(e) => updateStoryAssignee(story.id, e.target.value)}
              style={{ marginBottom: '0.5rem', padding: '0.25rem', fontSize: '0.75rem' }}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>

            <select
              value={story.status}
              onChange={(e) => updateStoryStatus(story.id, e.target.value)}
              style={{ marginBottom: '0.75rem', padding: '0.25rem', fontSize: '0.75rem' }}
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>

            {latestProgress && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${latestProgress.progress}%`, background: 'var(--success)', height: '100%' }} />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '4px 0 0', textAlign: 'right' }}>
                  {latestProgress.progress}% · {latestProgress.author.name}
                </p>
              </div>
            )}

            {story.tasks.length > 0 && (
              <div className="tasks">
                {story.tasks.map((task) => (
                  <div key={task.id} className={`task-item ${task.isCompleted ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      className="checkbox-custom"
                      checked={task.isCompleted}
                      onChange={() => toggleTask(task.id, task.isCompleted)}
                    />
                    <span style={{ fontSize: '0.8rem' }}>{task.title}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="text"
                placeholder="Add task..."
                value={taskTitles[story.id] || ''}
                onChange={(e) => setTaskTitles({ ...taskTitles, [story.id]: e.target.value })}
                style={{ margin: 0, padding: '0.4rem', fontSize: '0.75rem' }}
                onKeyDown={(e) => { if (e.key === 'Enter') createTask(story.id, taskTitles[story.id]); }}
              />
              <button
                onClick={() => createTask(story.id, taskTitles[story.id])}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
              >+</button>
            </div>

            <button
              onClick={() => openUpdate(story.id)}
              style={{
                width: '100%',
                marginTop: '0.75rem',
                padding: '0.5rem',
                fontSize: '0.8rem',
                background: 'transparent',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
              }}
            >
              Post Update
            </button>

            {story.updates.length > 0 && (
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.5rem' }}>
                {story.updates.slice(0, 3).map((u) => (
                  <div key={u.id} style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 2 }}>
                      {renderUpdateBadge(u)}
                      <span style={{ color: 'var(--text-secondary)' }}>{u.author.name} · {formatTime(u.createdAt)}</span>
                    </div>
                    <div style={{ color: 'var(--text-primary)' }}>{u.message}</div>
                    {u.type === 'BLOCKER' && !u.resolved && (
                      <button
                        onClick={() => resolveBlocker(u.id)}
                        style={{ marginTop: 4, padding: '2px 6px', fontSize: '0.65rem', background: 'transparent', border: '1px solid var(--success)', color: 'var(--success)' }}
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <Link to={`/team/${project.team.id}`}>&larr; Back to {project.team.name}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{project.name}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{project.description || 'No description'}</p>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {members.slice(0, 6).map((m) => <Avatar key={m.user.id} name={m.user.name} />)}
          {members.length > 6 && (
            <div style={{ alignSelf: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 4 }}>+{members.length - 6}</div>
          )}
        </div>
      </div>

      {openBlockers.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>⚠ {openBlockers.length} Open Blocker{openBlockers.length === 1 ? '' : 's'}</h3>
          {openBlockers.slice(0, 3).map((b) => (
            <div key={b.id} style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <strong>{b.author.name}</strong> on <em>{b.story?.title}</em>: {b.message}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <h3>Add User Story</h3>
        <form onSubmit={createStory} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Story title"
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
            style={{ flex: 2, marginBottom: 0, minWidth: '200px' }}
          />
          <select
            value={storyAssignee}
            onChange={(e) => setStoryAssignee(e.target.value)}
            style={{ flex: 1, marginBottom: 0, minWidth: '150px' }}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
            ))}
          </select>
          <button type="submit">Add Story</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
        <div className="kanban-board">
          {renderColumn('TODO', 'To Do')}
          {renderColumn('IN_PROGRESS', 'In Progress')}
          {renderColumn('DONE', 'Done')}
        </div>

        <div className="card" style={{ padding: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
          <h3>Activity Feed</h3>
          {activity.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No updates yet. Post one from a story card.</p>
          ) : (
            activity.map((u) => (
              <div key={u.id} style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 4 }}>
                  <Avatar name={u.author.name} size={24} />
                  <strong style={{ fontSize: '0.85rem' }}>{u.author.name}</strong>
                  {renderUpdateBadge(u)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  on <em>{u.story?.title}</em> · {formatTime(u.createdAt)}
                </div>
                <div style={{ fontSize: '0.85rem' }}>{u.message}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {openUpdateFor && (
        <div
          onClick={() => setOpenUpdateFor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '100%' }}>
            <h3>Post an Update</h3>
            <form onSubmit={submitUpdate}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {(['PROGRESS', 'BLOCKER', 'NOTE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setUpdateType(t)}
                    style={{
                      flex: 1,
                      background: updateType === t ? 'var(--accent-primary)' : 'transparent',
                      border: '1px solid var(--accent-primary)',
                      color: updateType === t ? 'white' : 'var(--accent-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {t === 'PROGRESS' ? 'Progress' : t === 'BLOCKER' ? 'Blocker' : 'Note'}
                  </button>
                ))}
              </div>

              {updateType === 'PROGRESS' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    How far along? <strong style={{ color: 'var(--text-primary)' }}>{updateProgress}%</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={updateProgress}
                    onChange={(e) => setUpdateProgress(Number(e.target.value))}
                    style={{ marginBottom: 0, padding: 0, background: 'transparent', border: 'none' }}
                  />
                </div>
              )}

              <textarea
                placeholder={
                  updateType === 'PROGRESS'
                    ? 'What did you get done?'
                    : updateType === 'BLOCKER'
                    ? "What's blocking you?"
                    : 'Share a quick note...'
                }
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                rows={4}
                required
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setOpenUpdateFor(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
                  Cancel
                </button>
                <button type="submit" style={{ flex: 2 }}>Post Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
