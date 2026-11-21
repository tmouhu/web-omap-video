import 'ol/ol.css';
import './app/theme.css';
import { mount } from 'svelte';
import App from './app/App.svelte';

export default mount(App, { target: document.getElementById('app')! });
