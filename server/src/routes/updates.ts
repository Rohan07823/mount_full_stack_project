import { Router } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const VALID_TYPES = ['PROGRESS', 'BLOCKER', 'NOTE'];

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

// List updates for a story
router.get('/story/:storyId', async (req: AuthRequest, res) => {
  try {
    const storyId = String(req.params.storyId);
    const allowed = await canAccessStory(storyId, req.user!.id);
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });

    const updates = await prisma.update.findMany({
      where: { storyId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(updates);
  } catch (error) {
    console.error('[updates.list] error:', error);
    res.status(500).json({ error: 'Failed to fetch updates' });
  }
});

// Post an update on a story
router.post('/', async (req: AuthRequest, res) => {
  const { storyId, type, message, progress } = req.body;
  if (!storyId || !type || !message) {
    return res.status(400).json({ error: 'storyId, type, and message are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(', ')}` });
  }
  try {
    const allowed = await canAccessStory(String(storyId), req.user!.id);
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });

    let progressVal: number | null = null;
    if (type === 'PROGRESS') {
      const p = Number(progress);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        return res.status(400).json({ error: 'progress must be a number between 0 and 100' });
      }
      progressVal = Math.round(p);
    }

    const update = await prisma.update.create({
      data: {
        storyId: String(storyId),
        type,
        message,
        progress: progressVal,
        authorId: req.user!.id,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    // If a 100% progress update is posted, mark the story DONE for convenience
    if (type === 'PROGRESS' && progressVal === 100) {
      await prisma.story.update({ where: { id: String(storyId) }, data: { status: 'DONE' } });
    } else if (type === 'PROGRESS' && progressVal !== null && progressVal > 0) {
      await prisma.story.update({ where: { id: String(storyId) }, data: { status: 'IN_PROGRESS' } });
    }

    res.status(201).json(update);
  } catch (error) {
    console.error('[updates.create] error:', error);
    res.status(500).json({ error: 'Failed to post update' });
  }
});

// Mark a blocker as resolved
router.put('/:id/resolve', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const update = await prisma.update.findUnique({
      where: { id },
      select: { storyId: true, type: true },
    });
    if (!update) return res.status(404).json({ error: 'Update not found' });
    const allowed = await canAccessStory(update.storyId, req.user!.id);
    if (!allowed) return res.status(403).json({ error: 'Not allowed' });
    if (update.type !== 'BLOCKER') {
      return res.status(400).json({ error: 'Only blockers can be resolved' });
    }
    const resolved = await prisma.update.update({
      where: { id },
      data: { resolved: true },
      include: { author: { select: { id: true, name: true } } },
    });
    res.json(resolved);
  } catch (error) {
    console.error('[updates.resolve] error:', error);
    res.status(500).json({ error: 'Failed to resolve update' });
  }
});

// Delete an update (author only)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const update = await prisma.update.findUnique({ where: { id } });
    if (!update) return res.status(404).json({ error: 'Update not found' });
    if (update.authorId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the author can delete this update' });
    }
    await prisma.update.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('[updates.delete] error:', error);
    res.status(500).json({ error: 'Failed to delete update' });
  }
});

export default router;
