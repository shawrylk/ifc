<script setup lang="ts">
import IFCViewer from './components/IFCViewer.vue';
</script>

<template>
  <div class="app">
    <header>
      <h1>IFC Viewer</h1>
    </header>
    <main>
      <IFCViewer />
    </main>
  </div>
</template>

<style>
.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  padding: 1rem;
  background-color: #2c3e50;
  color: white;
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
}

main {
  flex: 1;
  overflow: hidden;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
}
</style>
