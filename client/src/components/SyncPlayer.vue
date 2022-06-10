<template>
  <v-container>
    <v-dialog
      v-model="dialog"
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
          <v-btn icon dark @click="dialog = false">
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
                <v-icon @click="hover ? playVideo(item) : undefined">
                  {{ hover ? "mdi-play-circle-outline" : "mdi-video" }}
                </v-icon>
              </v-hover>
            </template>
          </v-treeview>
        </v-card-text>
      </v-card>
    </v-dialog>
    <v-card>
      <div id="dplayer"></div>
      <v-card-actions>
        <v-btn color="primary" dark @click="browse"> browse </v-btn>
        <v-chip color="grey" class="mx-2" label outlined>
          <v-icon left> mdi-play-circle </v-icon>
          {{ currentVideo }}
        </v-chip>
      </v-card-actions>
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
      currentVideo: "",
      playlist: [],
      ignoreEvents: {
        seek: 0,
        play: 0,
        pause: 0,
        ratechange: 0,
      },
      dialog: false,
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
      this.dialog = false;
      let videoURL = "";
      if (item.path) {
        videoURL = `/movie/${item.path}/${item.name}`;
      } else {
        videoURL = `/movie/${item.name}`;
      }
      this.dp.switchVideo({ url: videoURL });
      this.currentVideo = videoURL.substring(videoURL.lastIndexOf("/") + 1);
    },

    resultHandler(event) {
      if (event.src !== this.dp.video.currentSrc) {
        this.dp.switchVideo({ url: event.src });
        this.currentVideo = event.src.substring(event.src.lastIndexOf("/") + 1);
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
        "video",
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

    this.socket.on("video", (res) => {
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
