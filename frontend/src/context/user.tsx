import { createContext } from 'react';
import type { UserInfo } from '../types/user';

export const UserContext = createContext<UserInfo | null>(null);
