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

            <v-card-text class="my-2" align="center" v-if="isLoading">
              <v-progress-circular
                :size="50"
                color="primary"
                indeterminate
              ></v-progress-circular>
            </v-card-text>
            <v-card-text class="my-2" v-else>
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
                      @click="hover ? playItem(item) : undefined"
                    >
                      {{
                        hover
                          ? "mdi-play-circle-outline"
                          : "mdi-movie-open-play"
                      }}
                    </v-icon>
                  </v-hover>
                  <v-icon v-if="item.subtitle"> mdi-subtitles </v-icon>
                </template>
              </v-treeview>
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog v-model="playDialog" hide-overlay max-width="640px">
          <v-card>
            <v-toolbar dark color="primary">
              <v-toolbar-title>Play Video with URL</v-toolbar-title>
              <v-spacer></v-spacer>
              <v-btn icon dark @click="playDialog = false">
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </v-toolbar>
            <v-card-text class="my-2">
              <v-text-field
                v-model="videoURL"
                label="Video URL"
                :rules="[() => !!videoURL || 'url is required']"
                solo
              ></v-text-field>
              <v-text-field
                v-model="subtitleURL"
                label="Subtitle URL"
                solo
              ></v-text-field>
            </v-card-text>
            <v-card-actions class="justify-center">
              <v-btn
                color="primary"
                :disabled="!videoURL"
                @click="playURL(videoURL, subtitleURL)"
              >
                play
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-card tile>
          <div id="dplayer"></div>
          <v-card-actions>
            <v-btn
              color="primary"
              fab
              x-small
              outlined
              dark
              @click="playDialog = true"
            >
              <v-icon> mdi-link-plus </v-icon>
            </v-btn>
            <v-btn color="primary" fab x-small outlined dark @click="browse">
              <v-icon> mdi-folder-plus </v-icon>
            </v-btn>
            <v-chip color="grey" class="mx-2" label outlined>
              <v-icon left> mdi-play-circle </v-icon>
              <v-icon v-if="currentSubtitle" left> mdi-subtitles </v-icon>
              {{ currentVideo }}
            </v-chip>
          </v-card-actions>
          <v-card-text>
            <v-data-table
              disable-sort
              hide-default-footer
              :headers="clientsHeader"
              :items="otherClients"
              item-key="user"
              class="elevation-1"
            >
              <template v-slot:[`item.paused`]="{ item }">
                <v-icon
                  v-text="item.paused ? 'mdi-pause' : 'mdi-play'"
                ></v-icon>
              </template>
              <template v-slot:[`item.time`]="{ item }">
                <span v-text="duration(item.time)"></span>
              </template>
              <template v-slot:[`item.speed`]="{ item }">
                {{ item.speed }}x
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import ASS from "assjs";
import Hls from "hls.js";
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
      ass: null,
      heartbeat: null,
      currentVideo: "",
      currentSubtitle: null,
      playlist: [],
      clients: [],
      clientsHeader: [
        { text: "Name", value: "name", align: "start" },
        { text: "Progress", value: "time" },
        { text: "Status", value: "paused" },
        { text: "Speed", value: "speed" },
        { text: "Last Action", value: "action" },
      ],
      ignoreEvents: {
        seek: 0,
        play: 0,
        pause: 0,
        ratechange: 0,
      },
      playDialog: false,
      videoURL: "",
      subtitleURL: "",
      browseDialog: false,
      isLoading: false,
      files: [],
      search: "",
      expanded: false,
    };
  },

  created() {
    this.username = localStorage.username || "";
  },

  mounted() {
    console.log("HLS support:", Hls.isSupported());
  },

  computed: {
    otherClients() {
      return this.clients.filter((client) => client.user !== this.uid);
    },
  },

  methods: {
    randomString(length) {
      let str = "";
      for (let i = 0; i < length; i++) {
        str += Math.random().toString(36).substring(2);
      }
      return str.substring(0, length);
    },
    duration(t) {
      if (!t) return "0s";
      const hours = Math.floor(t / 3600);
      t = t - hours * 3600;
      const minutes = Math.floor(t / 60);
      const seconds = Math.floor(t - minutes * 60);
      if (hours) {
        return `${hours}h:${minutes}m:${seconds}s`;
      } else {
        return `${minutes}m:${seconds}s`;
      }
    },

    startPlaying() {
      if (this.showPlayer) {
        alert("player already initialized");
        return;
      }
      this.uid = this.randomString(10);
      localStorage.username = this.username;
      this.showPlayer = true;
      this.$nextTick(() => {
        this.initSocket();
      });
    },

    playURL(url, subtitle) {
      this.playDialog = false;
      this.checkSwitchVideo(url, subtitle);
      this.sendSwitch(url, subtitle);
      this.$nextTick(() => {
        this.dp.play();
      });
    },

    playItem(item) {
      this.browseDialog = false;
      const url = path.join("/movie", item.path, item.name);
      let subtitle = null;
      if (item.subtitle) {
        subtitle = path.join("/movie", item.path, item.subtitle);
      }
      this.checkSwitchVideo(url, subtitle);
      this.sendSwitch(url, subtitle);
      this.$nextTick(() => {
        this.dp.play();
      });
    },

    checkSwitchVideo(url, subtitle) {
      if (!url) {
        return;
      }

      if (this.dp) {
        if (this.dp.video.currentSrc === url) {
          return;
        }
        if (this.heartbeat) {
          clearInterval(this.heartbeat);
        }
        if (this.ass) {
          this.ass.destroy();
        }
        this.dp.destroy();
      }

      this.currentVideo = decodeURI(url.substring(url.lastIndexOf("/") + 1));
      this.currentSubtitle = subtitle;
      this.$nextTick(() => {
        this.playVideo(url, subtitle);
      });
    },

    playVideo(url, subtitle) {
      console.log("Now playing:", url, subtitle);
      let subtitleConfig = null;
      let loadASS = false;
      if (subtitle) {
        if (subtitle.endsWith(".ass")) {
          loadASS = true;
          subtitleConfig = {
            url: subtitle,
            type: "ass",
          };
        } else if (subtitle.endsWith(".vtt")) {
          subtitleConfig = {
            url: subtitle,
            type: "webvtt",
            fontSize: "20px",
            bottom: "20px",
          };
        }
      }
      let video = null;
      if (url.endsWith(".m3u8")) {
        video = {
          url: url,
          type: "vueHls",
          customType: {
            vueHls: function (video, player) {
              const hls = new Hls();
              hls.loadSource(video.src);
              hls.attachMedia(video);
              player.notice("playing HLS", 2000, 0.8);
            },
          },
        };
      } else {
        video = {
          url: url,
          type: "auto",
        };
      }
      let dp = new DPlayer({
        container: document.getElementById("dplayer"),
        screenshot: true,
        video: video,
        subtitle: subtitleConfig,
        autoplay: false,
        airplay: true,
        preload: "auto",
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

      this.heartbeat = setInterval(() => {
        if (dp.video.currentTime > 0) {
          this.sendControl("heartbeat");
        }
      }, 2000);

      dp.on("play", () => {
        if (this.ignoreEvents.play > 0) {
          this.ignoreEvents.play--;
          return;
        }
        this.sendControl("play");
      });
      dp.on("pause", () => {
        if (this.ignoreEvents.pause > 0) {
          this.ignoreEvents.pause--;
          return;
        }
        this.sendControl("pause");
      });
      dp.on("seeked", () => {
        if (this.ignoreEvents.seek > 0) {
          this.ignoreEvents.seek--;
          return;
        }
        this.sendControl("seek");
      });
      dp.on("ratechange", () => {
        if (this.ignoreEvents.ratechange > 0) {
          this.ignoreEvents.ratechange--;
          return;
        }
        this.sendControl("ratechange");
      });

      this.dp = dp;
      this.$nextTick(() => {
        if (loadASS) {
          this.loadASS(dp, subtitle);
        }
      });
    },

    loadASS(dp, subtitle) {
      const video = document.getElementsByClassName("dplayer-video")[0];
      fetch(subtitle)
        .then((res) => res.text())
        .then((text) => {
          const ass = new ASS(text, video, {
            container: document.getElementsByClassName("dplayer-video-wrap")[0],
          });
          dp.on("resize", () => {
            ass.resize();
          });
          dp.on("subtitle_show", () => {
            ass.show();
          });
          dp.on("subtitle_hide", () => {
            ass.hide();
          });
          // document.getElementsByClassName("ASS-container")[0].style.width = "";
          // document.getElementsByClassName("ASS-container")[0].style.height = "";
          // ass.resize();
          this.ass = ass;
        })
        .catch((err) => {
          dp.notice(`ASS subtitle load failed: ${err}`, 2000, 0.8);
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
        console.log("Last play status:", status.video);
        this.clients = status.clients;
        if (status.video.src) {
          const video = status.video;
          this.checkSwitchVideo(video.src, video.subtitle);
          this.$nextTick(() => {
            if (!video.paused) {
              this.ignoreEvents.play++;
              this.dp.play();
            }
            if (video.time) {
              this.ignoreEvents.seek++;
              this.dp.seek(video.time);
            }
            if (video.speed) {
              this.ignoreEvents.ratechange++;
              this.dp.speed(video.speed);
            }
          });
        }
      });
      this.socket.on("join", (user, name) => {
        if (user !== this.uid) {
          this.clients.push({ user: user, name: name });
        }
      });
      this.socket.on("left", (user) => {
        if (user !== this.uid) {
          this.clients = this.clients.filter((e) => e.user !== user);
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
      this.browseDialog = true;
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

    updateClient(event) {
      this.clients = this.clients.filter((e) => e.user !== event.user);
      this.clients.push(event);
    },

    videoHandler(event) {
      this.updateClient(event);
      this.checkSwitchVideo(event.src, event.subtitle);
      this.$nextTick(() => {
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
      });
    },

    sendSwitch(src, subtitle) {
      let data = {
        user: this.uid,
        name: this.username,
        action: "switch",
        src: src,
        subtitle: subtitle,
      };
      this.socket.emit("video", JSON.stringify(data));
    },

    sendControl(action) {
      if (!this.dp) {
        return;
      }
      let data = {
        user: this.uid,
        name: this.username,
        action: action,
        speed: this.dp.video.playbackRate,
        time: this.dp.video.currentTime,
        src: this.dp.video.currentSrc,
        subtitle: null,
        paused: this.dp.video.paused,
      };
      if (this.dp.subtitle) {
        data.subtitle = this.dp.subtitle.url;
      }
      this.socket.emit("video", JSON.stringify(data));
    },
  },
};
</script>
