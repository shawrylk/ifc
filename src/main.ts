import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import {
  DataTreeModule,
  ResizeColumnsModule,
  Tabulator,
  FormatModule,
  InteractionModule,
} from 'tabulator-tables';
import primeVue from 'primevue/config';
import aura from '@primeuix/themes/aura';
import './style.css';
import * as THREE from 'three';
import CameraControls from 'camera-controls';

CameraControls.install({ THREE: THREE });
Tabulator.registerModule([DataTreeModule, ResizeColumnsModule, FormatModule, InteractionModule]);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(primeVue, {
  theme: {
    preset: aura,
  },
});

app.mount('#app');
