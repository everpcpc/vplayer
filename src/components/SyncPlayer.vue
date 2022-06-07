<template>
  <v-container>
    <v-card>
      <div id="dplayer"></div>
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
    contextmenu: [
      {
        text: "sync",
        click: (player) => {
          console.log(player.video.currentTime);
          console.log(player.video.currentSrc);
          player.notice("synced", 2000, 0.8);
        },
      },
    ],
  });
  dp.on("play", function () {
    console.log("play");
  });
  dp.on("pause", function () {
    console.log("pause");
  });
  //   dp.on("progress", function (event) {
  //     console.log("progress", event);
  //   });
  dp.on("seeked", function () {
    console.log("seeked");
  });
  dp.on("ratechange", function () {
    console.log("ratechange");
  });
});
</script>
