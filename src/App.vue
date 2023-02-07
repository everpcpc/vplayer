<template>
  <v-app>
    <v-main>
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
                <v-card-actions class="justify-center">
                  <v-btn
                    color="primary"
                    :disabled="!username"
                    @click="startPlaying"
                  >
                    join
                  </v-btn>
                </v-card-actions>
              </v-card-text>
            </v-card>
          </v-col>
          <DPlayer v-else :uid="uid" :username="username" />
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import DPlayer from "./components/DPlayer";

export default {
  name: "App",

  components: {
    DPlayer,
  },

  data: () => ({
    showPlayer: false,
    username: "",
    uid: "",
  }),

  created() {
    this.username = localStorage.username || "";
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
      if (this.showPlayer) {
        alert("player already initialized");
        return;
      }
      this.uid = this.randomString(10);
      localStorage.username = this.username;
      this.showPlayer = true;
    },
  },
};
</script>
