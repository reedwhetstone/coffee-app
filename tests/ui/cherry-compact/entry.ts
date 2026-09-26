import { mount } from 'svelte';
import App from './App.svelte';
import { installNetwork } from './fixtures';
installNetwork();
mount(App, { target: document.getElementById('app')! });
