import { Router } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Helper: confirm user is a member of the team owning this story
async function canAccessStory(storyId: string, userId: string) {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { project: { select: { teamId: true } } },
  });
  if (!story) return false;
  const m = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: story.project.teamId, userId } },
  });
  return !!m;
}

async function canAccessProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  if (!project) return false;
  const m = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: project.teamId, userId } },
  });
  return !!m;
}

// Create a story in a project
router.post('/', async (req: AuthRequest, res) => {
  const { title, description, projectId, assigneeId } = req.body;
  if (!title || !projectId) return res.status(400).json({ error: 'Title and projectId are required' });
  try {
    const allowed = await canAccessProject(String(projectId), req.user!.id);
    if (!allowed) return res.status(403).json({ error: 'Not a team member' });

    const story = await prisma.story.create({
      data: {
        title,
        description,
        projectId: String(projectId),
        assigneeId: assigneeId ? String(assigneeId) : null,
      },
    });
    res.status(201).json(story);
  } catch (error) {
    console.error('[stories.create] error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Update a story
router.put('/:id', async (req: AuthRequest, res) => {
  const { title, description, status, assigneeId } = req.body;
  try {
    const id = String(req.params.id);
    const allowed = await canAccessStory(id, req.user!.id);
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

    const story = await prisma.story.update({ where: { id }, data });
    res.json(story);
  } catch (error) {
    console.error('[stories.update] error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete a story
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const allowed = await canAccessStory(id, req.user!.id);
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });
    await prisma.story.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('[stories.delete] error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

export default router;
