import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';
import App from './App.vue';
import { DataTreeModule, Tabulator } from 'tabulator-tables';

const app = createApp(App);
const pinia = createPinia();
// Register the DataTree module
Tabulator.registerModule([DataTreeModule]);
app.use(pinia);
app.mount('#app');
