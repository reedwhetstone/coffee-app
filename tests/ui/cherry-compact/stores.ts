import { readable } from 'svelte/store';
import { page as state } from './state';
export const page = readable(state);
export const navigating = readable(null);
export const updated = readable(false);
