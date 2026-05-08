import request from 'supertest';
import { createApp } from '../src';

export const app = createApp();
export const agent = request(app);
