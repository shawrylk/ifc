<template>
  <label class="icon-file-label" :title="title">
    <input type="file" :accept="accept" style="display: none" @change="$emit('change', $event)" />
    <slot>📂</slot>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  accept?: string;
}>();
</script>

<style scoped>
.icon-file-label {
  cursor: pointer;
  font-size: 1.5em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  background: none;
  border: 1px solid transparent;
  width: 32px;
  height: 32px;
  margin: 0 4px;
  transition:
    background 0.2s,
    border 0.2s;
}
.icon-file-label:hover {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid #888;
}
</style>
