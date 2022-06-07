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
import { io } from "socket.io-client";

function randomString(length) {
  let str = "";
  for (let i = 0; i < length; i++) {
    str += Math.random().toString(36).substr(2);
  }
  return str.substr(0, length);
}

function resultHandler(player, event) {
  if (event.src !== player.video.currentSrc) {
    player.switchVideo({ url: event.src });
    player.notice(`switched to ${event.src}`, 2000, 0.8);
  }
  switch (event.action) {
    case "play":
      player.seek(event.time + 0.2); // +0.2s for network delay
      player.play();
      break;
    case "pause":
      player.seek(event.time);
      player.pause();
      break;
    case "seek":
      player.seek(event.time);
      break;
  }
}

const userID = randomString(10);

function sendControl(player, socket, action) {
  socket.emit(
    "video-control",
    JSON.stringify({
      user: userID,
      action: action,
      time: player.video.currentTime,
      src: player.video.currentSrc,
    })
  );
}

onMounted(() => {
  const dp = new DPlayer({
    container: document.getElementById("dplayer"),
    screenshot: true,
    video: {
      url: "https://api.dogecloud.com/player/get.mp4?vcode=5ac682e6f8231991&userId=17&ext=.mp4",
    },
    contextmenu: [
      {
        text: "Sync",
        click: (player) => {
          console.log(player.video.currentTime);
          console.log(player.video.currentSrc);
          player.notice("synced", 2000, 0.8);
        },
      },
    ],
  });

  const socket = io("https://player.everpcpc.com");
  socket.on("video-control", (res) => {
    const result = JSON.parse(res);
    if (result.user !== userID) {
      resultHandler(dp, result);
    }
  });

  dp.on("play", function () {
    sendControl(dp, socket, "play");
  });
  dp.on("pause", function () {
    sendControl(dp, socket, "pause");
  });
  // dp.on("progress", function (event) {
  //   console.log("progress", event);
  // });
  dp.on("seeked", function () {
    sendControl(dp, socket, "seek");
  });
  dp.on("ratechange", function () {
    console.log("ratechange");
  });
});
</script>
