import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { DataTreeModule, ResizeColumnsModule, Tabulator } from 'tabulator-tables';
import primeVue from 'primevue/config';
import aura from '@primeuix/themes/aura';
import './style.css';

Tabulator.registerModule([DataTreeModule, ResizeColumnsModule]);

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(primeVue, {
  theme: {
    preset: aura,
  },
});

app.mount('#app');
