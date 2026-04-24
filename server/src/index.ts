import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import prisma from './prisma';

import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import projectRoutes from './routes/projects';
import storyRoutes from './routes/stories';
import taskRoutes from './routes/tasks';
import updateRoutes from './routes/updates';
import { authenticateToken } from './middleware/auth';

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/stories', authenticateToken, storyRoutes);
app.use('/api/tasks', authenticateToken, taskRoutes);
app.use('/api/updates', updateRoutes);

// Background Job: Automated Daily Reporting with Retry Logic
// Runs every day at midnight (or immediately if triggered manually for testing)
const generateDailyReport = async (retries = 3) => {
  try {
    console.log(`[Job] Generating daily project report...`);
    const projects = await prisma.project.findMany({
      include: {
        stories: {
          include: { tasks: true }
        }
      }
    });

    let report = `Daily Project Report - ${new Date().toISOString()}\n`;
    projects.forEach((p: any) => {
      const totalStories = p.stories.length;
      const completedStories = p.stories.filter((s: any) => s.status === 'DONE').length;
      report += `Project: ${p.name} | Stories: ${completedStories}/${totalStories} Completed\n`;
    });

    // In a real application, we might email this or save it to the DB/file.
    // For now, we'll log it.
    console.log(report);
    console.log(`[Job] Daily report generated successfully.`);
  } catch (error) {
    console.error(`[Job Error] Failed to generate report. Retries left: ${retries}`);
    if (retries > 0) {
      setTimeout(() => generateDailyReport(retries - 1), 5000); // Retry after 5 seconds
    } else {
      console.error(`[Job Error] Max retries reached. Reporting failed.`);
    }
  }
};

// Schedule job to run at 00:00 every day
cron.schedule('0 0 * * *', () => {
  generateDailyReport();
});

// Expose a route to trigger the report manually for testing
app.post('/api/jobs/report', (req, res) => {
  generateDailyReport();
  res.json({ message: 'Job triggered' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
