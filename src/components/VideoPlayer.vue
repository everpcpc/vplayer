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

    <video ref="videoPlayer" class="video-js"></video>

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
import videojs from "video.js";
import { io } from "socket.io-client";
import "video.js/dist/video-js.css";

export default {
  props: ["username", "uid"],
  data() {
    return {
      socket: null,
      player: null,
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
    this.initPlayer();
    this.initSocket();
    window.addEventListener("resize", this.tryResizeASS);
  },

  computed: {
    otherClients() {
      return this.clients.filter((client) => client.user !== this.uid);
    },
  },

  methods: {
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
              this.player.play();
            }
            if (video.progress) {
              this.ignoreEvents.seek++;
              this.player.currentTime(video.progress);
            }
            if (video.speed) {
              this.ignoreEvents.ratechange++;
              this.player.playbackRate(video.speed);
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
          this.player.pause();
        }
      });
    },
    initPlayer() {
      let player = videojs(
        this.$refs.videoPlayer,
        {
          autoplay: true,
          controls: true,
          fluid: true,
          responsive: true,
          sources: [],
          html5: { nativeTextTracks: false },
          textTrackSettings: true,
        },
        () => {
          let settings = player.textTrackSettings;
          settings.setValues({
            backgroundColor: "#000",
            backgroundOpacity: "0",
            edgeStyle: "uniform",
          });
          settings.updateDisplay();
        }
      );

      this.heartbeat = setInterval(() => {
        if (player.currentTime() > 0) {
          this.sendControl("heartbeat");
        }
      }, 2000);

      player.on("play", () => {
        this.tryResizeASS();
        if (this.ignoreEvents.play > 0) {
          this.ignoreEvents.play--;
          return;
        }
        this.sendControl("play");
      });
      player.on("pause", () => {
        if (this.ignoreEvents.pause > 0) {
          this.ignoreEvents.pause--;
          return;
        }
        this.sendControl("pause");
      });
      player.on("seeked", () => {
        if (this.ignoreEvents.seek > 0) {
          this.ignoreEvents.seek--;
          return;
        }
        this.sendControl("seek");
      });
      player.on("ratechange", () => {
        if (this.ignoreEvents.ratechange > 0) {
          this.ignoreEvents.ratechange--;
          return;
        }
        this.sendControl("ratechange");
      });

      this.player = player;
    },

    tryResizeASS() {
      if (this.ass) {
        this.ass.resize();
      }
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

    playURL(url, subtitle) {
      this.playDialog = false;
      this.checkSwitchVideo(url, subtitle);
      this.sendSwitch(url, subtitle);
      this.$nextTick(() => {
        this.player.play();
      });
    },

    playItem(item) {
      this.browseDialog = false;
      const url = `${item.path}/${item.name}`;
      let subtitle = null;
      if (item.subtitle) {
        subtitle = `${item.path}/${item.subtitle}`;
      }
      this.checkSwitchVideo(url, subtitle);
      this.sendSwitch(url, subtitle);
      this.$nextTick(() => {
        this.player.play();
      });
    },

    checkSwitchVideo(url, subtitle) {
      if (!url) {
        return;
      }
      if (this.player.currentSrc === url) {
        return;
      }
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
      }
      if (this.ass) {
        this.ass.destroy();
      }

      this.currentVideo = decodeURI(url.substring(url.lastIndexOf("/") + 1));
      this.currentSubtitle = subtitle;
      this.$nextTick(() => {
        this.playVideo(url, subtitle);
      });
    },

    playVideo(url, subtitle) {
      console.log("Now playing:", url, subtitle);
      this.player.src({
        src: url,
        type: "video/mp4",
      });
      if (subtitle) {
        if (subtitle.endsWith(".ass")) {
          this.loadASS(subtitle);
          this.player.addRemoteTextTrack(
            {
              src: "",
              kind: "subtitles",
              label: "ASS",
              default: true,
            },
            false
          );
        } else if (subtitle.endsWith(".vtt")) {
          console.log("VTT subtitle loaded:", subtitle);
          this.player.addRemoteTextTrack(
            {
              src: subtitle,
              kind: "subtitles",
              label: "VTT",
              default: true,
            },
            false
          );
        }
      }
    },

    loadASS(subtitle) {
      // clear old container
      let containers = document.getElementsByClassName("vjs-text-track-ass");
      for (let old of containers) {
        old.remove();
      }

      let container = document.createElement("div");
      container.classList.add("vjs-text-track-ass");
      const video = document.getElementsByClassName("vjs-tech")[0];
      video.after(container);
      fetch(subtitle)
        .then((res) => res.text())
        .then((text) => {
          const ass = new ASS(text, video, {
            container: container,
          });
          console.log("ASS subtitle loaded:", ass.info);
          this.ass = ass;
        })
        .catch((err) => {
          console.log(`ASS subtitle load failed: ${err}`);
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
            this.player.currentTime(event.progress + 0.2); // +0.2s for network delay
            this.ignoreEvents.play++;
            this.player.play();
            break;
          case "pause":
            this.ignoreEvents.seek++;
            this.player.currentTime(event.progress);
            this.ignoreEvents.pause++;
            this.player.pause();
            break;
          case "seek":
            this.ignoreEvents.seek++;
            this.player.currentTime(event.progress);
            break;
          case "ratechange":
            this.ignoreEvents.ratechange++;
            this.player.playbackRate(event.speed);
            break;
          case "sync":
            if (event.paused) {
              this.ignoreEvents.pause++;
              this.player.pause();
            } else {
              this.ignoreEvents.play++;
              this.player.play();
            }
            this.ignoreEvents.seek++;
            this.player.currentTime(event.progress);
            this.ignoreEvents.ratechange++;
            this.player.playbackRate(event.speed);
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
      if (!this.player) {
        return;
      }
      let data = {
        user: this.uid,
        name: this.username,
        action: action,
        speed: this.player.playbackRate(),
        progress: this.player.currentTime(),
        paused: this.player.paused,
        timestamp: Date.now(),
      };
      this.socket.emit("video", JSON.stringify(data));
    },
  },
};
</script>

<style lang="scss">
.video-js {
  > .vjs-text-track-ass {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
}
</style>
