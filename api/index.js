import { createApp } from './app.js';

const app = createApp();

export default function handler(req, res) {
  app(req, res);
}
