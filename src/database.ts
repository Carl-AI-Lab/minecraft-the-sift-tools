import records from '../data/the-sift-projects.json' with { type: 'json' };
import type { Project } from './types.ts';

export const projects = records as Project[];
