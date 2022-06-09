<template>
  <v-container>
    <v-card>
      <div id="dplayer"></div>
      <v-card-actions>
        <v-btn color="primary">
          browse
          <v-dialog v-model="browseDialog" max-width="600px" activator="parent">
            <v-card>
              <v-card-title>
                <span class="text-h5">User Profile</span>
              </v-card-title>
              <v-card-text>
                <v-treeview :items="items" :search="search" :filter="filter">
                  <template v-slot:prepend="{ item }">
                    <v-icon
                      v-if="item.children"
                      v-text="
                        `mdi-${
                          item.id === 1 ? 'home-variant' : 'folder-network'
                        }`
                      "
                    ></v-icon>
                  </template>
                </v-treeview>
              </v-card-text>
            </v-card>
          </v-dialog>
        </v-btn>
      </v-card-actions>
      <v-card-text> </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import DPlayer from "dplayer";
import { io } from "socket.io-client";

export default {
  data() {
    return {
      userID: "",
      socket: null,
      dp: null,
      playlist: [],
      browseDialog: false,
      ignoreEvents: {
        seek: 0,
        play: 0,
        pause: 0,
        ratechange: 0,
      },
      files: [],
    };
  },

  methods: {
    randomString(length) {
      let str = "";
      for (let i = 0; i < length; i++) {
        str += Math.random().toString(36).substring(2);
      }
      return str.substring(0, length);
    },

    refreshFiles() {
      this.socket.emit("browse", (res) => {
        this.files = JSON.parse(res);
      });
    },

    resultHandler(event) {
      if (event.src !== this.dp.video.currentSrc) {
        this.dp.switchVideo({ url: event.src });
        this.dp.notice(`switched to ${event.src}`, 2000, 0.8);
      }
      switch (event.action) {
        case "play":
          this.ignoreEvents.seek++;
          this.dp.seek(event.time + 0.2); // +0.2s for network delay
          this.ignoreEvents.play++;
          this.dp.play();
          break;
        case "pause":
          this.ignoreEvents.seek++;
          this.dp.seek(event.time);
          this.ignoreEvents.pause++;
          this.dp.pause();
          break;
        case "seek":
          this.ignoreEvents.seek++;
          this.dp.seek(event.time);
          break;
        case "sync":
          if (event.paused) {
            this.ignoreEvents.pause++;
            this.dp.pause();
          } else {
            this.ignoreEvents.play++;
            this.dp.play();
          }
          this.ignoreEvents.seek++;
          this.dp.seek(event.time);
          break;
      }
    },
    sendControl(action) {
      this.socket.emit(
        "video-control",
        JSON.stringify({
          user: this.userID,
          action: action,
          time: this.dp.video.currentTime,
          src: this.dp.video.currentSrc,
          paused: this.dp.video.paused,
        })
      );
    },
  },

  mounted() {
    this.userID = this.randomString(10);
    this.socket = io();
    this.dp = new DPlayer({
      container: document.getElementById("dplayer"),
      screenshot: true,
      volume: 0,
      video: {
        type: "auto",
      },
      contextmenu: [
        {
          text: "Sync",
          click: (player) => {
            this.sendControl("sync");
            player.notice("synced", 2000, 0.8);
          },
        },
      ],
    });

    this.socket.on("video-control", (res) => {
      const result = JSON.parse(res);
      if (result.user !== this.userID) {
        this.resultHandler(this.dp, result);
      }
    });

    this.dp.on("play", () => {
      if (this.ignoreEvents.play > 0) {
        this.ignoreEvents.play--;
        return;
      }
      this.sendControl("play");
    });
    this.dp.on("pause", () => {
      if (this.ignoreEvents.pause > 0) {
        this.ignoreEvents.pause--;
        return;
      }
      this.sendControl("pause");
    });
    // dp.on("progress", (event) => {
    //   console.log("progress", event);
    // });
    this.dp.on("seeked", () => {
      if (this.ignoreEvents.seek > 0) {
        this.ignoreEvents.seek--;
        return;
      }
      this.sendControl("seek");
    });
    this.dp.on("ratechange", () => {
      if (this.ignoreEvents.ratechange > 0) {
        this.ignoreEvents.ratechange--;
        return;
      }
      console.log("ratechange");
    });
  },
};
</script>
