<template>
  <v-container>
    <v-row align="center" justify="center">
      <v-col cols="12" lg="6" md="6" v-if="!showPlayer">
        <v-card>
          <v-card-text>
            <v-text-field
              v-model="username"
              label="username"
              :rules="[() => !!username || 'username is required']"
              solo
            ></v-text-field>
          </v-card-text>
          <v-card-actions class="justify-center">
            <v-btn color="primary" :disabled="!username" @click="startPlaying">
              join
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" v-else>
        <v-dialog
          v-model="browseDialog"
          fullscreen
          hide-overlay
          transition="dialog-bottom-transition"
        >
          <v-card>
            <v-toolbar dark color="primary">
              <v-btn icon dark @click="refreshFiles">
                <v-icon>mdi-sync</v-icon>
              </v-btn>
              <v-btn icon dark @click="toggleTreeview">
                <v-icon>{{
                  expanded ? "mdi-arrow-collapse-all" : "mdi-arrow-expand-all"
                }}</v-icon>
              </v-btn>
              <v-spacer></v-spacer>
              <v-text-field
                v-model="search"
                label="Search Video"
                dark
                flat
                solo-inverted
                hide-details
                clearable
                clear-icon="mdi-close-circle-outline"
                @input="searchTreeview"
              ></v-text-field>
              <v-spacer></v-spacer>
              <v-btn icon dark @click="browseDialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-toolbar>

            <v-card-text align="center" v-if="isLoading">
              <v-progress-circular
                :size="50"
                color="primary"
                indeterminate
              ></v-progress-circular>
            </v-card-text>
            <v-card-text v-else>
              <v-treeview
                dense
                open-on-click
                ref="browseTree"
                :items="files"
                :open-all="expanded"
                item-key="name"
                :search="search"
              >
                <template v-slot:prepend="{ item, open }">
                  <v-icon v-if="item.children != null">
                    {{ open ? "mdi-folder-open" : "mdi-folder" }}
                  </v-icon>
                  <v-hover v-else v-slot="{ hover }">
                    <v-icon
                      color="success"
                      @click="hover ? playVideo(item) : undefined"
                    >
                      {{ hover ? "mdi-play-circle-outline" : "mdi-video" }}
                    </v-icon>
                  </v-hover>
                </template>
              </v-treeview>
            </v-card-text>
          </v-card>
        </v-dialog>
        <v-card tile>
          <div id="dplayer"></div>
          <v-card-actions>
            <v-btn color="primary" dark @click="browse"> browse </v-btn>
            <v-chip color="grey" class="mx-2" label outlined>
              <v-icon left> mdi-play-circle </v-icon>
              {{ currentVideo }}
            </v-chip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import DPlayer from "dplayer";
import { io } from "socket.io-client";
const path = require("path");

export default {
  data() {
    return {
      username: "",
      uid: "",
      showPlayer: false,
      socket: null,
      dp: null,
      currentVideo: "",
      playlist: [],
      clients: {},
      ignoreEvents: {
        seek: 0,
        play: 0,
        pause: 0,
        ratechange: 0,
      },
      browseDialog: false,
      isLoading: false,
      files: [],
      search: "",
      expanded: false,
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

    startPlaying() {
      this.uid = this.randomString(10);
      this.showPlayer = true;
      this.$nextTick(() => {
        this.initPlayer();
        this.initSocket();
      });
    },

    initPlayer() {
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
      this.dp.on("progress", () => {
        this.sendControl("progress");
      });
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
        this.sendControl("ratechange");
      });
    },

    initSocket() {
      this.socket = io({
        query: {
          username: this.username,
          uid: this.uid,
        },
      });
      this.socket.on("video", (res) => {
        const result = JSON.parse(res);
        if (result.user !== this.uid) {
          this.videoHandler(result);
        }
      });
      this.socket.on("status", (res) => {
        const status = JSON.parse(res);
        this.clients = status.clients;
        if (status.video.src) {
          const video = status.video;
          this.checkPlayURL(video.src);
          if (video.paused) {
            this.ignoreEvents.pause++;
            this.dp.pause();
          } else {
            this.ignoreEvents.play++;
            this.dp.play();
          }
          this.ignoreEvents.seek++;
          this.dp.seek(video.time);
          this.ignoreEvents.ratechange++;
          this.dp.speed(video.speed);
        }
      });
      this.socket.on("join", (id, name) => {
        if (id !== this.uid) {
          this.clients[id] = { name: name };
        }
      });
      this.socket.on("left", (id) => {
        if (id !== this.uid) {
          delete this.clients[id];
          this.ignoreEvents.pause++;
          this.dp.pause();
        }
      });
    },

    browse() {
      if (this.files.length === 0) {
        this.isLoading = true;
        this.refreshFiles();
      }
      this.dialog = true;
    },
    refreshFiles() {
      this.socket.emit("browse", (res) => {
        this.files = JSON.parse(res);
        this.isLoading = false;
      });
    },
    toggleTreeview() {
      this.expanded = !this.expanded;
      this.$refs.browseTree.updateAll(this.expanded);
    },
    searchTreeview() {
      if (this.search === "" && this.expanded) {
        this.expanded = false;
        this.$refs.browseTree.updateAll(this.expanded);
      } else if (this.search !== "" && !this.expanded) {
        this.expanded = true;
        this.$refs.browseTree.updateAll(this.expanded);
      }
    },
    playVideo(item) {
      this.browseDialog = false;
      const videoURL = path.join("/movie", item.path, item.name);
      this.playURL(videoURL);
    },

    playURL(url) {
      this.checkPlayURL(url);
      this.$nextTick(() => {
        this.dp.seek(0);
        this.dp.play();
      });
    },
    checkPlayURL(url) {
      if (url && url !== this.dp.video.currentSrc) {
        this.dp.switchVideo({ url: url });
        this.dp.notice(`switched to ${url}`, 2000, 0.8);
        this.currentVideo = decodeURI(url.substring(url.lastIndexOf("/") + 1));
      }
    },

    videoHandler(event) {
      this.checkPlayURL(event.src);
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
        case "ratechange":
          this.ignoreEvents.ratechange++;
          this.dp.speed(event.speed);
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
          this.ignoreEvents.ratechange++;
          this.dp.speed(event.speed);
          break;
      }
    },

    sendControl(action) {
      this.socket.emit(
        "video",
        JSON.stringify({
          user: this.uid,
          action: action,
          speed: this.dp.playbackSpeed,
          time: this.dp.video.currentTime,
          src: this.dp.video.currentSrc,
          paused: this.dp.video.paused,
        })
      );
    },
  },
};
</script>
