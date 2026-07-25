<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 22 }
});
</script>

<template>
  <svg class="dashboard-iconfont" :width="size" :height="size" aria-hidden="true">
    <use :href="`#icon-${name}`"></use>
  </svg>
</template>
