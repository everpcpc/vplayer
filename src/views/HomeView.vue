<template>
  <SyncPlayer />
</template>

<script setup>
import { defineComponent } from "vue";
import SyncPlayer from "../components/SyncPlayer.vue";

defineComponent({
  name: "SyncPlayer",

  components: {
    SyncPlayer,
  },
});
</script>
