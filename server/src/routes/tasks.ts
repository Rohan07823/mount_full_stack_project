import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

// Create a new task in a story
router.post('/', async (req, res) => {
  const { title, storyId } = req.body;
  if (!title || !storyId) return res.status(400).json({ error: 'Title and storyId are required' });
  try {
    const task = await prisma.task.create({
      data: { title, storyId },
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update a task (e.g. isCompleted)
router.put('/:id', async (req, res) => {
  const { title, isCompleted } = req.body;
  try {
    const task = await prisma.task.update({
      where: { id: String(req.params.id) },
      data: { title, isCompleted },
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    await prisma.task.delete({
      where: { id: String(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
