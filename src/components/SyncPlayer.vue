<template>
  <v-container>
    <v-card>
      <div id="dplayer"></div>
      <v-card-actions>
        <v-btn @click="onPlay">play</v-btn>
        <v-btn @click="onPause">pause</v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { onMounted } from "vue";
import DPlayer from "dplayer";

let dp = null;

onMounted(() => {
  dp = new DPlayer({
    container: document.getElementById("dplayer"),
    screenshot: true,
    video: {
      url: "https://api.dogecloud.com/player/get.mp4?vcode=5ac682e6f8231991&userId=17&ext=.mp4",
    },
  });
});

function onPlay() {
  dp.play();
}
function onPause() {
  dp.pause();
}
</script>
