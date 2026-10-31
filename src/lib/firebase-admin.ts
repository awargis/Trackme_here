import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let projectId =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'ai-studio-ee65705e-ee5a-4cc0-acc5-31fd339999b2';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
      projectId?: string;
    };
    if (firebaseConfig.projectId) {
      projectId = firebaseConfig.projectId;
    }
  } catch (err) {
    console.warn('Could not parse firebase-applet-config.json, using default projectId:', err);
  }
}

if (!getApps().length) {
  initializeApp({
    projectId,
  });
}

export const adminAuth = getAuth();
