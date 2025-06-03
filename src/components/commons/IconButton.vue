<template>
  <button class="icon-btn" :title="title" @click="$emit('click', $event)" :type="type ?? 'button'">
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  type?: 'button' | 'submit' | 'reset';
}>();
</script>

<style scoped>
.icon-btn {
  padding: 0.2em;
  background: none;
  border: 1px solid transparent;
  color: #fff;
  cursor: pointer;
  border-radius: 8px;
  font-size: 1.5em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0 4px;
  transition: border 0.2s;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #888;
}
</style>
