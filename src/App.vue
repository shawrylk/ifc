<script setup lang="ts">
import Scene from './components/scene/Scene.vue';
</script>

<template>
  <div class="app">
    <header></header>
    <main>
      <Scene />
    </main>
  </div>
</template>

<style>
/* CSS Reset for cross-browser consistency */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  font-family: Arial, sans-serif;
}

.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
}

header {
  background-color: #2c3e50;
  color: white;
  flex-shrink: 0;
  height: 0; /* Initially hidden header */
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
}

main {
  flex: 1;
  min-height: 0; /* Important for flex child to shrink */
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
