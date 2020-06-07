import Vue from "vue";
import App from "./App.vue";
import "./registerServiceWorker";
import router from "./router";
import Buefy from "buefy";
import "buefy/dist/buefy.css";
import Vuex from "vuex";

Vue.use(Vuex);

Vue.use(Buefy);

Vue.config.productionTip = false;

const store = new Vuex.Store({
  state: {
    layer_configs: [],
    activeSliders: null,
    currentLayer: null,
    map: null
  },
  mutations: {
    addLayer(state, config) {
      if (config.visible === undefined) config.visible = true;
      state.layer_configs.push(config);
    },
    removeLayer(state, layer) {
      layer.selected = false;
      const idx = state.layer_configs.indexOf(layer);
      if (idx >= 0) {
        state.layer_configs.splice(idx, 1);
      }
    },
    toggleVisible(state, layer) {
      layer.visible = !layer.visible;
    },
    setCurrentLayer(state, layer) {
      if (state.currentLayer === layer) return;
      if (state.currentLayer) {
        state.currentLayer.selected = false;
      }
      state.currentLayer = layer;
      if (layer.sliders) {
        state.activeSliders = layer.sliders;
      }
      layer.selected = true;
    },
    setMap(state, map) {
      state.map = map;
    }
  }
});

new Vue({
  router,
  render: h => h(App),
  store
}).$mount("#app");
