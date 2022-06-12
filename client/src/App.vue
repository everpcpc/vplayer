<template>
  <v-app>
    <v-main>
      <SyncPlayer />
    </v-main>
  </v-app>
</template>

<script>
import Hls from "hls.js";
import SyncPlayer from "./components/SyncPlayer";

export default {
  name: "App",

  components: {
    SyncPlayer,
  },

  data: () => ({
    //
  }),

  mounted() {
    console.log("HLS support:", Hls.isSupported());
  },
};
</script>
