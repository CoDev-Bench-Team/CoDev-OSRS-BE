import { User } from '../users/entities/user.entity.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
