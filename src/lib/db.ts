import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Node, Edge } from '@xyflow/react';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: Node[];
  edges: Edge[];
}

interface CanvasDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': number };
  };
}

let dbPromise: Promise<IDBPDatabase<CanvasDB>>;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CanvasDB>('canvas-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

export async function saveProject(project: Project) {
  const db = await getDB();
  await db.put('projects', { ...project, updatedAt: Date.now() });
}

export async function getProject(id: string) {
  const db = await getDB();
  return db.get('projects', id);
}

export async function getAllProjects() {
  const db = await getDB();
  return db.getAllFromIndex('projects', 'by-updated');
}

export async function deleteProject(id: string) {
  const db = await getDB();
  await db.delete('projects', id);
}
