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

let ignoreEvents = {
  seek: 0,
  play: 0,
  pause: 0,
  ratechange: 0,
};

function randomString(length) {
  let str = "";
  for (let i = 0; i < length; i++) {
    str += Math.random().toString(36).substring(2);
  }
  return str.substring(0, length);
}

function resultHandler(player, event) {
  if (event.src !== player.video.currentSrc) {
    player.switchVideo({ url: event.src });
    player.notice(`switched to ${event.src}`, 2000, 0.8);
  }
  switch (event.action) {
    case "play":
      ignoreEvents.seek++;
      player.seek(event.time + 0.2); // +0.2s for network delay
      ignoreEvents.play++;
      player.play();
      break;
    case "pause":
      ignoreEvents.seek++;
      player.seek(event.time);
      ignoreEvents.pause++;
      player.pause();
      break;
    case "seek":
      ignoreEvents.seek++;
      player.seek(event.time);
      break;
    case "sync":
      if (event.paused) {
        ignoreEvents.pause++;
        player.pause();
      } else {
        ignoreEvents.play++;
        player.play();
      }
      ignoreEvents.seek++;
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
      paused: player.video.paused,
    })
  );
}

onMounted(() => {
  const socket = io();

  const dp = new DPlayer({
    container: document.getElementById("dplayer"),
    screenshot: true,
    volume: 0,
    contextmenu: [
      {
        text: "Sync",
        click: (player) => {
          sendControl(player, socket, "sync");
          player.notice("synced", 2000, 0.8);
        },
      },
    ],
  });

  socket.on("video-control", (res) => {
    const result = JSON.parse(res);
    if (result.user !== userID) {
      resultHandler(dp, result);
    }
  });

  dp.on("play", function () {
    if (ignoreEvents.play > 0) {
      ignoreEvents.play--;
      return;
    }
    sendControl(dp, socket, "play");
  });
  dp.on("pause", function () {
    if (ignoreEvents.pause > 0) {
      ignoreEvents.pause--;
      return;
    }
    sendControl(dp, socket, "pause");
  });
  // dp.on("progress", function (event) {
  //   console.log("progress", event);
  // });
  dp.on("seeked", function () {
    if (ignoreEvents.seek > 0) {
      ignoreEvents.seek--;
      return;
    }
    sendControl(dp, socket, "seek");
  });
  dp.on("ratechange", function () {
    if (ignoreEvents.ratechange > 0) {
      ignoreEvents.ratechange--;
      return;
    }
    console.log("ratechange");
  });
});
</script>
