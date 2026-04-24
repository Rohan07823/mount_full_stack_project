import { Router } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Helper: ensure user is a member of the project's team
async function ensureMember(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  if (!project) return null;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: project.teamId, userId } },
  });
  return membership ? project : null;
}

// Get all projects across all teams the user belongs to
router.get('/', async (req: AuthRequest, res) => {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user!.id },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);
    const projects = await prisma.project.findMany({
      where: { teamId: { in: teamIds } },
      include: {
        team: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        stories: { select: { status: true, assigneeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (error) {
    console.error('[projects.list] error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get a single project (must be team member)
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const member = await ensureMember(id, req.user!.id);
    if (!member) return res.status(404).json({ error: 'Project not found' });

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true } } },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
        creator: { select: { id: true, name: true } },
        stories: {
          include: {
            tasks: true,
            assignee: { select: { id: true, name: true } },
            updates: {
              include: { author: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(project);
  } catch (error) {
    console.error('[projects.get] error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create a project inside a team the user belongs to
router.post('/', async (req: AuthRequest, res) => {
  const { name, description, teamId } = req.body;
  if (!name || !teamId) return res.status(400).json({ error: 'Name and teamId are required' });
  try {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: String(teamId), userId: req.user!.id } },
    });
    if (!membership) return res.status(403).json({ error: 'Not a member of this team' });

    const project = await prisma.project.create({
      data: { name, description, teamId: String(teamId), userId: req.user!.id },
    });
    res.status(201).json(project);
  } catch (error) {
    console.error('[projects.create] error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update a project (any team member)
router.put('/:id', async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  try {
    const id = String(req.params.id);
    const member = await ensureMember(id, req.user!.id);
    if (!member) return res.status(404).json({ error: 'Project not found' });

    const project = await prisma.project.update({
      where: { id },
      data: { name, description },
    });
    res.json(project);
  } catch (error) {
    console.error('[projects.update] error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete a project (creator or team owner)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { team: { select: { ownerId: true } } },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.userId !== req.user!.id && project.team.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the project creator or team owner can delete' });
    }
    await prisma.project.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('[projects.delete] error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Activity feed: latest updates across all stories in the project
router.get('/:id/activity', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const member = await ensureMember(id, req.user!.id);
    if (!member) return res.status(404).json({ error: 'Project not found' });

    const updates = await prisma.update.findMany({
      where: { story: { projectId: id } },
      include: {
        author: { select: { id: true, name: true } },
        story: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(updates);
  } catch (error) {
    console.error('[projects.activity] error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;
