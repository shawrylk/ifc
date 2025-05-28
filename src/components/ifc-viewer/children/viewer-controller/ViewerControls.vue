<template>
  <div class="controls-buttons">
    <IconFileInput title="Open IFC" accept=".ifc" @change="handleFileUpload">
      <i class="pi pi-folder-open"></i>
    </IconFileInput>
    <IconButton title="Open Object Tree" @click="handleObjectTreeOpen">
      <i class="pi pi-sitemap"></i>
    </IconButton>
    <IconButton title="Open Properties" @click="handlePropertiesOpen">
      <i class="pi pi-info-circle"></i>
    </IconButton>
  </div>
</template>

<script setup lang="ts">
import IconButton from '@/components/commons/IconButton.vue';
import IconFileInput from '@/components/commons/IconFileInput.vue';

const props = defineProps<{
  objectTreePanel: { handleDisplayChange: (value: boolean) => void } | null;
  propertiesPanel: { handleDisplayChange: (value: boolean) => void } | null;
}>();

const emit = defineEmits<{
  (e: 'fileUpload', event: Event): void;
}>();

const handleFileUpload = (event: Event) => {
  emit('fileUpload', event);
};

const handleObjectTreeOpen = () => {
  if (props.objectTreePanel) {
    props.objectTreePanel.handleDisplayChange(true);
  }
};

const handlePropertiesOpen = () => {
  if (props.propertiesPanel) {
    props.propertiesPanel.handleDisplayChange(true);
  }
};
</script>

<style scoped>
.controls-buttons {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 100;
}
</style>
