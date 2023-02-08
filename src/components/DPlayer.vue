<template>
  <v-card tile>
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
                    hover ? "mdi-play-circle-outline" : "mdi-movie-open-play"
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
      <v-chip
        v-for="client in otherClients"
        :key="client.user"
        :color="client.paused ? 'grey' : 'success'"
        :text-color="client.paused ? 'grey' : 'success'"
        label
        outlined
      >
        <v-avatar left> {{ client.speed }}x </v-avatar>
        <v-icon left>
          {{ client.paused ? "mdi-pause" : "mdi-play" }}
        </v-icon>
        {{ client.name }} - {{ duration(client.progress) }}
      </v-chip>
    </v-card-actions>
  </v-card>
</template>

<script>
import ASS from "assjs";
import Hls from "hls.js";
import DPlayer from "dplayer";
import { io } from "socket.io-client";
const path = require("path");

export default {
  props: ["username", "uid"],
  data() {
    return {
      socket: null,
      dp: null,
      ass: null,
      heartbeat: null,
      currentVideo: "",
      currentSubtitle: null,
      clients: [],
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

  mounted() {
    // console.log("HLS support:", Hls.isSupported());
    window.addEventListener("resize", this.tryResizeASS);
    this.initSocket();
  },

  computed: {
    otherClients() {
      return this.clients.filter((client) => client.user !== this.uid);
    },
  },

  methods: {
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

    tryResizeASS() {
      if (this.ass) {
        this.ass.resize();
      }
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
            bottom: "2px",
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
            text: "Force Sync Others",
            click: (player) => {
              this.sendControl("sync");
              player.notice("synced", 2000, 0.8);
            },
          },
          {
            text: "Switch Audio Track",
            click: (player) => {
              this.switchAudioTrack(player);
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
      if (loadASS) {
        this.loadASS(dp, subtitle);
      }
      this.$nextTick(() => {
        this.tryResizeASS();
      });
    },

    loadASS(dp, subtitle) {
      const video = document.getElementsByClassName("dplayer-video")[0];

      // clear old container
      let containers = document.getElementsByClassName("dplayer-ass");
      for (let old of containers) {
        old.remove();
      }
      let container = document.createElement("div");
      container.classList.add("dplayer-ass");
      video.after(container);

      fetch(subtitle)
        .then((res) => res.text())
        .then((text) => {
          const ass = new ASS(text, video, {
            container: container,
          });
          console.log("ASS subtitle loaded:", ass.info);
          dp.on("subtitle_show", () => {
            ass.resize();
            ass.show();
          });
          dp.on("subtitle_hide", () => {
            ass.hide();
          });
          this.ass = ass;
        })
        .catch((err) => {
          dp.notice(`ASS subtitle load failed: ${err}`, 2000, 0.8);
        });
    },

    switchAudioTrack(player) {
      if (!player.video.audioTracks) {
        player.notice("No audio track available", 2000, 0.8);
        return;
      }
      let tracks = player.video.audioTracks;
      if (tracks.length === 1) {
        player.notice("Only one audio track available", 2000, 0.8);
        return;
      }
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].enabled) {
          var current = i;
          break;
        }
      }
      const next = (current + 1) % tracks.length;
      tracks[next].enabled = true;
      tracks[current].enabled = false;
      const msgSwitch = `Switched to Audio Track ${next}: ${tracks[next].language}(${tracks[next].label})`;
      player.notice(msgSwitch, 2000, 0.8);
      // rewind 2 seconds for sound track to take effect
      player.seek(player.video.currentTime - 2);
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
            if (video.progress) {
              this.ignoreEvents.seek++;
              this.dp.seek(video.progress);
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
            this.dp.seek(event.progress + 0.2); // +0.2s for network delay
            this.ignoreEvents.play++;
            this.dp.play();
            break;
          case "pause":
            this.ignoreEvents.seek++;
            this.dp.seek(event.progress);
            this.ignoreEvents.pause++;
            this.dp.pause();
            break;
          case "seek":
            this.ignoreEvents.seek++;
            this.dp.seek(event.progress);
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
            this.dp.seek(event.progress);
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
        progress: this.dp.video.currentTime,
        src: this.dp.video.currentSrc,
        subtitle: null,
        paused: this.dp.video.paused,
        timestamp: Date.now(),
      };
      if (this.dp.subtitle) {
        data.subtitle = this.dp.subtitle.url;
      }
      this.socket.emit("video", JSON.stringify(data));
    },
  },
};
</script>

<style lang="scss">
.dplayer-video-wrap {
  > .dplayer-ass {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
}
</style>
