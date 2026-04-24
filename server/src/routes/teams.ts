import { Router } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const generateInviteCode = () => randomBytes(4).toString('hex').toUpperCase();

const MAX_TEAM_SIZE = 10;

// List teams the user belongs to
router.get('/', async (req: AuthRequest, res) => {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user!.id },
      include: {
        team: {
          include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            _count: { select: { projects: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    res.json(memberships.map((m) => ({ ...m.team, role: m.role })));
  } catch (error) {
    console.error('[teams.list] error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get a single team (member only)
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const teamId = String(req.params.id);
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: req.user!.id } },
    });
    if (!membership) return res.status(403).json({ error: 'Not a team member' });

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        projects: {
          include: { stories: { select: { status: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ ...team, role: membership.role });
  } catch (error) {
    console.error('[teams.get] error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Create a team
router.post('/', async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  try {
    const team = await prisma.team.create({
      data: {
        name,
        inviteCode: generateInviteCode(),
        ownerId: req.user!.id,
        members: { create: { userId: req.user!.id, role: 'OWNER' } },
      },
    });
    res.status(201).json(team);
  } catch (error) {
    console.error('[teams.create] error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Join a team using an invite code
router.post('/join', async (req: AuthRequest, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });
  try {
    const team = await prisma.team.findUnique({
      where: { inviteCode: String(inviteCode).trim().toUpperCase() },
      include: { _count: { select: { members: true } } },
    });
    if (!team) return res.status(404).json({ error: 'Invalid invite code' });

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: req.user!.id } },
    });
    if (existing) return res.status(400).json({ error: 'You are already a member of this team' });

    if (team._count.members >= MAX_TEAM_SIZE) {
      return res.status(400).json({ error: `Team is full (max ${MAX_TEAM_SIZE} members)` });
    }

    await prisma.teamMember.create({
      data: { teamId: team.id, userId: req.user!.id, role: 'MEMBER' },
    });
    res.json({ id: team.id, name: team.name });
  } catch (error) {
    console.error('[teams.join] error:', error);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

// Leave a team
router.post('/:id/leave', async (req: AuthRequest, res) => {
  try {
    const teamId = String(req.params.id);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId === req.user!.id) {
      return res.status(400).json({ error: 'Owner cannot leave the team. Delete it instead.' });
    }
    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: req.user!.id } },
    });
    res.status(204).send();
  } catch (error) {
    console.error('[teams.leave] error:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

// Remove a member (owner only)
router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  try {
    const teamId = String(req.params.id);
    const userId = String(req.params.userId);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the team owner can remove members' });
    }
    if (team.ownerId === userId) {
      return res.status(400).json({ error: 'Cannot remove the team owner' });
    }
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    res.status(204).send();
  } catch (error) {
    console.error('[teams.removeMember] error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Delete a team (owner only)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const teamId = String(req.params.id);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the owner can delete the team' });
    }
    await prisma.team.delete({ where: { id: teamId } });
    res.status(204).send();
  } catch (error) {
    console.error('[teams.delete] error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Regenerate invite code (owner only)
router.post('/:id/regenerate-code', async (req: AuthRequest, res) => {
  try {
    const teamId = String(req.params.id);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the owner can regenerate invite code' });
    }
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { inviteCode: generateInviteCode() },
    });
    res.json({ inviteCode: updated.inviteCode });
  } catch (error) {
    console.error('[teams.regen] error:', error);
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

export default router;
