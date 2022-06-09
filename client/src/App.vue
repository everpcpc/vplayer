<template>
  <v-app>
    <v-main>
      <SyncPlayer />
    </v-main>
  </v-app>
</template>

<script>
import SyncPlayer from "./components/SyncPlayer";

export default {
  name: "App",

  components: {
    SyncPlayer,
  },

  data: () => ({
    //
  }),
};
</script>
